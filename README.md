# Game Architecture Advisor

[English](README.en.md) | 简体中文

面向 Unity/C#、团结引擎及跨引擎/Web 游戏的架构与系统设计决策 skill。它帮助 Codex 和 Claude Code 以证据为基础比较方案，并坚持：不把未知条件当事实、不替用户作产品决定、在用户明确批准前不修改代码。

## 能力

- **本地优先证据**：先检索项目资料、*Game Programming Patterns*、Unity 2022.3 与团结 1.10 离线文档；本地资料不足时才查询官方在线文档。
- **混合检索**：SQLite FTS5 / BM25 从全量本地资料找候选；本地 Ollama 的 `bge-m3` 可用时，对候选做语义重排。不可用时明确标识为 `lexical-fallback`。
- **自适应澄清**：只提出会改变结论的问题，例如权威性、存档、平台、规模、性能预算及迁移约束。
- **决策而非套模式**：输出已确认事实、待确认项、候选方案、代价、推荐理由、验证计划和明确的批准请求。

## 不包含的内容

本仓库不包含：

- *Game Programming Patterns* 的正文、代码示例或任何镜像；
- Unity / 团结离线文档、构建后的 SQLite 索引或下载归档；
- 任何本机路径、账号、令牌、密钥、项目代码或用户数据。

这些资料仅通过脚本在你的机器上下载、构建并由 `.gitignore` 排除。请遵守上游资料的许可条款。

## 前置条件

- Node.js：需要提供内置 `node:sqlite` 模块的版本；本项目以 Node 24.14.0 验证。
- Git：用于获取 *Game Programming Patterns* 的本地副本。
- 可选：Ollama + `bge-m3`，用于语义重排；未安装时仍能使用 BM25。

## 初始化本地资料

```powershell
./scripts/sync-offline-docs.ps1
./scripts/sync-game-programming-patterns.ps1
node ./scripts/build-knowledge-index.mjs
```

若网络需代理，可向 `sync-offline-docs.ps1` 传入 `-Proxy` 参数。资料更新后重新执行索引构建命令。

## 查询与验证

```powershell
node ./scripts/search-knowledge.mjs "成就系统如何设计" --top 6 --json
node ./scripts/search-knowledge.mjs "Unity 事件与持久化" --source unity-2022.3
node ./scripts/eval-knowledge-retrieval.mjs
```

查询输出会给出资料来源、目标运行时、文件路径、摘要、词法分数和可用时的语义分数。命中结果是证据，不是架构决定；应先阅读原页，再按 skill 的决策模板比较方案。

## 安装为 skill

将整个目录（包括你自行创建的 `knowledge/`）复制或链接到：

- Codex：通常为 `%USERPROFILE%\\.codex\\skills\\game-architecture-advisor\\`
- Claude Code（项目级）：`.claude/skills/game-architecture-advisor/`

然后以 `$game-architecture-advisor` 调用它，并提供具体的游戏系统设计问题。

## 维护

- 更新离线文档或 GPP 后，运行 `node ./scripts/build-knowledge-index.mjs`。
- 若 Ollama 未运行，查询会安全降级为 BM25；不要将降级结果表述为语义检索结果。
- 对 Unity 与团结差异，分别查询对应来源，避免将一个运行时的 API 推断到另一个运行时。
