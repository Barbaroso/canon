# ISSUES.md — Autonomous build queue

The Copilot coding agent produces one PR per issue. Each issue below is scoped
so the agent can finish it without architectural judgment calls.

**Assign one at a time, in order.** Merge the PR before assigning the next.
Issues 3–9 depend on earlier ones and will fail if run out of order.

---

## Issue 1 — M0: Project skeleton

**Title:** `M0: TypeScript skeleton, CLI entrypoint, CI`

```
Set up the project skeleton described in SPEC.md milestone M0. Nothing else.

Create:
- package.json (name: canon-cli, type: module, engines.node >=22)
- tsconfig.json with "strict": true, "moduleResolution": "bundler"
- biome.json, vitest.config.ts, tsup.config.ts
- src/cli/index.ts with a shebang, using commander, supporting --version and --help
- .github/workflows/ci.yml running pnpm lint, typecheck, test on push and PR
- CODE_OF_CONDUCT.md (Contributor Covenant 2.1) and SECURITY.md

Constraints:
- ESM only. No CommonJS anywhere.
- Runtime dependencies limited to: commander, zod.
- Dev dependencies limited to: typescript, vitest, tsup, @biomejs/biome, @types/node.
- Do not create any file under src/ other than src/cli/index.ts.

Acceptance:
- [ ] `pnpm install && pnpm build` succeeds
- [ ] `node dist/cli.js --version` prints 0.1.0
- [ ] `node dist/cli.js --help` lists no subcommands yet
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass (test may be a single trivial test)
- [ ] CI workflow runs green on the PR

Paste the real terminal output of all four commands in the PR description.
```

---

## Issue 2 — M1a: Rule schema and the weakening guard

**Title:** `M1a: RuleSchema, parseRule, isWeakeningRule`

```
Implement the first half of SPEC.md milestone M1, in src/core/rule/.

1. src/core/rule/schema.ts — zod schema matching the Rule YAML contract in
   SPEC.md section 4. Export the inferred type as `Rule`.
2. src/core/rule/parse.ts — `parseRule(raw: unknown): Result<Rule, RuleError>`.
   Define Result and RuleError in src/core/result.ts. Core functions return
   Result; they do not throw.
3. src/core/rule/weakening.ts — `isWeakeningRule(candidate: Rule, activeGates: string[]): boolean`
   Returns true if the candidate's `check` text would disable, suppress, skip,
   or narrow any gate in activeGates. Detect at minimum: "disable", "skip",
   "ignore", "suppress", "nosemgrep", "eslint-disable", "@ts-ignore",
   "--no-verify", and any exact activeGates id appearing next to those words.

Requirements:
- src/core/** must not import node:fs, node:http, node:https, or any network
  client. Add test/no-io-in-core.test.ts that walks src/core/ and fails if any
  file contains such an import.
- A Rule with status "active" and an empty or missing `gate` field must fail
  validation with RuleError.MissingGate.
- Test coverage of src/core/rule/ must be at least 90%. Configure vitest
  coverage thresholds so CI enforces this.

Acceptance:
- [ ] Given a candidate whose check says to disable semgrep:xss and
      activeGates includes "semgrep:xss", isWeakeningRule returns true
- [ ] Given a normal candidate, isWeakeningRule returns false
- [ ] Given status "active" with no gate, parseRule returns Err(MissingGate)
- [ ] test/no-io-in-core.test.ts passes
- [ ] Coverage of src/core/rule/ >= 90%

Write each test before its implementation.
```

---

## Issue 3 — M1b: Rule lifecycle functions

**Title:** `M1b: dedupe, selectForPath, applyBudget, expire`

```
Depends on: M1a (merged). Implement the rest of SPEC.md milestone M1.

In src/core/rule/:
- dedupe.ts — `dedupe(rules: Rule[]): Rule[]`. Rules sharing the same `gate`
  merge into one: keep the older `id` (lexically smallest created date), sum
  `hits`, union `scope`, union `evidence`, keep the latest `last_fired`.
- select.ts — `selectForPath(rules: Rule[], filePath: string): Rule[]`.
  Glob match filePath against each rule's `scope` using picomatch. Normalise
  Windows backslashes to forward slashes before matching.
- budget.ts — `applyBudget(rules: Rule[], max: number): { injected: Rule[]; deferred: Rule[] }`.
  Sort by hits desc, then last_fired desc, then id asc. Take the first `max`.
  Rules with status "advisory" always sort after "active" rules.
- expire.ts — `expire(rules: Rule[], today: Date): Rule[]`. A rule whose
  last_fired is more than expires_after_days ago gets status "retired".
  A rule that has never fired uses `created` as the baseline.

Acceptance:
- [ ] Given two rules with gate "semgrep:xss", hits 2 and 3, dedupe returns one
      rule with hits 5 and the older id
- [ ] Given 60 active rules and max 25, applyBudget returns exactly 25 injected
      and 35 deferred, and the highest-hits rules are in injected
- [ ] Given a rule last_fired 120 days ago with expires_after_days 90, expire
      sets status to "retired"
- [ ] Given scope ["src/components/**/*.tsx"], selectForPath matches
      "src/components/form/Input.tsx" and does not match "src/lib/util.ts"
- [ ] selectForPath handles "src\\components\\Input.tsx" identically
- [ ] Coverage of src/core/rule/ stays >= 90%

Add picomatch as a runtime dependency — this is the one approved exception.
```

---

## Issue 4 — M2a: Gate registry and violation normalisation

**Title:** `M2a: gates.yml, Violation type, stable hashing`

```
Depends on: M1b (merged). First half of SPEC.md milestone M2.

- src/core/violation/types.ts — the Violation type from SPEC.md section 4.
- src/core/violation/normalise.ts — `normalise(raw, gateId): Violation`, and
  `hashViolation(v): string` producing a sha256 that is STABLE when line
  numbers shift. Hash: gateId + repo-relative posix path + a normalised code
  shape (the offending line with all whitespace collapsed, string literals
  replaced by "", and numeric literals replaced by "0").
- src/io/gates/registry.ts — loader and zod schema for .canon/gates.yml:
  ```yaml
  gates:
    - id: semgrep
      command: "semgrep --config auto --json"
      speed: fast        # fast | slow
      parser: semgrep
  ```

Acceptance:
- [ ] Inserting 10 blank lines above a violation leaves hashViolation unchanged
      (dedicated test)
- [ ] Changing a string literal inside the offending line leaves the hash
      unchanged; changing an identifier changes it
- [ ] Windows and POSIX paths for the same file produce the same hash
- [ ] Invalid gates.yml produces a readable error naming the bad field
```

---

## Issue 5 — M2b: Gate adapters and `canon check`

**Title:** `M2b: semgrep/tsc/vitest/gitleaks adapters, canon check, candidate generation`

```
Depends on: M2a (merged). Second half of SPEC.md milestone M2.

- src/io/gates/adapters/{semgrep,tsc,vitest,gitleaks}.ts — each runs its tool,
  parses output, returns Violation[].
- src/cli/check.ts — `canon check [--fast]`. Runs gates (fast set only with
  --fast), prints violations grouped by file, exits 1 if any error-severity
  violation exists, 0 otherwise.
- src/rules/candidate.ts — deterministic Violation -> candidate rule. No LLM.
  `when` derived from the scope glob of the violation's directory,
  `check` from the gate's own message, `because` from gate id + short commit.
  Candidate files land in .canon/rules/candidate/ named C-YYYY-MM-DD-NNN.yml.

Fail-open requirement: if a gate binary is not installed, log
"gate <id> skipped: binary not found" to stderr and continue. The run still
succeeds if no other gate fails.

Create test/fixtures/sample-repo/ containing a React component that uses
dangerouslySetInnerHTML with unsanitised input, and drive tests through it.

Acceptance:
- [ ] `canon check` on the fixture exits 1 and creates exactly one candidate
- [ ] The same violation appearing twice in one run creates one candidate with hits 2
- [ ] With PATH stripped of semgrep, `canon check` warns, skips, and exits 0
- [ ] Candidate YAML parses cleanly with parseRule from M1a
```

---

## Issue 6 — M3a: `canon review` and `canon rules`

**Title:** `M3a: candidate review TUI, promotion, rules query`

```
Depends on: M2b (merged). Part of SPEC.md milestone M3.

- src/rules/promote.ts — the ONLY module permitted to write into
  .canon/rules/active/. Rejects any candidate for which isWeakeningRule
  returns true, with a clear message.
- src/cli/review.ts — interactive list of candidates; keys: a accept,
  r reject, s skip, q quit. Accept calls promote(). Reject moves the file to
  .canon/rules/retired/.
- src/cli/rules.ts — `canon rules --path <file>` prints applicable rules,
  active first then advisory.

Add test/promote-write-guard.test.ts: walk the whole src/ tree and fail if any
file other than src/rules/promote.ts contains a write call targeting a path
containing "rules/active".

There must be no flag, env var, or config key that auto-accepts candidates.
Do not add one for testing convenience — call promote() directly in tests.

Acceptance:
- [ ] A weakening candidate is rejected by promote() with RuleError.Weakening
- [ ] test/promote-write-guard.test.ts passes
- [ ] Accepting a candidate moves it to active/ and appends an evidence entry
- [ ] Given 3 rules scoped to src/auth/** and 20 elsewhere,
      `canon rules --path src/auth/login.ts` prints exactly 3
```

---

## Issue 7 — M3b: MCP server

**Title:** `M3b: MCP stdio server with canon_rules, canon_why, canon_constitution`

```
Depends on: M3a (merged). Part of SPEC.md milestone M3.

- src/mcp/server.ts using @modelcontextprotocol/sdk, stdio transport only.
- Exactly three tools. Do not add a fourth.
  - canon_rules(path: string) -> active + advisory rules for that path
  - canon_why(path: string)   -> related ADRs and evidence entries
  - canon_constitution()      -> constitution text + active rule digest
- src/cli/mcp.ts — `canon mcp` starts the server.

Caching requirement: canon_constitution() output must be byte-identical across
calls when no rule file has changed. Do not include timestamps, durations,
counts that vary, or any ordering that depends on filesystem iteration order.
Sort deterministically by rule id.

Layering requirement: canon_constitution() is Layer A. canon_rules() is
Layer B. They are separate tools and must never be merged into one response.

Add @modelcontextprotocol/sdk as a runtime dependency — approved exception.

Acceptance:
- [ ] Two consecutive canon_constitution() calls return byte-identical strings
- [ ] Adding a rule changes the output; reordering files on disk does not
- [ ] canon_rules("src/auth/login.ts") returns only rules scoped to that path
- [ ] The server responds correctly to the MCP initialize handshake
```

---

## Issue 8 — M3c: `canon init` and `canon connect`

**Title:** `M3c: scaffolding and agent wiring`

```
Depends on: M3b (merged). Final part of SPEC.md milestone M3.

- src/cli/init.ts — creates .canon/ with constitution.md, gates.yml, empty
  rules/{active,candidate,retired}/, and an empty provenance.jsonl. If an
  AGENTS.md exists at the repo root, seed constitution.md from it and say so.
- src/cli/connect.ts — detects installed agents and writes:
  - .mcp.json with a "canon" stdio server entry
  - a Claude Code SessionStart hook calling `canon rules`
  - a .pre-commit-config.yaml entry running `canon check --fast`
  - .github/workflows/canon.yml running `canon check` on PRs

Fail-open requirement: if the canon binary is not resolvable when a hook runs,
the hook prints a warning to stderr and exits 0. The user's agent must keep
working. Add a test that simulates this.

connect must be idempotent: running it twice produces no duplicate entries.

Acceptance:
- [ ] `canon init` on an empty repo creates the full .canon/ tree
- [ ] `canon init` twice does not overwrite an existing constitution.md
- [ ] `canon connect` twice produces identical files (idempotence test)
- [ ] Simulated missing binary: hook exits 0 with a warning
```

---

## Issue 9 — M4: Health and provenance

**Title:** `M4: provenance.jsonl, canon health, canon tidy`

```
Depends on: M3c (merged). SPEC.md milestone M4.

- src/io/provenance.ts — append-only writer. Never rewrites existing lines.
- src/core/health/ — computes every field in the health.json contract in
  SPEC.md section 4.
- src/cli/health.ts — `canon health` and `canon health --json`.
  repeat_violation_rate is printed FIRST in human-readable output.
- src/cli/tidy.ts — `canon tidy` runs dedupe + expire and prints a summary.

Privacy invariant: write test/provenance-privacy.test.ts as a property test
over generated inputs (including long file paths, long commit messages, and
strings resembling API keys) asserting that no value written to
provenance.jsonl is a string longer than 64 characters unless it matches a
hash, id, or ISO-8601 timestamp pattern.

Acceptance:
- [ ] A gate firing on day 1 and again on day 20 counts as a repeat
- [ ] canon health on a 10,000-line provenance.jsonl completes in under 2s
      (add a generated-fixture benchmark test)
- [ ] test/provenance-privacy.test.ts passes as a property test, not a single case
- [ ] canon tidy is idempotent
```

---

## Bootstrap script

Creates all nine issues and assigns only the first. Run once, from the repo root.

```bash
#!/usr/bin/env bash
set -euo pipefail

gh label create milestone --color 0E8A16 --force
gh label create blocked   --color D93F0B --force

create () {  # $1 title, $2 body-file, $3 blocked?
  if [ "$3" = "blocked" ]; then
    gh issue create --title "$1" --body-file "$2" --label milestone,blocked
  else
    gh issue create --title "$1" --body-file "$2" --label milestone
  fi
}

# Split ISSUES.md into issue-1.md … issue-9.md first, then:
create "M0: TypeScript skeleton, CLI entrypoint, CI"              issue-1.md open
create "M1a: RuleSchema, parseRule, isWeakeningRule"              issue-2.md blocked
create "M1b: dedupe, selectForPath, applyBudget, expire"          issue-3.md blocked
create "M2a: gates.yml, Violation type, stable hashing"           issue-4.md blocked
create "M2b: gate adapters, canon check, candidate generation"    issue-5.md blocked
create "M3a: candidate review TUI, promotion, rules query"        issue-6.md blocked
create "M3b: MCP stdio server"                                    issue-7.md blocked
create "M3c: canon init and canon connect"                        issue-8.md blocked
create "M4: provenance, canon health, canon tidy"                 issue-9.md blocked

gh issue edit 1 --add-assignee "@copilot"
echo "Issue 1 assigned. Merge its PR, then: gh issue edit 2 --add-assignee @copilot"
```

---

## Your loop

```
gh issue edit <n> --add-assignee "@copilot"    # start it
# wait for the PR
gh pr checks <pr>                              # CI green?
# read the PR description: acceptance boxes ticked? boundary self-review all PASS?
gh pr merge <pr> --squash
gh issue edit <n+1> --remove-label blocked --add-assignee "@copilot"
```

If a PR comes back wrong, do not fix it yourself. Comment on the PR:

```
@copilot <what is wrong> — see AGENTS.md boundary <n>. Fix it in this PR and
re-run pnpm lint && pnpm typecheck && pnpm test, then paste the output.
```
