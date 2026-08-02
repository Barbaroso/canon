# CANON — Build Specification v0.2

> Implementation contract. Build milestones **in order**. Do not start a
> milestone until the previous one's acceptance criteria all pass.
>
> **Changed in v0.2:** rules are now layered (personal → org → repo) instead of
> repo-only. See section 4.2. This affects **M3c only**; M0–M3b are unchanged.
> If you are working on M0–M3b, ignore the layer sections entirely.

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

A single-repo memory is not enough. A developer shipping ten small projects
would have to teach the same lesson ten times. Rules must be inheritable.

## 2. Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | A gate failure becomes a durable, gate-linked rule | Rule exists with a valid `gate:` field |
| G2 | The same violation class does not recur | **Repeat violation rate** — same `gate` id firing again within 30 days |
| G3 | Rules survive a change of agent | Rule injected identically in Claude Code, Copilot, Codex, Cursor |
| G4 | Rules survive a change of project | A rule promoted to the personal layer applies in a brand-new repo with no setup |
| G5 | The loop costs nothing at rest | Daemon idle CPU ~0, cold start < 100 ms |
| G6 | Adoption survives contact with reality | Pre-commit hook still enabled after 30 days in ≥80% of installs |

## 3. Non-Goals (v1)

| Not building | Why |
|---|---|
| An AI code reviewer | Market is mature and well-funded; CANON consumes their output instead |
| A semantic/vector index | Agentic search already outperforms it for code; adds cost and staleness |
| A hosted service or web dashboard | Local-first is the security promise; a server breaks it |
| A rule sync service or registry | Org rules are a plain git repo. Do not build sync, auth, or a registry |
| A model router / LLM gateway | Correct layer is the gateway, not CANON. Phase 3 at the earliest |
| Automatic rule activation | Human approval is the safety invariant. Removing it invalidates the product |
| Multi-language support | v1 is TypeScript/JavaScript only. Breadth before depth kills the loop |

---

## 4. Architecture

```
~/.canon/                      <- personal layer, one per machine
├── rules/active/
├── cache/                     <- fetched org layers, read-only
└── git-template/hooks/        <- seeded into every new repo

<org-rules-repo>/              <- optional, a plain git repo
└── rules/active/

<project>/.canon/              <- repo layer, committed to git
├── canon.yml                  <- layer config + budget
├── constitution.md            <- <=40 human-authored invariants
├── rules/
│   ├── active/R-014.yml
│   ├── candidate/C-2026-08-02-001.yml
│   └── retired/
├── gates.yml
├── provenance.jsonl           <- append-only
└── health.json
```

```
src/
├── core/                      <- pure, no I/O, no network
│   ├── rule/                  schema, dedupe, budget, lifecycle
│   ├── layer/                 resolution + merge (NEW in v0.2)
│   ├── violation/             normalise gate output -> Violation
│   └── health/                metric computation
├── io/                        git, fs, hooks, layer loading + fetching
├── gates/                     adapters: semgrep, tsc, vitest, gitleaks
├── mcp/                       stdio server (thin; talks to daemon)
├── daemon/                    unix socket, disk cache, watcher
└── cli/                       commander entrypoints
```

### 4.1 Data contracts

**Rule** (`.canon/rules/active/R-014.yml`)

```yaml
id: R-014
when: "user input is rendered in a React component"
check: "dangerouslySetInnerHTML is forbidden; DOMPurify.sanitize() required"
because: "CWE-80 - caught in PR #142"
gate: "semgrep:react-dangerously-set-innerhtml"   # REQUIRED for active
scope: ["src/components/**/*.tsx"]
evidence:
  - commit: "a3f9c21"
    finding: "semgrep:2026-06-11T09:14Z"
hits: 3
created: "2026-06-11"
last_fired: "2026-07-28"
status: active            # candidate | active | advisory | retired
expires_after_days: 90
```

Invariants (enforced by zod + unit tests):
- `status: active` REQUIRES a non-empty `gate`. A rule without a gate may only
  be `status: advisory` and is injected at lower priority.
- `id` is immutable. Merging two rules keeps the older id and sums `hits`.
- A rule whose `check` would disable an existing `gate` is **rejected**.
- `layer` is a runtime field assigned by the loader from the file's origin. It
  is never stored on disk. A rule file containing a `layer:` key fails
  validation.

**canon.yml** — NEW in v0.2

```yaml
version: 1
extends:
  - "~/.canon/rules"                        # personal
  - "github:acme/canon-rules@v1.4.0"        # org, MUST be pinned
budget: 25          # total injected rules across ALL layers
```

Invariants:
- An `extends` entry pointing at a remote ref without a pin (`@tag` or `@sha`)
  fails validation. A moving `main` branch is a supply-chain hole.
- `budget` applies to the **merged** set, not per layer.
- `extends` is not recursive. An org rules repo may not itself declare
  `extends`. If it does, that entry is ignored and a warning is printed.
- Fetched layers live in `~/.canon/cache/` and are **read-only**. No CANON code
  path writes to a fetched layer.

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
 "files":[{"path_hash":"9f2c","added":41,"removed":3}]}
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
 "active_rules":22,"advisory_rules":6,"retired_last_30d":3,
 "rules_by_layer":{"personal":4,"org":9,"repo":9}}
```

### 4.2 Layer resolution — NEW in v0.2

Load order is personal, then org, then repo. Repo is loaded last because it
wins.

**Merge algorithm, in this exact order:**

1. **Load** each layer's `rules/active/`, tagging every rule with its `layer`.
2. **Match by `gate`.** Two rules sharing a `gate` value are the same rule
   regardless of their `id`.
3. **Narrowest wins.** On a `gate` collision keep the rule from the narrowest
   layer: `repo` > `org` > `personal`. The loser is dropped from injection but
   its `hits` are added to the winner.
4. **Suppression.** A repo rule may suppress an inherited rule by declaring the
   same `gate` with `status: retired`. This is the only way to switch off an
   inherited rule, and it is explicit and reviewable in the repo's git log.
   A personal or org rule can never suppress a repo rule.
5. **Budget.** `applyBudget` runs on the merged set using `canon.yml` `budget`.
   Sort order is unchanged (hits desc, last_fired desc, id asc); on a tie,
   repo beats org beats personal.

**Promotion between layers.** When a repo-layer rule reaches `hits >= 3`,
`canon review` offers to copy it to the personal layer. This is a prompt, never
automatic. `canon promote --to personal <rule-id>` does it directly.

Promotion **copies**, it does not move. The repo keeps its rule. This is
deliberate: a repo must stay self-contained and reproducible for someone who
clones it without your personal layer.

---

## 5. Milestones

### M0 — Skeleton (unchanged)

- [ ] pnpm workspace, TypeScript strict, biome, vitest, tsup
- [ ] `canon --version` and `canon --help` run from a built binary
- [ ] CI running lint + typecheck + test on push
- [ ] `LICENSE`, `README.md`, `AGENTS.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`

**Acceptance:** `pnpm build && node dist/cli.js --version` prints a semver.

---

### M1 — Rule engine (unchanged)

`src/core/rule/`: `RuleSchema`, `parseRule`, `dedupe`, `isWeakeningRule`,
`selectForPath`, `applyBudget`, `expire`.

**Acceptance:**
- A candidate whose `check` disables `semgrep:xss` is rejected with
  `RuleError.Weakening`.
- 60 active rules with budget 25 returns exactly 25, highest-`hits` included.
- A rule last fired 120 days ago with `expires_after_days: 90` becomes retired.
- `src/core/**` contains no `node:fs`, `node:http`, `node:https` or network
  imports, proven by a test that walks the import graph.
- Coverage of `src/core/rule/` >= 90%.

---

### M2 — Gate adapters + violation capture (unchanged)

- [ ] `gates.yml` registry format and loader
- [ ] Adapters producing `Violation[]`: semgrep, tsc, vitest, gitleaks
- [ ] `normalise()` with a hash stable across line-number drift
- [ ] `canon check` — exit 1 on any error-severity violation
- [ ] Violation to candidate rule via deterministic template, no LLM

**Acceptance:**
- On the fixture repo, `canon check` exits 1 and creates one candidate.
- The same violation twice in one run creates one candidate with `hits: 2`.
- A missing gate binary is skipped with a warning; the run still succeeds.

---

### M3 — Promotion + injection

#### M3a — review and query (unchanged)
`canon review`, `canon rules --path <file>`, `src/rules/promote.ts`.

#### M3b — MCP server (unchanged)
`canon_rules`, `canon_why`, `canon_constitution` over stdio.

#### M3c — scaffolding, layers, and wiring — CHANGED in v0.2

- [ ] `canon.yml` schema + loader in `src/io/layer/config.ts`
- [ ] `src/core/layer/resolve.ts` — pure function implementing section 4.2.
      Takes already-loaded rule sets, returns the merged set. No I/O.
- [ ] `src/io/layer/fetch.ts` — resolves `github:owner/repo@ref` into
      `~/.canon/cache/`. Pin required. Read-only after fetch.
- [ ] `canon init` — scaffolds `.canon/` including a `canon.yml` that extends
      `~/.canon/rules` only
- [ ] `canon promote --to personal <rule-id>`
- [ ] `canon review` offers promotion when a repo rule reaches `hits >= 3`
- [ ] `canon connect` — writes `.mcp.json`, Claude Code `SessionStart` hook,
      `.pre-commit-config.yaml` entry, `.github/workflows/canon.yml`
- [ ] `canon connect --global` — registers the MCP server once per machine,
      writes `~/.canon/git-template/hooks/`, then **prints** the
      `git config --global init.templateDir ~/.canon/git-template` command for
      the user to run. Do not execute `git config --global` yourself.

**Injection layering — unchanged and still mandatory:**
- **Layer A** — constitution + merged active rule digest. Emitted first and
  byte-stable between turns so the prompt cache prefix is not broken.
- **Layer B** — path-scoped rules. Emitted last.

**Acceptance:**
- A personal rule and a repo rule sharing a `gate`: the repo rule survives and
  the merged `hits` equal the sum of both.
- A repo rule with `status: retired` sharing a `gate` with an org rule: the org
  rule is not injected.
- A personal rule with `status: retired` sharing a `gate` with a repo rule: the
  repo rule **is** injected. Personal cannot suppress repo.
- `extends: ["github:acme/canon-rules"]` with no pin fails validation with a
  message naming the unpinned entry.
- Three layers totalling 60 rules with `budget: 25` inject exactly 25, and on a
  hits tie the repo rule is chosen over the org rule.
- An org rules repo that itself declares `extends`: that entry is ignored and a
  warning is printed.
- `canon promote --to personal R-014` copies to `~/.canon/rules/active/` and
  leaves the repo copy untouched.
- With the daemon unreachable, the `SessionStart` hook exits 0 with a warning
  and the coding agent keeps working. (Fail-open.)
- `canon connect` run twice produces byte-identical files.
- Two consecutive `canon_constitution()` calls with no rule change return
  byte-identical output.

---

### M4 — Health + provenance (mostly unchanged)

- [ ] `provenance.jsonl` append on every gate run in CI
- [ ] `canon health` — the full `health.json` contract including the new
      `rules_by_layer` breakdown
- [ ] repeat violation rate printed first in human-readable output
- [ ] `canon health --json`
- [ ] `canon tidy` — dedupe, expire, summarise. Operates on the **repo layer
      only**; it must never modify `~/.canon/` or a cached org layer.

**Acceptance:**
- A gate firing on 2026-06-01 and again on 2026-06-20 counts as a repeat.
- `canon health` on a 10k-line provenance file completes in under 2 s.
- `provenance.jsonl` contains no string longer than 64 chars that is not a
  hash, id, or ISO timestamp. Property test, not a single example.
- `canon tidy` leaves `~/.canon/` and `~/.canon/cache/` byte-identical.

---

## 6. CLI surface (v1, frozen)

```
canon init                       scaffold .canon/, read existing AGENTS.md
canon connect [--global]         wire up agents, hooks, CI
canon check [--fast]             run gates, emit violations + candidates
canon review                     approve/reject candidates, offer promotion
canon rules --path <p>           show merged rules for a path
canon promote --to personal <id> copy a repo rule to the personal layer
canon health [--json]            metrics
canon tidy                       dedupe, expire (repo layer only)
canon mcp                        run the MCP stdio server
```

No other commands ship in v1.

## 7. Open questions

| Question | Owner | Blocking? |
|---|---|---|
| `constitution.md` as a symlink to `AGENTS.md`, or separate? | eng | no |
| Windows glob normalisation — minimatch or picomatch? | eng | no |
| Pre-commit: all gates, or only those matching staged files? | eng | **yes, before M2** |
| Rule id collision across branches after a merge | eng | **yes, before M3a** |
| Should org layers get a `require:` list the repo cannot suppress? | eng | no, defer to v0.3 |

## 8. Definition of done for v0.1

The loop closes end to end on one real repository: a violation is caught, a
candidate is generated, a human approves it, and the next day in a **different
coding agent** the rule is visibly injected and the violation does not recur.

Then the same rule, promoted to the personal layer, fires in a **second,
unrelated repository** with no setup beyond `canon init`.

Everything else is secondary.
