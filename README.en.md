# Game Architecture Advisor

English | [简体中文](README.md)

A game architecture and system-design decision skill for Unity/C#, Tuanjie, and cross-engine or Web games. It helps Codex and Claude Code compare options using evidence while keeping three boundaries intact: unknown requirements are not treated as facts, product decisions remain with the user, and no code is changed until an option is explicitly approved.

## What it does

- **Local-first evidence**: searches project material, *Game Programming Patterns*, Unity 2022.3, and Tuanjie 1.10 offline documentation before using official online documentation.
- **Hybrid retrieval**: SQLite FTS5 / BM25 retrieves local candidates; local Ollama with `bge-m3` semantically reranks them when available. Otherwise the result is explicitly marked `lexical-fallback`.
- **Adaptive clarification**: asks only questions that can change the decision, such as authority, persistence, platform, scale, performance budget, and migration constraints.
- **Decision support, not pattern forcing**: produces confirmed facts, open questions, options, trade-offs, a recommendation, a validation plan, and a precise approval request.

## What this repository does not contain

- No *Game Programming Patterns* prose, code samples, or mirror.
- No Unity or Tuanjie offline documentation, generated SQLite index, or downloaded archives.
- No local paths, accounts, tokens, keys, project code, or user data.

Reference material is downloaded and built only on your machine and excluded by `.gitignore`. Follow the upstream licenses for every source you obtain.

## Requirements

- Node.js with the built-in `node:sqlite` module; Node 24.14.0 was used for verification.
- Git to obtain a local *Game Programming Patterns* checkout.
- Optional: Ollama and `bge-m3` for semantic reranking. BM25 remains available without them.

## Initialize local knowledge

```powershell
./scripts/sync-offline-docs.ps1
./scripts/sync-game-programming-patterns.ps1
node ./scripts/build-knowledge-index.mjs
```

Pass `-Proxy` to `sync-offline-docs.ps1` if your network requires one. Rebuild the index after any source update.

## Search and validate

```powershell
node ./scripts/search-knowledge.mjs "How should an achievement system be designed?" --top 6 --json
node ./scripts/search-knowledge.mjs "Unity events and persistence" --source unity-2022.3
node ./scripts/eval-knowledge-retrieval.mjs
```

Results include the source, target runtime, local path, excerpt, lexical score, and semantic score when available. A hit is evidence, not an architecture decision; read the cited page and compare options using the skill's decision record.

## Install as a skill

Copy or symlink the entire directory, including your locally built `knowledge/` folder, to:

- Codex: commonly `%USERPROFILE%\\.codex\\skills\\game-architecture-advisor\\`
- Claude Code, per-project: `.claude/skills/game-architecture-advisor/`

Then invoke `$game-architecture-advisor` with a concrete game-system design question.

## Maintenance

- After updating local documentation or GPP, run `node ./scripts/build-knowledge-index.mjs`.
- When Ollama is unavailable, search safely falls back to BM25; do not describe that result as semantic retrieval.
- Query Unity and Tuanjie sources independently to avoid inferring an API from one runtime to the other.
