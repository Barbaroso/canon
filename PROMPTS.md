# PROMPTS.md — Steering the coding agent

CANON is built by the GitHub Copilot coding agent: one issue in, one PR out.
This file is the human's side of that loop. Copy blocks verbatim.

---

## Starting an issue

```bash
gh issue edit <n> --remove-label blocked --add-assignee "@copilot"
```

Do not start more than one issue at a time. Issues 2–9 depend on earlier ones
and will produce conflicting PRs if run in parallel.

---

## Reviewing the PR

Before merging, check all four:

1. CI is green — `gh pr checks <pr>`
2. The PR description contains **real pasted terminal output** for
   `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
3. Every acceptance checkbox from the issue is ticked **and names the test that
   proves it**
4. The architecture boundary self-review lists five entries, all PASS

If any of the four is missing, do not merge. Use a prompt below.

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

---

## Dogfooding — run this after Issue 8 merges

Open a new issue with this body:

```
Point CANON at its own repository.

Run: canon init && canon check

Report in a comment:
- The real violations found
- Which candidate rules were generated, with their full YAML
- For each candidate, your honest judgement: would a human approve this, or is
  it noise?

Do not fix anything. Do not promote anything. I want to see whether the loop
produces rules worth approving before we build anything else on top of it.
```

This is the single most informative thing you can run. If the candidates are
noise, the product does not work yet and no further milestone will fix that.

---

## Rules of engagement

- One issue at a time. Merge before starting the next.
- Never accept "it should work" — always require pasted output.
- Never fix a PR yourself. Comment and let the agent fix it, or the loop never
  closes and the same mistake returns in the next issue.
- If a PR needs more than three rounds of comments, close it, split the issue
  in two, and start over. The issue was too big.
