# Hybrid Local Retrieval

## Data flow

```text
Engineering question
  -> query expansion for known game-system vocabulary
  -> SQLite FTS5 / BM25 over GPP + Unity + Tuanjie local pages
  -> top 80 candidates
  -> bge-m3 semantic rerank of the top 24 through local Ollama, when available
  -> ranked evidence with source, runtime, path, and excerpt
```

The index is deliberately lexical-first. It covers the full local corpus without precomputing a large vector for every official documentation page. When Ollama is available, semantic ranking is applied only to the BM25 candidate set. This improves wording tolerance but cannot rescue a query with no useful lexical candidate; query expansion and a targeted follow-up query remain important.

## Build and query

```powershell
node scripts/build-knowledge-index.mjs
node scripts/search-knowledge.mjs "成就系统如何设计" --top 6 --json
node scripts/search-knowledge.mjs "Unity 事件与持久化" --source unity-2022.3
node scripts/eval-knowledge-retrieval.mjs
```

Set `GAME_ARCH_OLLAMA_URL` or `GAME_ARCH_EMBED_MODEL` only when a non-default local Ollama endpoint or model is intentionally used. The normal model is `bge-m3` at `http://127.0.0.1:11434`.

The index builder requires a Node runtime that provides the built-in `node:sqlite` module. This installation was verified with Node `24.14.0`. Rebuild the index after synchronizing any local documentation source.

## Result discipline

- `hybrid-rerank` means BM25 retrieved candidates and local bge-m3 reranked them.
- `lexical-fallback` means no semantic ranking was used. The result exposes the Ollama error when it was attempted.
- A result is evidence, not a decision. Read the cited page or GPP section before recommending an option.
- Use the source and runtime fields to avoid applying Unity behavior to Tuanjie or Web builds.
