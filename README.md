# CodexPin

CodexPin 是一个始终置顶的 Electron 小部件，用来在你切到别的窗口工作时，继续显示 Codex 当前项目的最近一轮状态。

它现在只依赖一条正式链路：

`Codex notify -> ~/.codexpin/codex-status/status.json -> Electron widget`

不会再从 `.codex` 日志里“猜”当前内容。

## 当前能力

- 左上角显示当前 Codex 会话的持续时间
- 右上角显示本地状态：
  - `未接入`
  - `待命中`
  - `工作中`
- 中间区域只显示最近一轮的一个状态段：
  - `phase`
  - 1–2 条 `details`
- 使用官方 `notify` hook 接入 Codex
- 保留已有 `notify`，通过 `~/.codexpin/original-notify.json` 做安全串联与回滚

## 开发运行

```bash
npm install
npm run setup:hook
npm start
```

其中：

- `npm run setup:hook`
  会执行 `node scripts/codexpin-cli.js setup`
- `npm start`
  启动 Electron 小部件

如果你想移除 hook：

```bash
npm run uninstall:hook
```

## 如何确认已经接入成功

1. 先运行 `npm run setup:hook`
2. 启动 CodexPin
3. 在当前项目目录里进行一轮新的 Codex 对话
4. 观察小部件：
   - 右上角从 `未接入` / `待命中` 变成 `工作中`
   - 中间出现该轮回答提炼出的 `phase + details`

如果没有接入成功：

- 没有 `~/.codexpin/codex-status/status.json` 时，会显示 `未接入`
- 有 `status.json` 但当前项目没有匹配 session 时，会显示 `待命中`

## 相关命令

```bash
npm test
npm run build
npm run setup:hook
npm run uninstall:hook
```

## 状态文件

CodexPin 会把自己的状态写到：

```text
~/.codexpin/
  original-notify.json
  codex-status/
    status.json
    sessions/
      <sessionId>.json
```

说明：

- `status.json`
  是 Electron 读取的汇总索引
- `sessions/<sessionId>.json`
  保存更完整的 turn 历史
- `original-notify.json`
  保存用户原本的 `notify` 配置，用于回滚

## 开发者说明

主要文件：

- [`scripts/codexpin-cli.js`](D:\Github\CodexPin\scripts\codexpin-cli.js)
  `setup / uninstall` CLI
- [`scripts/codexpin-codex-hook.js`](D:\Github\CodexPin\scripts\codexpin-codex-hook.js)
  Codex `notify` hook 入口
- [`scripts/codexpinHookLib.js`](D:\Github\CodexPin\scripts\codexpinHookLib.js)
  文本分段与状态写入逻辑
- [`electron/codexpinStatus.js`](D:\Github\CodexPin\electron\codexpinStatus.js)
  Electron 端状态选择逻辑

更详细的设计说明见：

- [`docs/codexpin-hook-design.md`](D:\Github\CodexPin\docs\codexpin-hook-design.md)
- [`docs/codexpin-state-schema.md`](D:\Github\CodexPin\docs\codexpin-state-schema.md)
- [`docs/tests-checklist.md`](D:\Github\CodexPin\docs\tests-checklist.md)

