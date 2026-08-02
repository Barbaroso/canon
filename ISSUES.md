# ISSUES.md — the build queue

CANON is built by the GitHub Copilot coding agent, one issue at a time. One
issue in, one pull request out.

**The issue body on GitHub is the authoritative text.** This file is an index
and a running order. It deliberately does not copy the issue bodies — an
earlier version of this file did, and it sat at v0.1 wording for two spec
revisions while the live issues moved on. If the two ever disagree, the live
issue wins and this file is the bug.

The queue was bootstrapped once, on 2026-11-04. There is no bootstrap script
here any more; the issues exist. Editing them is `gh issue edit <n>
--body-file`.

---

## Running order

Issue numbers stopped matching milestone order when M3d, M3e and M3f were
added in SPEC v0.3. **Follow the order column, not the issue number.**

| # | Issue | Milestone | Depends on |
|---|---|---|---|
| 1 | [#1](https://github.com/Barbaroso/canon/issues/1) | M0 — TypeScript skeleton, CLI entrypoint, CI | — |
| 2 | [#2](https://github.com/Barbaroso/canon/issues/2) | M1a — Result, text schema, RuleSchema, parseRule, advisory weakening warning | #1 |
| 3 | [#3](https://github.com/Barbaroso/canon/issues/3) | M1b — dedupe, selectForPath, applyBudget, expire with tombstones | #2 |
| 4 | [#4](https://github.com/Barbaroso/canon/issues/4) | M2a — gates.yml adapter enum, gates.lock, Violation, redaction | #3 |
| 5 | [#5](https://github.com/Barbaroso/canon/issues/5) | M2b — semgrep/tsc/vitest/gitleaks adapters, canon check, candidates | #4 |
| 6 | [#6](https://github.com/Barbaroso/canon/issues/6) | M3a — candidate review TUI, promotion, rules query | #5 |
| 7 | [#7](https://github.com/Barbaroso/canon/issues/7) | M3b — MCP stdio server | #6 |
| 8 | [#8](https://github.com/Barbaroso/canon/issues/8) | M3c — canon.yml, canon.lock, `resolve()`, canon init | #7 |
| 9 | [#11](https://github.com/Barbaroso/canon/issues/11) | M3d — remote layer fetch, pin verification, personal layer integrity | #8 |
| 10 | [#12](https://github.com/Barbaroso/canon/issues/12) | M3e — wire `resolve()` into injection, `canon promote --to personal` | #11 |
| 11 | [#13](https://github.com/Barbaroso/canon/issues/13) | M3f — canon connect preview-by-default, canon disconnect | #12 |
| 12 | [#9](https://github.com/Barbaroso/canon/issues/9) | M4 — provenance.jsonl, canon health, canon tidy | #13 |

Every issue except #1 carries the `blocked` label. Remove it when its
dependency has merged, and only then. The label is the only thing stopping
someone assigning #7 on a Friday afternoon to a repo that has no rule loader.

---

## Why the milestones are cut this small

The coding agent's output quality tracks the precision of the issue
description, and it degrades sharply on tasks that need original architectural
judgment. So each issue names exact file paths, exact function signatures,
exact commands, and a checkbox list of acceptance criteria that can be
mechanically verified.

The second reason is review. One issue produces one pull request, and the agent
cannot split its work across several. A milestone worth three weeks of work
becomes a single unreviewable diff. M3 was one issue in v0.1; it is now four
(M3c, M3d, M3e, M3f), because the layer system turned out to contain the
project's entire attack surface and a 2000-line PR is where security review
goes to die.

---

## Changes since v0.1

The queue was rewritten for SPEC v0.3. If you have an in-flight branch, note
what moved:

- **M3c was split into four.** v0.1's M3c was "canon init, layered rule
  inheritance, canon connect" — three unrelated features, one of which
  (inheritance) is the highest-risk code in the project. Now: M3c is pure
  resolution logic with no I/O, M3d is the fetch path, M3e is the wiring, M3f
  is `canon connect`.
- **M3e is new and is not optional.** Before it existed, `resolve()` was
  written in M3c and never called from a production path, which left goal **G4**
  — "a rule survives a change of project" — silently unimplemented. It was
  possible to complete every milestone in the v0.1 queue and ship a tool that
  did not do the thing the layer system exists for.
- **M2a lost `command:`.** The gate registry names an adapter from a closed
  enum. It no longer carries a shell command string. See the issue for why.
- **M1a's `isWeakeningRule` became `advisoryWeakeningWarning`.** It returns a
  warning and never blocks. The enforcement control is `gates.lock`.
- **M4's provenance dropped per-file records.** `path_hash` was 16 unsalted
  bits committed to a public repository.

---

## Rules of engagement

Assign one issue at a time. Wait for the PR. Then:

1. Is CI green?
2. Does every acceptance checkbox in the PR description correspond to something
   real in the diff? Check two at random against the code.
3. Did the PR touch a file outside its stated scope?
4. Read the boundary self-review section. Take it as a claim, not as evidence.

If the PR is wrong, **do not fix it yourself.** Comment on it. `PROMPTS.md`
has the recovery prompts.

To merge, apply the `human-reviewed` label — that is the required status check.
Touching a sensitive path additionally requires `security-reviewed`. The gate
is a label rather than an approving review because GitHub bars the person who
triggered the agent from approving the resulting PR, which deadlocks a
single-maintainer repository. Both checks verify that a human account applied
the label, and that it was applied *after* the head commit was pushed.
