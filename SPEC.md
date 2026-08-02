# CANON — Build Specification v0.1

> Implementation contract. Build milestones **in order**. Do not start a
> milestone until the previous one's acceptance criteria all pass.

---

## 1. Problem

AI coding agents produce syntactically clean code at high volume, but they do
not learn from the failures their output causes. A security scanner flags a
missing sanitizer, a human fixes it, and the next session the agent writes the
same pattern again. Every existing layer — spec tools, code reviewers, SAST,
memory stores — either sits before generation or after it. Nothing carries the
result of verification *back* into the next generation.

The cost is repeat work: the same class of defect is re-introduced, re-detected,
and re-fixed indefinitely, and the repo accumulates duplication because the
agent has no memory of the corrections it already received.

## 2. Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | A gate failure becomes a durable, gate-linked rule | Rule exists in `.canon/rules/active/` with a valid `gate:` field |
| G2 | The same violation class does not recur | **Repeat violation rate** — same `gate` id firing again within 30 days |
| G3 | Rules survive a change of agent | Rule injected identically in Claude Code, Copilot, Codex, Cursor |
| G4 | The loop costs nothing at rest | Daemon idle CPU ~0, cold start < 100 ms |
| G5 | Adoption survives contact with reality | Pre-commit hook still enabled after 30 days in ≥80% of installs |

## 3. Non-Goals (v1)

| Not building | Why |
|---|---|
| An AI code reviewer | Market is mature and well-funded; CANON consumes their output instead |
| A semantic/vector index | Agentic search already outperforms it for code; adds cost and staleness |
| A hosted service or web dashboard | Local-first is the security promise; a server breaks it |
| A model router / LLM gateway | Correct layer is the gateway, not CANON. Phase 3 at the earliest |
| Automatic rule activation | Human approval is the safety invariant. Removing it invalidates the product |
| Multi-language support | v1 is TypeScript/JavaScript only. Breadth before depth kills the loop |

## 4. Architecture

```
.canon/                        <- state, committed to git
├── constitution.md            <- ≤40 human-authored invariants
├── rules/
│   ├── active/R-014.yml
│   ├── candidate/C-2026-08-02-001.yml
│   └── retired/
├── gates.yml                  <- gate registry
├── provenance.jsonl           <- append-only
└── health.json                <- metric time series

src/
├── core/                      <- pure, no I/O, no network
│   ├── rule/                  schema, dedupe, budget, lifecycle
│   ├── violation/             normalise gate output -> Violation
│   └── health/                metric computation
├── io/                        git, fs, hooks
├── gates/                     adapters: semgrep, tsc, vitest, gitleaks
├── mcp/                       stdio server (thin; talks to daemon)
├── daemon/                    unix socket, disk cache, watcher
└── cli/                       commander entrypoints
```

### Data contracts

**Rule** (`.canon/rules/active/R-014.yml`)

```yaml
id: R-014
when: "user input is rendered in a React component"
check: "dangerouslySetInnerHTML is forbidden; DOMPurify.sanitize() required"
because: "CWE-80 — caught in PR #142"
gate: "semgrep:react-dangerously-set-innerhtml"   # REQUIRED for active
scope: ["src/components/**/*.tsx"]
evidence:
  - commit: "a3f9c21"
    finding: "semgrep:2026-06-11T09:14Z"
hits: 3
created: "2026-06-11"
last_fired: "2026-07-28"
status: active            # candidate | active | retired
expires_after_days: 90    # unused-for-N-days auto-retire
```

Invariants (enforced by zod + unit tests):
- `status: active` REQUIRES a non-empty `gate`. A rule without a gate may only
  be `status: advisory` and is injected at lower priority.
- `id` is immutable. Merging two rules keeps the older id and sums `hits`.
- A rule whose `check` would disable an existing `gate` is **rejected**.

**Violation** (internal, normalised from any gate)

```ts
type Violation = {
  gate: string;          // "semgrep:rule-id"
  file: string;          // repo-relative
  line: number;
  message: string;
  severity: "error" | "warning";
  hash: string;          // sha256(gate + normalisedFile + ruleShape)
};
```

**Provenance line** (`provenance.jsonl`, append-only)

```json
{"ts":"2026-08-02T14:22:11Z","commit":"a3f9c21","author":"agent",
 "agent":"claude-code","model":"claude-opus-5","spec":null,
 "rules_injected":["R-014","R-002"],
 "gates":{"semgrep":"pass","tsc":"pass","vitest":"pass","gitleaks":"pass"},
 "files":[{"path_hash":"9f2c…","added":41,"removed":3}]}
```

No file contents, no secrets, no environment. Hashes only.

**health.json**

```json
{"generated":"2026-08-02","window_days":30,
 "repeat_violation_rate":0.18,
 "block_duplication_per_mloc":61.4,
 "copy_paste_ratio":0.14,
 "moved_lines_ratio":0.05,
 "churn_14d":0.11,
 "findings_per_1k_agent_lines":2.3,
 "active_rules":22,"advisory_rules":6,"retired_last_30d":3}
```

---

## 5. Milestones

### M0 — Skeleton (half a day)

- [ ] pnpm workspace, TypeScript strict, biome, vitest, tsup
- [ ] `canon --version` and `canon --help` run from a built binary
- [ ] CI: GitHub Actions running lint + typecheck + test on push
- [ ] `LICENSE`, `README.md`, `AGENTS.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`

**Acceptance:** `pnpm build && node dist/cli.js --version` prints a semver.

---

### M1 — Rule engine (core, no I/O)

Implement in `src/core/rule/`:

- [ ] `RuleSchema` (zod) matching the YAML contract above
- [ ] `parseRule(raw): Result<Rule, RuleError>`
- [ ] `dedupe(rules): Rule[]` — same `gate` merges, older `id` wins, `hits` sums
- [ ] `isWeakeningRule(candidate, activeGates): boolean` — rejects any candidate
      that disables or narrows an existing gate
- [ ] `selectForPath(rules, filePath): Rule[]` — glob match against `scope`
- [ ] `applyBudget(rules, max): { injected, deferred }` — hard cap, ordered by
      `hits` desc then `last_fired` desc
- [ ] `expire(rules, today): Rule[]` — moves unused rules to `retired`

**Acceptance:**
- Given a candidate whose `check` says to disable `semgrep:xss`, when promoted,
  then promotion is rejected with `RuleError.Weakening`.
- Given 60 active rules and a budget of 25, when injecting, then exactly 25 are
  returned and the highest-`hits` rules are among them.
- Given a rule with `last_fired` 120 days ago and `expires_after_days: 90`,
  when `expire` runs, then its status becomes `retired`.
- Coverage of `src/core/rule/` ≥ 90%.

---

### M2 — Gate adapters + violation capture

- [ ] `gates.yml` registry format and loader
- [ ] Adapters producing `Violation[]`: `semgrep`, `tsc`, `vitest`, `gitleaks`
- [ ] `normalise()` — stable `hash` across line-number drift (hash the AST-ish
      shape + gate id + path, not the raw line)
- [ ] `canon check` — runs the fast gate set, prints violations, exit code 1 on
      any error-severity violation
- [ ] Violation → candidate rule via **deterministic template** (no LLM):
      `when` from scope glob, `check` from the gate's own message,
      `because` from gate id + commit

**Acceptance:**
- Given a fixture repo with a `dangerouslySetInnerHTML` usage, when
  `canon check` runs, then exit code is 1 and one candidate appears in
  `.canon/rules/candidate/`.
- Given the same violation twice in one run, then exactly one candidate is
  created (`hits: 2`).
- Given a gate binary is not installed, then that gate is skipped with a
  warning and the run still succeeds (fail-open for missing tooling).

---

### M3 — Promotion + injection (the actual product)

- [ ] `canon review` — interactive TUI listing candidates; `a`ccept / `r`eject /
      `s`kip. Accept moves to `active/` and writes an evidence entry.
- [ ] `canon rules --path <file>` — prints the rules that apply to a path
- [ ] MCP stdio server exposing three tools:
  - `canon_rules(path: string)` → active + advisory rules for that path
  - `canon_why(path: string)` → related ADRs and evidence entries
  - `canon_constitution()` → the constitution text
- [ ] `canon connect` — detects installed agents and writes:
  - `.mcp.json` entry
  - Claude Code `SessionStart` hook
  - `.pre-commit-config.yaml` entry
  - `.github/workflows/canon.yml`

**Injection layering (must be implemented exactly):**
- **Layer A** — constitution + active rule digest. Emitted first, byte-stable
  between turns so the model provider's prompt cache prefix is not broken.
- **Layer B** — path-scoped rules. Emitted last, after all static content.

**Acceptance:**
- Given 3 rules scoped to `src/auth/**` and 20 scoped elsewhere, when
  `canon_rules("src/auth/login.ts")` is called, then exactly 3 are returned.
- Given two consecutive `canon_constitution()` calls with no rule changes,
  then the outputs are byte-identical.
- Given the MCP server process is killed and restarted, then the first
  `canon_rules` call returns in < 100 ms (disk cache validated against git HEAD).
- Given CANON's daemon is not running, then the coding agent still works and the
  hook exits 0 with a visible warning. (Fail-open.)

---

### M4 — Health + provenance

- [ ] `provenance.jsonl` append on every gate run in CI
- [ ] `canon health` — computes the metrics in the `health.json` contract
- [ ] **Repeat violation rate** is the headline number and is printed first
- [ ] `canon health --json` for CI consumption
- [ ] Weekly gardener: `canon tidy` — dedupe, expire, emit a summary

**Acceptance:**
- Given a repo where gate `semgrep:xss` fired on 2026-06-01 and again on
  2026-06-20, then `repeat_violation_rate` counts it as a repeat.
- Given `provenance.jsonl` with 10k lines, then `canon health` completes in < 2 s.
- Given any input, `provenance.jsonl` contains no string longer than 64 chars
  that is not a hash, id, or ISO timestamp. (Dedicated test.)

---

## 6. CLI surface (v1, frozen)

```
canon init                 scaffold .canon/, read existing AGENTS.md
canon connect              wire up agents, hooks, CI
canon check [--fast]       run gates, emit violations + candidates
canon review               approve/reject candidates
canon rules --path <p>     show rules for a path
canon health [--json]      metrics
canon tidy                 dedupe, expire, summarise
canon mcp                  run the MCP stdio server
```

No other commands ship in v1.

## 7. Open questions

| Question | Owner | Blocking? |
|---|---|---|
| Should `constitution.md` be a symlink to `AGENTS.md` or a separate file? | eng | no |
| Windows path normalisation for `scope` globs — minimatch or picomatch? | eng | no |
| Does the pre-commit hook run all gates or only those matching staged files? | eng | **yes, before M2** |
| Rule id collision across branches after a merge — how resolved? | eng | **yes, before M3** |

## 8. Definition of done for v0.1

The loop is closed end to end on one real repository:
a violation is caught, a candidate is generated, a human approves it, and in a
**different coding agent** the following day the rule is visibly injected and the
violation does not recur. Everything else is secondary.
