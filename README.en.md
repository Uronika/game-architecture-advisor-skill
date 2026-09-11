# Game Architecture Advisor

English | [简体中文](README.md)

An architecture and system-design decision skill for **Unity/C#, Tuanjie, and cross-engine/Web games**. Install it in either Codex or Claude Code.

This is not a pattern recommendation database, and it does not make product decisions for you. It identifies the constraints that actually change the design, gathers traceable evidence, and presents comparable options. **It never changes code before you explicitly approve a direction.**

## When to use it

Bring it questions such as:

- How should an achievement, quest, economy, combat, save, or configuration system be bounded?
- Should this project use notifications, an event queue, direct dependencies, or a data-driven approach?
- How do Unity and Tuanjie differences in API, lifecycle, or platform capabilities affect the design?
- Is a performance, extensibility, or migration concern worth adding another architectural layer?

It does not use a pattern name as a substitute for design. It puts patterns back into context: what change they address, who pays their cost, and when another option is more appropriate.

## How a decision is made

```text
Concrete engineering question
    ↓
Inspect the project; ask only questions that can change the answer
    ↓
Retrieve local evidence: GPP + Unity + Tuanjie documentation
    ↓
Confirmed facts / open questions / options / trade-offs and risks
    ↓
You explicitly approve one option
    ↓
Only then begin implementation
```

Local retrieval has two stages. SQLite FTS5 / BM25 selects candidates from the full local corpus. If local Ollama is running with `bge-m3`, the top 24 candidates are semantically reranked. Without Ollama, the search safely falls back to lexical retrieval and is explicitly marked `lexical-fallback`; it is never presented as semantic retrieval.

## Quick start

### 1. Build your local knowledge base

```powershell
./scripts/sync-offline-docs.ps1
./scripts/sync-game-programming-patterns.ps1
node ./scripts/build-knowledge-index.mjs
```

If your network needs a proxy, pass `-Proxy` to `sync-offline-docs.ps1`. Rebuild the index whenever the source material changes.

### 2. Try a search

```powershell
node ./scripts/search-knowledge.mjs "How should an achievement system be designed?" --top 6 --json
node ./scripts/search-knowledge.mjs "Unity events and persistence" --source unity-2022.3
node ./scripts/eval-knowledge-retrieval.mjs
```

Results include the source, target runtime, path, excerpt, and retrieval scores. They are evidence for the discussion, not automatic architecture decisions; the skill uses them to clarify and compare choices.

### 3. Install the skill

Copy or symlink the entire directory, including your locally built `knowledge/` folder, to:

- Codex: commonly `%USERPROFILE%\\.codex\\skills\\game-architecture-advisor\\`
- Claude Code, per project: `.claude/skills/game-architecture-advisor/`

Then ask `$game-architecture-advisor` a concrete system-design question.

## What you get

Ask “How should an achievement system be designed?” and the skill will not simply hand you Observer. It first establishes whether achievements are offline or server-authoritative, whether they synchronize across devices, expected trigger volume, and save compatibility. It then compares options such as synchronous notifications, event queues, and a rule-evaluation service against extensibility, debugging, save consistency, and implementation complexity.

Meaningful conclusions are captured in a decision record:

- confirmed facts and remaining unknowns;
- options considered, including why they were rejected;
- the chosen option's costs, risks, and validation plan;
- the specific action waiting for your approval.

## Requirements

- Node.js with built-in `node:sqlite`; this repository was verified with Node 24.14.0.
- Git to obtain a local checkout of *Game Programming Patterns*.
- Optional: Ollama and `bge-m3` for semantic reranking. BM25 still works without them.

## Copyright and privacy

This repository contains **no** *Game Programming Patterns* prose or code samples, Unity or Tuanjie offline documentation, downloaded archives, generated SQLite indexes, local paths, accounts, tokens, project code, or user data.

All reference material is fetched and built only on your own machine, and is excluded by `.gitignore`. Follow the licenses that apply to every upstream source.

## Maintenance

- After updating local documentation or GPP, run `node ./scripts/build-knowledge-index.mjs`.
- If Ollama is unavailable, the result falls back to BM25. Do not describe it as semantic retrieval.
- Query Unity and Tuanjie sources separately; do not infer one runtime's API from the other.
