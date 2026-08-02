# PROMPTS.md — Steering the coding agent

CANON is built by the GitHub Copilot coding agent: one issue in, one PR out.
This file is the human's side of that loop. Copy blocks verbatim.

---

## Starting an issue

```bash
gh issue edit <n> --repo Barbaroso/canon --remove-label blocked --add-assignee "@copilot"
```

One issue at a time. **Take the next issue from the order column in
`ISSUES.md`, not by issue number** — the numbers stopped matching the running
order when M3d, M3e and M3f were added in SPEC v0.3.

Every issue after the first carries `blocked`. Removing that label is the
deliberate act; do it only when the dependency has merged.

---

## Two things you have to click

The agent's loop is not fully hands-off, by design:

- **"Approve and run workflows"** appears on every agent PR. Workflow runs from
  a bot are held until a human releases them. Nothing runs until you click it.
- **The `human-reviewed` label is the merge gate.** There is no approving
  review to give: GitHub bars whoever triggered the agent from approving the
  resulting PR, so on a one-person repository a required approval is a
  deadlock. The label is the substitute, and `guard.yml` hardens it — it checks
  that a real user account applied it, and that it was applied *after* the head
  commit was pushed. Pushing another commit invalidates the review, which is
  the point.

If the PR touches `.github/workflows/`, `SPEC.md`, `AGENTS.md`, `package.json`,
`src/gates/`, `src/io/layer/`, `src/core/redact/` or `src/rules/promote.ts`, it
also needs `security-reviewed`.

```bash
gh pr edit <pr> --repo Barbaroso/canon --add-label human-reviewed
```

---

## Reviewing the PR

Check all five before merging:

1. CI is green — `gh pr checks <pr>`
2. The PR description contains **real pasted terminal output** for
   `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
3. Every acceptance checkbox from the issue is ticked **and names the test that
   proves it**
4. The architecture boundary self-review lists **eight** entries, all PASS
5. The diff touches nothing outside the issue's stated files

If any of the five is missing, do not merge. Use a prompt below.

Then spend two minutes on the part that is not mechanical: pick two ticked
acceptance criteria at random and read the tests they name. A ticked box and a
passing suite are claims about the code. Only the test body is evidence, and
the failure mode you are looking for — a test that asserts the function was
called rather than that it did the right thing — looks green from every other
angle.

---

## Recovery prompts

**No verification output**

```
@copilot The PR description has no verification output. Run these four and
paste the real terminal output into the PR description:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

Do not summarise. Paste the actual output.
```

**Acceptance criteria claimed but not proven**

```
@copilot Go through the acceptance criteria in the linked issue one by one.
For each, name the test file and test name that proves it, and paste that
test's source.

If a criterion has no test, write "NOT COVERED" for it. Give me the gap list
first — do not write the missing tests yet.
```

**Scope creep**

```
@copilot This PR contains work outside the scope of the linked issue.

List everything you added that the issue did not ask for. Remove it in a single
commit. Then re-run the four verification commands and paste the output.
```

**Architecture boundary violated**

```
@copilot This violates AGENTS.md architecture boundary <n>: <one line saying
what specifically is wrong and which file>.

Fix it in this PR. Do not work around it by relaxing the test — the boundary is
the requirement, the test only observes it. Re-run the four commands and paste
the output.
```

**It weakened a test to make it pass**

```
@copilot You changed a test instead of fixing the code. Revert the test to its
previous assertions and fix the implementation.

If you believe the test itself was wrong, explain why in a comment and stop —
do not change it unilaterally.
```

**Stuck in a patch loop**

```
@copilot Stop patching. In plain language, tell me:
1. What the failing test expects
2. What the code actually does
3. Which of the two is wrong

Propose one fix. Do not implement it until I reply.
```

**Wants a new dependency**

```
@copilot Justify this dependency in three lines: what it does, what it
replaces, and its install size. Then show what the code looks like without it.
Do not add it until I reply.
```

**Auto-promotion appeared anywhere**

```
@copilot You added a way to promote a rule without human approval. Remove it
entirely — flag, env var, config key, test helper, all of it.

Tests must call promote() directly rather than using a bypass. This invariant
is the product; there is no convenience exception.
```

**Untrusted text reached an instruction, a path, or an argv** *(boundary 7)*

```
@copilot Text from <gate output | a fetched layer | a filename | model output>
reaches <the injected context | a filesystem path | a process argument> in
<file:line>.

Per SPEC.md 4.1 that text is tier T3. It may be stored in observed[] and shown
to a human. It may never be interpolated into an instruction, a path, or an
argv.

Route it through the sanitiser and the template. If the template has no field
for what you need, say so and stop — do not widen the template to fit the text.
```

**A rule was treated as an enforcement control** *(boundary 8)*

```
@copilot This treats a rule as if it enforced something. Rules advise; gates
enforce.

advisoryWeakeningWarning returns a warning and must never block, gate, or
change control flow. The control that actually stops the enforced set from
shrinking is gates.lock, and it is enforced in CI.

Remove the blocking behaviour and add a test asserting the warning path does
not affect the exit code.
```

**Fail-open in the wrong place** *(boundary 4)*

```
@copilot The fail-open guarantee applies to rule injection only: if the daemon
is unreachable, the coding agent keeps working.

It does not apply to gates. A gate that cannot run is inconclusive, not
passing — exit 2, state "skipped" or "error" in provenance, and excluded from
health metrics. <file:line> returns success for a gate that did not run.

Fix it so a missing gate binary can never make the run look clean.
```

**A checked-in string became executable**

```
@copilot This lets a value from a config file, a rule, or a fetched layer decide
what gets executed: <file:line>.

Gate execution is not user-configurable. The adapter is chosen from a closed
enum and builds its own argv in TypeScript, spawned with shell: false.

If a use case seems to need an escape hatch, that use case is the vulnerability
being prevented. Describe it in a comment instead of implementing it.
```

---

## Dogfooding — the go/no-go

Run this **as soon as `canon check` generates candidates**, which is when
Issue #5 (M2b) merges. `canon init` does not exist until Issue #8, so before
that you create `.canon/` by hand — a `gates.yml`, an empty `constitution.md`
and an empty `rules/active/` is enough.

Do not save it for later because it is more convenient later. Open a new issue
with this body:

```
Point CANON at its own repository.

Run: canon check

Report in a comment:
- The real violations found
- Which candidate rules were generated, with their full YAML
- For each candidate, your honest judgement: would a human approve this, or is
  it noise?

Do not fix anything. Do not promote anything. I want to see whether the loop
produces rules worth approving before we build anything else on top of it.
```

This is the single most informative thing you can run, and it is the only task
in the queue that can return a negative result. Every other milestone tells you
whether the code works. This one tells you whether the *idea* works.

If the candidates are noise, the product does not work yet, and M3 and M4 do
not fix that — layering noise across repositories and then measuring it makes
the failure more expensive, not less. Stop and change the candidate generator.

---

## Rules of engagement

- One issue at a time. Merge before starting the next.
- Never accept "it should work" — always require pasted output.
- **Never fix a PR yourself.** Comment and let the agent fix it. If you patch
  it by hand the loop never closes, the agent never sees the correction, and
  the same mistake returns in the next issue with your fix silently reverted.
- If a PR needs more than three rounds of comments, close it, split the issue
  in two, and start over. The issue was too big.
- Secrets never go in the repository. `.copilotignore` does not bind the coding
  agent — it excludes files from completions and chat, and the agent can still
  read and modify them.
