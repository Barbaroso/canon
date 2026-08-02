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
4. **Fail-open for CANON, fail-closed for gates.** If CANON itself errors, the
   user's workflow must continue. If a gate fails, the commit is blocked.
5. **No LLM call is required for v1 core.** Rule extraction is deterministic
   (gate id + file path + template). LLM-assisted phrasing is an adapter.

## Code style

- Named exports only, no default exports.
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

- Never write file contents into `provenance.jsonl`. Hashes only.
- Never log secrets, tokens, or environment variables.
- Any rule whose effect is to disable an existing gate is rejected at
  promotion time. This is a hard invariant with a dedicated test.

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
