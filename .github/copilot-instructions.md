# Copilot Instructions

You are working autonomously. Read `AGENTS.md` and `SPEC.md` in full before
touching any file. Your assigned issue defines the scope; `SPEC.md` defines the
contract.

## Autonomous working rules

1. **Stay inside the issue.** Implement only what the assigned issue asks. If
   you believe something else is required, write it in the PR description under
   "Out of scope, noticed while working" — do not implement it.
2. **Test first for `src/core/`.** Write the failing test, then the code.
3. **Verify before you finish.** Run all four and include the real output in the
   PR description:
   ```
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
   If any fails and you cannot fix it in three attempts, open the PR as a draft
   and explain precisely what is failing and what you tried.
4. **Self-review your diff** against the eight architecture boundaries in
   `AGENTS.md`. State PASS or FAIL for each in the PR description with a
   one-line reason.
5. **No new dependencies** beyond the stack in `AGENTS.md`. If you are certain
   one is needed, do not add it — open the PR without it and explain why in the
   description.
6. **Never rewrite history**, never force-push, never touch `main`.

## Hard invariants — a PR that breaks any of these is wrong

- Only `src/rules/promote.ts` may write into `.canon/rules/active/`.
- No rule is ever auto-promoted. There is no flag, env var, or config option
  that bypasses human approval. Do not create one, even if it would make a test
  easier to write.
- `src/core/**` must not import `node:fs`, `node:http`, `node:https`, or any
  network client.
- `child_process.exec` and `execSync` must not appear anywhere in `src/`.
  Use `spawn(bin, argv, { shell: false })`. No argv element may be derived from
  gate output or from an inherited rule layer.
- A candidate's `when`, `check` and `because` are produced by a template. Text
  taken from a gate's output must never appear in any of them, in
  `constitution.md`, or in Layer A. See SPEC.md 4.1, tier T3.
- `gates.yml` has no `command`, `args`, `env`, `shell`, `cwd` or `script` key.
  If you find yourself wanting one, you have misread the spec.
- `provenance.jsonl` contains hashes, ids, closed enum members and ISO
  timestamps only. Never file contents, file paths, secrets, environment values,
  or user identifiers.
- `canon_constitution()` output is byte-identical between calls when no rules
  changed. This protects prompt caching; do not add timestamps to it.
- Injection fails open: if CANON cannot answer, the agent keeps working. Gates
  fail closed: exit 1 (violations) and exit 2 (a gate could not run) are both
  blocking. A gate that did not run is never reported as a pass.

## PR description template

Use this exact structure:

```
## What
One paragraph.

## Acceptance criteria
- [ ] <criterion from the issue> — proven by `test/path.test.ts::test name`

## Verification output
<paste real terminal output of lint, typecheck, test, build>

## Architecture boundary self-review
1. Separation of powers: PASS/FAIL — reason
2. No network in core: PASS/FAIL — reason
3. Git is the database: PASS/FAIL — reason
4. Fail-open injection / fail-closed gates: PASS/FAIL — reason
5. No LLM call in v1 core: PASS/FAIL — reason
6. Layer direction is one-way: PASS/FAIL — reason
7. Untrusted text is never an instruction, path or argv: PASS/FAIL — reason
8. Rules advise, gates enforce: PASS/FAIL — reason

## Out of scope, noticed while working
- ...
```

## When you are blocked

Do not guess and keep building. Open a draft PR, describe the ambiguity, state
the two options, recommend one, and stop.
