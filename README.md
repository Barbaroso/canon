# CANON

**Your repo stops making the same mistake twice.**

AI coding agents write clean code fast. They do not learn from the failures that
code causes. A scanner flags a missing sanitizer, you fix it, and tomorrow the
agent writes the same pattern again — in a different file, in a different tool.

CANON closes that loop. When a deterministic gate fails, CANON turns the failure
into a rule, stores it in your repo, and injects it into every future session —
whatever coding agent you happen to be using.

```
spec → generate → gate → violation → rule → back into the next session
                                       ↑_________________________|
```

> **Status:** early. v0.1 is being built in the open. The core loop works or it
> doesn't — see [SPEC.md](./SPEC.md) for exactly what is and isn't implemented.

---

## What it is not

- Not a code reviewer. Bring your own (CodeRabbit, Greptile, Semgrep, whatever).
- Not a vector index. Your agent's own search is better at code than embeddings.
- Not a hosted service. Nothing leaves your machine.
- Not another rules file to maintain by hand.

CANON is the wire between the gates you already run and the agents you already
use.

## Install

```bash
npm install -g canon-cli    # placeholder — not published yet
canon init
canon connect               # detects your agents, writes hooks + MCP config
```

## How it works

1. **Gates run** on save, on commit, and in CI — Semgrep, `tsc`, tests, secret
   scanning. Whatever you already have.
2. **A failure becomes a candidate rule**, generated deterministically from the
   gate id and the file scope. No LLM in this path.
3. **You approve it** with `canon review`. One keypress. Nothing activates
   without a human.
4. **It gets injected** at the next session start, scoped to the files being
   touched, through an MCP server any agent can read.

Everything lives in `.canon/` in your repository. Plain YAML and JSONL. Git is
the database — so review, history, rollback, and access control come for free.

## Design commitments

| Commitment | Why it matters |
|---|---|
| Local-first, no network in core | Your code never leaves the machine |
| Git is the only store | No database, no sync service, no vendor lock |
| Human approval is mandatory | An auto-writing rule engine is a supply-chain risk |
| Every active rule links to a gate | Rules you cannot check mechanically become noise |
| Hard rule budget | Context is a scarce resource; more instructions can hurt |
| Fail-open for CANON, fail-closed for gates | A broken tool must never block your work |

## The one metric

**Repeat violation rate** — how often the same gate fires again within 30 days.

If CANON does not move that number, CANON is not working. Every other metric in
`canon health` is secondary.

## Roadmap

- **v0.1** — TypeScript/JavaScript, Semgrep + tsc + vitest + gitleaks, MCP stdio
- **v0.2** — model scorecard: which model actually passes which gate class here
- **v0.3** — additional languages, team rule libraries
- Not planned: hosted dashboard, LLM gateway, code review engine

## Contributing

Read [AGENTS.md](./AGENTS.md) first — it is the contract for both humans and
agents working in this repo. Contributions are accepted under the DCO; sign your
commits with `git commit -s`.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

Copyright © 2026 Barbaros

---

*CANON is an independent project and is not affiliated with, endorsed by, or
sponsored by any AI vendor or code-hosting provider mentioned in this document.*
