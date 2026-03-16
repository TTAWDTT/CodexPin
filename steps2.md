- [ ] 任务 1：明确 Codex `notify` 集成范围与约束  
  要求：梳理 Codex CLI 的 `notify` 调用方式（事件类型、参数格式、触发时机），确认我们只依赖官方 `notify` 能力，不读取未文档化接口；明确支持场景（终端 / IDE / 桌面 Codex 只要共享 ~/.codex 即可共享）；记录与现有 `config.toml` 兼容的修改策略（不破坏已有 notify）。  
  验收指标：形成一份简短说明（可以是 `docs/codexpin-hook-design.md` 中的章节），清楚列出 Codex 会在何时、以何种 JSON 调用我们、我们会对现有 `notify` 做什么（覆盖 / 串联 / 保留），读完后任何开发者都能知道“不依赖 Confirmo”的技术边界。

- [ ] 任务 2：设计 CodexPin 专用状态存储结构  
  要求：定义 `~/.codexpin/codex-status/` 的目录与文件结构，包括：  
  - 汇总文件：`status.json`（包含 version、lastUpdated、sessions 列表）  
  - 每 session 文件：`sessions/<sessionId>.json`（包含 session 元信息与 turn 详情）  
  - 每个 session 下至少包括：`sessionId`、`workingDirectory`、`startedAt`、`endedAt`、`status`、`lastEvent.phase`、`lastEvent.details[]`、`lastEvent.rawMessagePreview`。  
  需要考虑路径长度（Windows）、并发写入（多 Codex 实例）、旧数据清理策略（例如 24 小时）。  
  验收指标：有一份明确的 JSON schema 示例（文档或注释形式），能用一两个具体样例说明：给定某个项目（如 `D:\Github\CodexPin`），如何从 `status.json` 一步定位到“最近一轮 turn 的 phase 和 details”。

- [x] 任务 3：设计 CodexPin Hook 脚本的输入输出约定  
  要求：确定 hook 脚本（如 `codexpin-codex-hook.js` 或 `bun codexpin-hook.ts`）的：  
  - 调用方式：例如 `bun codexpin-hook.js '<JSON>'`，只接受一个 JSON 字符串参数；  
  - 需要解析的字段：`type`、`thread-id`、`turn-id`、`cwd`、`input-messages`、`last-assistant-message`；  
  - 解析策略：从 `input-messages` 提炼 session 标题，从 `last-assistant-message` 拆出 phase + 1–2 行 details，保持原文前 N 个字符作为 preview；  
  - 失败策略：解析失败/写文件失败时静默退出，不影响 Codex 本身执行。  
  验收指标：文档中给出一个真实的 Codex notify 事件样例 JSON，并标注出 hook 会如何提取字段、输出到 CodexPin 的 `status.json` / `sessions/*.json`；同时说明在异常情况下 Codex 不会被我们阻塞。

- [x] 任务 4：设计安全的 `notify` 注册与串联方案  
  要求：设计 `codexpin setup` 或类似命令的行为，包括：  
  - 如何读取并解析 `~/.codex/config.toml`；  
  - 如果已有 `notify`：如何把原有配置安全保存为 “original notify”，并将 CodexPin hook 放在当前链路最前/最后；  
  - 如何避免重复注册（幂等性）、如何在卸载时恢复原有配置；  
  - Windows 路径转义、Toml 更新的边界情况处理。  
  验收指标：写出清晰的步骤描述（或伪代码）说明：在已有/无 notify 的两种情况下，运行一次 `codexpin setup` 后，`config.toml` 的 diff 是什么样；再运行一次不会重复插入；有简单的回滚策略说明。

- [x] 任务 5：定义 hook 中的“分段逻辑”和文本提炼规则  
  要求：制定一套从 `last-assistant-message` 提取展示内容的规则，例如：  
  - 分行 → 去空行；  
  - phase：优先选第一行（或第一个类似标题/粗体/列表引导的行）；  
  - details：选 1–2 行含有高信息量的句子（如第一条 bullet 或总结句），长度控制在合适范围（例如 60–80 字符）；  
  - rawMessagePreview：保留前 300–400 字符用于未来详情展示；  
  - 兼容纯文本 / 富文本（Markdown）情况，并说明不支持的结构如何回退。  
  验收指标：列出至少 3 个真实/模拟的助手回复样例（“长总结”“带列表”“一句话回复”），并展示应用规则后得到的 `phase` 和 `details[]`，符合你心目中“小面板那一段”的视觉预期。

- [ ] 任务 6：设计 Electron 端对 CodexPin 状态的读取与映射  
  要求：在不写代码的前提下，定义好 Electron 主进程与渲染进程的职责：  
  - 主进程：提供 `codexpin-get-session-status` IPC，读取 `~/.codexpin/codex-status/status.json`，按当前 `cwd` / 项目路径筛选出最近的 session，并返回：`hasSession`、`isActive`、`elapsedSeconds`、`phase`、`details[]`；  
  - 渲染进程：每 1–2 秒调用该 IPC，映射为 UI：  
    - 左上：`elapsedSeconds` + 是否 active；  
    - 右上：`工作中/待命中`；  
    - 中间：`phase` + `details[]`，并用不同颜色和小图标显示（第一行深、后两行浅、动态圆点仅在 active 时 pulsing）。  
  验收指标：在文档中明确描述一次完整的数据流：“Codex 完成一轮 turn → 调用 hook 写入 status.json → Electron 主进程读取 → 渲染进程展示”的时序图或文字流程，任何人照此可以实现 IPC 和 UI 映射。

- [ ] 任务 7：设计与原有 `.codex` 日志方案的兼容/回退策略  
  要求：考虑用户未运行 `codexpin setup`、或在没有 CodexPin hook 的机器上的行为：  
  - 当 `~/.codexpin/codex-status/status.json` 不存在或为空时，回退到当前 `.codex` 日志解析方案（从 sessions JSONL 推断最近会话时间与简单文本）；  
  - 当两者都存在时，优先使用 CodexPin hook 数据；  
  - 明确回退时 UI 文案和动态效果是否有所区别（例如不显示小绿点动画，只显示“待命/工作中 + 简略文本”。  
  验收指标：文档中列出三种环境场景（无 hook、有 hook、有 hook + 有 Confirmo），并说明每种场景下小面板的行为和数据来源，避免出现“读错别的项目/日志”的情况。

- [ ] 任务 8：测试与验证计划  
  要求：为 CodexPin hook 方案制定最小可行的测试清单，包括：  
  - 单元测试：给定示例 Codex notify JSON，hook 写出的 `status.json` / `sessions/*.json` 是否符合 schema；  
  - 集成测试：模拟运行 Codex CLI，手动触发一到两轮 `agent-turn-complete`，确认 Electron 面板能在 1–2 秒内显示出对应 phase + details；  
  - 回退测试：删除 `~/.codexpin/codex-status/`，确认仍能从 `.codex` 日志渲染基本信息。  
  验收指标：在 `docs/tests-checklist.md` 中新增一节“Codex hook 模式测试”，列出上述检查项，并在实际实现后可以逐条打钩验证。

- [ ] 任务 9：文档与用户引导设计  
  要求：更新或新增文档（例如 `README.md` 和 `docs/solution.md`），用面向用户/开发者两种视角说明：  
  - 用户视角：  
    - 安装 CodexPin 的步骤；  
    - 运行 `codexpin setup` 注册 Codex hook 的方法；  
    - 如何确认小面板已经成功接入 Codex（例如观察最近一轮回答的 phase/细节是否出现）；  
  - 开发者视角：  
    - hook 文件的位置、调用约定；  
    - 状态文件的结构与演进策略（version 字段）；  
    - 如何在未来扩展更多字段而不破坏现有版本。  
  验收指标：一个未参与实现的人在阅读文档后，能独立完成：安装 CodexPin → 注册 hook → 触发一轮 Codex 回合 → 看到小面板展示出对应阶段与细节的全过程，中间不需要你额外解释。
