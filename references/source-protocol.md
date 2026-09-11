# Source Protocol

## Local-first order

1. Search the project being discussed: source, tests, performance captures, ADRs, and build configuration.
2. Search `knowledge/game-programming-patterns/` for relevant pattern chapters if the user has placed a lawful local checkout there.
3. Search `knowledge/official/unity-2022.3/` or `knowledge/official/tuanjie-1.10/` for documentation matching the actual target runtime.
4. Only if these sources lack the needed answer, browse the current official documentation.

Use `node scripts/search-knowledge.mjs` for the first local search. It returns ranked source paths, headings, excerpts, scores, and whether semantic reranking ran. Use `rg` only to inspect a returned file more deeply. Report the document path and heading or API page that supports a material claim.

## Online fallback origins

- Unity 2022.3: `https://docs.unity3d.com/2022.3/`
- Tuanjie 1.10: `https://docs.unity.cn/cn/tuanjiemanual/`

Do not use forum posts, tutorials, package marketing pages, or memory as authority for engine-specific behavior when an official source can answer it. State the exact online URL and version in the evidence record.

## Local layout

```text
knowledge/
├─ official/
│  ├─ unity-2022.3/        # expanded official Unity Documentation ZIP
│  └─ tuanjie-1.10/        # expanded official Tuanjie Documentation ZIP
└─ game-programming-patterns/ # user-supplied local source; not distributed
```

The offline archives are reference data, not generated project assets. Keep them out of version control. Their source URLs and retrieval timestamp are recorded in `knowledge/official/sources.json`.

`knowledge/index.sqlite` and `knowledge/index-manifest.json` are generated search artifacts. Rebuild them with `node scripts/build-knowledge-index.mjs` whenever GPP or either offline documentation source changes.
