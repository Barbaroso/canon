# AGENTS.md

## Project

CANON is a local-first quality feedback loop for AI-assisted codebases.
When a deterministic gate (SAST, tests, types, secrets) fails, CANON turns
that failure into a machine-checkable rule stored in the repo. On the next
session — with any coding agent — that rule is injected so the same mistake
is not repeated.

CANON is **not** a code reviewer, **not** a vector index, **not** a hosted
service. It is the feedback wire between existing gates and existing agents.

## Tech stack

- Language: TypeScript (strict), Node 22 LTS
- Package manager: pnpm 9
- CLI framework: commander
- MCP: `@modelcontextprotocol/sdk` (stdio transport only in v1)
- Schema validation: zod
- Test: vitest
- Lint/format: biome
- Build: tsup (single ESM bundle + shebang bin)

## Commands

```bash
pnpm install
pnpm dev            # tsx watch on src/cli/index.ts
pnpm build          # tsup -> dist/
pnpm test           # vitest run
pnpm test:watch
pnpm lint           # biome check .
pnpm typecheck      # tsc --noEmit
```

Run a single test: `pnpm vitest run src/rules/promote.test.ts`

## Architecture boundaries — do not violate

1. **Separation of powers.** Code-writing agents may READ `.canon/` via MCP.
   Only the gate runner may WRITE to `.canon/rules/`. There is no code path
   where an LLM response is written directly into `rules/active/`.
2. **No network in the core.** `src/core/**` must not import any HTTP client.
   Network access is confined to `src/adapters/**` and is opt-in.
3. **Git is the database.** Do not add SQLite, Postgres, or any vector store.
   State lives in `.canon/` as plain files.
4. **Fail-open for injection, fail-closed for gates.** If CANON cannot answer
   an MCP call or a `SessionStart` hook, the coding agent keeps working. If a
   gate fails *or cannot run*, the commit is blocked — exit 1 and exit 2 are
   both blocking. A gate that did not run is never a pass.
5. **No LLM call is required for v1 core.** Rule extraction is deterministic
   (gate id + file path + template). LLM-assisted phrasing is an adapter.
6. **Layer direction is one-way.** Rule resolution is repo > org > personal.
   A repo rule may suppress an inherited one; a personal or org rule may never
   suppress a repo rule. `~/.canon/cache/` is read-only — no code path writes
   to a fetched layer.
7. **Untrusted text is never an instruction, a path, or an argv.** Gate output,
   inherited layer prose, fetched filenames and model output are tier T3
   (SPEC.md 4.1). A T3 string is never shell-executed, never used to build a
   filesystem path, and never reaches Layer A. Candidate `check` text comes
   from the adapter's phrase table, never from the gate's message.
8. **Rules advise, gates enforce.** No rule, from any layer, changes what runs.
   Only `gates.yml` decides that, and shrinking the enforced set requires a
   visible `gates.lock` diff. Do not add a config key, flag or rule field that
   can disable a gate.

## Code style

- Named exports only, no default exports. The single exception is a build or
  test config file that the tool itself requires to default-export
  (`vitest.config.ts`, `tsup.config.ts`, `biome` has none). Nothing under
  `src/` is exempt.
- Errors: return `Result<T, E>` from core functions; only the CLI layer throws.
- No `any`. Use `unknown` and narrow with zod.
- File names kebab-case; types PascalCase; functions camelCase.
- Every public function in `src/core/` gets a unit test in the same folder.
- Keep files under 300 lines; split by responsibility, not by type.

## Testing

- `src/core/**` — unit tests, no filesystem, pure functions where possible.
- `src/io/**` — integration tests against a temp git repo fixture.
- Every bug fix starts with a failing test.
- Do not mock the filesystem with jest-style mocks; use real temp dirs.

## Never touch

- `.canon/rules/active/` from any code path other than `src/rules/promote.ts`
- User source files. CANON reads and reports; it never edits user code.
- `provenance.jsonl` history — append only, never rewrite.

## Security rules

- Never write file contents into `provenance.jsonl`. Hashes, ids, closed enum
  members and ISO timestamps only — enforced by a closed TypeScript record
  type, not by a runtime filter.
- Never log secrets, tokens, or environment variables. Every gate adapter runs
  its message through `src/core/redact/` before that message is persisted or
  printed.
- Gate adapters build their messages from an allowlist of structured fields.
  The gitleaks adapter reads `RuleID`, `File` and `StartLine` and discards
  `Secret`, `Match` and `Line` at the parse boundary.
- Process execution is `spawn(bin, argv, { shell: false })` only.
  `child_process.exec` and `execSync` must not appear anywhere in `src/`.
- Filesystem paths for cached layers are derived from a digest, never from
  user-supplied text, and are asserted to resolve inside `~/.canon/cache/`.
- `advisoryWeakeningWarning` is a **usability aid, not a security control**.
  Do not describe it as an invariant and do not rely on it to stop anything.
  The control that stops a gate being switched off is `gates.lock`.

## PR conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- One milestone per PR. Reference the milestone id from SPEC.md.
- PRs that touch `src/rules/promote.ts` require an added test.

## Vocabulary

- **gate** — a deterministic check that returns pass/fail (semgrep, tsc, test)
- **violation** — a single gate failure with a location
- **candidate** — a proposed rule awaiting human approval
- **rule** — an approved, active, gate-linked instruction
- **promotion** — candidate -> active, requires explicit human approval
- **injection** — surfacing rules to an agent at session start
