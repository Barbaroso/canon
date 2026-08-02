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
- Not a hosted service. There is no CANON server and no telemetry.
- Not another rules file to maintain by hand.

CANON is the wire between the gates you already run and the agents you already
use.

## Install

```bash
npm install -g canon-cli    # placeholder — not published yet
canon init
canon connect               # shows what it would write; nothing is changed
canon connect --yes         # writes the MCP config, hooks and CI job
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

Your repo's rules live in `.canon/` and are committed to git, so review, history,
rollback and access control come for free. Rules you want in *every* project are
copied — never moved — to a personal layer in `~/.canon/`, and a team can share a
third layer that is just an ordinary git repo. A repo rule always wins over an
inherited one; an inherited one can never override a repo rule. See
[SPEC.md §4.4](./SPEC.md).

## Where your code goes

Nowhere. CANON reads your repo, runs the gates you already run, and writes plain
files back into `.canon/`. There is no CANON server, no account, and no
telemetry.

Two things do touch the network, both only when you ask for them:

- **Your gates.** Semgrep, `tsc`, vitest and gitleaks are yours; CANON only
  reads their output. Whatever they do, they were already doing.
- **A shared rule layer**, if you configure one. It is a git repo you name
  explicitly. It must be pinned to a commit sha recorded in `canon.lock`, it is
  fetched read-only, and its contents can never suppress one of your repo's own
  rules.

Rules from a shared layer are *text that reaches your model with high trust*, so
CANON treats them as untrusted input: normalised, validated, labelled with their
source layer, and never able to change which gates run. The threat model is
written down in [SPEC.md §4.1](./SPEC.md) rather than left implied.

## Design commitments

| Commitment | Why it matters |
|---|---|
| Local-first, no network in core | There is no service to send your code to |
| Git is the only store | No database, no sync service, no vendor lock |
| Human approval is mandatory | An auto-writing rule engine is a supply-chain risk |
| Every active rule links to a gate | Rules you cannot check mechanically become noise |
| Hard rule budget | Context is a scarce resource; more instructions can hurt |
| Rules advise, gates enforce | No rule can switch a check off; only a reviewed `gates.lock` diff can |
| Injection fails open, gates fail closed | A broken tool never blocks you — but a gate that *could not run* is never a pass |

## The one metric

**Repeat violation rate** — how often the same gate fires again within 30 days.

If CANON does not move that number, CANON is not working. Every other metric in
`canon health` is secondary.

## Roadmap

Release versions, not spec versions — the build spec is currently at
[v0.3](./SPEC.md) and describes what ships as release v0.1.

- **v0.1** — TypeScript/JavaScript, Semgrep + tsc + vitest + gitleaks, MCP
  stdio, layered rules (personal → org → repo)
- **v0.2** — model scorecard: which model actually passes which gate class here
- **v0.3** — signed rule layers (sigstore), additional languages
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
