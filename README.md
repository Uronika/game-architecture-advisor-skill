# Game Architecture Advisor

[English](README.en.md) | 简体中文

为 **Unity/C#、团结引擎及跨引擎/Web 游戏**提供架构与系统设计决策支持的 skill，可同时安装到 Codex 和 Claude Code。

它不是“看到问题就推荐设计模式”的知识库，也不会替你拍板产品规则。它会先厘清那些真正会改变设计的约束，再给出可追溯的证据与可比较的方案；**未经你的明确批准，绝不修改代码。**

## 它适合解决什么问题

当你正面对这类问题时调用它：

- 成就、任务、经济、战斗、存档或配置系统的边界应如何划分？
- 事件通知、事件队列、直接依赖、数据驱动，哪种方式符合当前项目的约束？
- Unity 与团结的 API、生命周期或平台能力差异会如何影响设计？
- 某个性能、扩展性或迁移问题，是否真的值得引入新的架构层？

它不会用一个模式名代替设计。它会把模式放回问题的上下文：要解决的变化是什么、代价由谁承担、什么条件下应选择另一种方案。

## 一次决策如何进行

```text
具体工程问题
    ↓
检查项目现状；只提出会改变结论的澄清问题
    ↓
检索本地证据：GPP + Unity + 团结文档
    ↓
已确认事实 / 未确认项 / 候选方案 / 代价与风险
    ↓
你明确批准其中一个方案
    ↓
才进入实现
```

本地检索分两层进行：SQLite FTS5 / BM25 先从全量资料中选出候选，已运行本地 Ollama 且安装 `bge-m3` 时，再对前 24 个候选进行语义重排。Ollama 不可用时会安全降级为词法检索，并明确标记为 `lexical-fallback`，不会伪装成语义检索。

## 第一次使用

### 1. 准备本地资料

```powershell
./scripts/sync-offline-docs.ps1
./scripts/sync-game-programming-patterns.ps1
node ./scripts/build-knowledge-index.mjs
```

网络需代理时，可为 `sync-offline-docs.ps1` 提供 `-Proxy` 参数。更新资料后，重新运行索引构建命令即可。

### 2. 试一次查询

```powershell
node ./scripts/search-knowledge.mjs "成就系统如何设计" --top 6 --json
node ./scripts/search-knowledge.mjs "Unity 事件与持久化" --source unity-2022.3
node ./scripts/eval-knowledge-retrieval.mjs
```

查询结果会带回来源、目标运行时、路径、摘要和检索分数。它们是设计讨论的证据，而不是自动生成的架构结论；skill 会据此继续澄清并比较方案。

### 3. 安装为 skill

将整个目录（包括自行创建的 `knowledge/`）复制或链接到：

- Codex：通常为 `%USERPROFILE%\\.codex\\skills\\game-architecture-advisor\\`
- Claude Code（项目级）：`.claude/skills/game-architecture-advisor/`

随后以 `$game-architecture-advisor` 提出具体问题即可。

## 你会得到什么

例如你问“成就系统如何设计”，它不会直接塞给你一个 Observer。它会先确认成就是离线还是服务端权威、是否需要跨设备同步、触发频率、是否要兼容已有存档；然后将“同步通知”“事件队列”“规则评估服务”等可选方案，连同扩展性、调试、存档一致性与实现复杂度一起呈现。

每次有意义的结论都应落到一份决策记录中：

- 哪些事实已经被证实，哪些仍待确认；
- 考虑过哪些方案，以及为什么没有选它们；
- 已选方案的代价、风险与验证方式；
- 等待你批准的具体行动。

## 环境要求

- Node.js：需提供内置 `node:sqlite`；本仓库以 Node 24.14.0 验证。
- Git：用于取得 *Game Programming Patterns* 的本地副本。
- 可选：Ollama 与 `bge-m3`，用于语义重排；未安装时仍可使用 BM25。

## 版权与隐私

这个仓库**不包含** *Game Programming Patterns* 的正文或代码示例，也不包含 Unity / 团结离线文档、下载归档、生成的 SQLite 索引、本机路径、账号、令牌、项目代码或用户数据。

所有参考资料只在你的电脑上通过脚本获取并构建，且由 `.gitignore` 排除。请遵守每项上游资料适用的许可条款。

## 维护

- 更新离线文档或 GPP 后，运行 `node ./scripts/build-knowledge-index.mjs`。
- Ollama 不运行时，结果会降级为 BM25；请勿将其表述为语义检索。
- Unity 与团结的差异应分别查询对应来源，避免把一个运行时的 API 推断到另一个运行时。
