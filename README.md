<p align="center">
  <img src="./assets/readme/codexpin-hero.png" alt="CodexPin README Hero" width="860" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-31.7.7-1f2937?style=flat-square&logo=electron&logoColor=9feaf9&labelColor=0f172a" alt="Electron" />
  <img src="https://img.shields.io/badge/Windows-Desktop-1d4ed8?style=flat-square&logo=windows11&logoColor=ffffff&labelColor=0f172a" alt="Windows" />
  <img src="https://img.shields.io/badge/Codex-Hook-f59e0b?style=flat-square&labelColor=0f172a" alt="Codex Hook" />
  <img src="https://img.shields.io/badge/Always-On%20Top-22c55e?style=flat-square&labelColor=0f172a" alt="Always On Top" />
  <img src="https://img.shields.io/badge/Auto-Setup-a855f7?style=flat-square&labelColor=0f172a" alt="Auto Setup" />
  <img src="https://img.shields.io/badge/Local-First-eab308?style=flat-square&labelColor=0f172a" alt="Local First" />
  <img src="https://img.shields.io/badge/Streaming-Status-38bdf8?style=flat-square&labelColor=0f172a" alt="Streaming Status" />
  <img src="https://img.shields.io/badge/License-ISC-94a3b8?style=flat-square&labelColor=0f172a" alt="ISC License" />
</p>

<p align="center">
  CodexPin 是一个始终置顶的 Electron 小部件，用来在你切到别的窗口工作时，继续显示 Codex 当前项目的最近一轮状态。
</p>

## 一眼看懂

- 自动接入本机 Codex `notify` hook
- 用悬浮窗持续显示最近一轮 `phase + details`
- 当前没有 Codex 进程时，明确显示 `暂无 Codex 进程`
- 数据链路本地优先，不依赖外部服务
- 安装包支持自定义安装目录与桌面快捷方式

现在的推荐使用方式是：

1. 下载并安装打包后的 `CodexPin Setup.exe`
2. 首次打开 `CodexPin.exe`
3. CodexPin 自动检查并接入本机 Codex
4. 之后正常使用 Codex，悬浮窗会自动显示状态

安装器现在支持：

- 显示 CodexPin 自定义 logo
- 安装时手动选择安装目录

正式数据链路仍然是：

`Codex notify -> CodexPin hook -> ~/.codexpin/codex-status/status.json -> Electron widget`

不会再从 `.codex` 日志里“猜”当前内容。

## 当前能力

- 左上角显示当前 Codex 会话的持续时间
- 右上角显示本地状态：
  - `未接入`
  - `待命中`
  - `工作中`
- 当本机当前没有 Codex 进程时，中间区域显示 `暂无 Codex 进程`
- 中间区域只显示最近一轮的一个状态段：
  - `phase`
  - 1–2 条 `details`
- 打包后的 `CodexPin.exe` 自己兼任官方 `notify` hook
- 保留已有 `notify`，通过 `~/.codexpin/original-notify.json` 做安全串联与回滚

## 普通用户使用

如果你是从 GitHub Releases 下载的安装包，正常流程是：

1. 安装 `CodexPin Setup.exe`
2. 打开 `CodexPin`
3. 等待它自动完成 Codex 接入
4. 开始使用 Codex

如果当前没有 Codex 在运行，小部件会显示：

- 右上角：`待命中`
- 中间：`暂无 Codex 进程`

如果自动接入失败：

- 右上角会显示 `未接入`
- 中间会显示失败原因
- 面板中会出现 `重试接入` 按钮

## 开发运行（源码）

```bash
npm install
npm start
```

其中：

- `npm start`
  启动 Electron 小部件，并自动尝试把当前 Electron 入口接到 Codex `notify`

如果你仍然想手动注册源码版 hook，也可以继续用：

```bash
npm run setup:hook
```

如果你想移除 hook：

```bash
npm run uninstall:hook
```

## 如何确认已经接入成功

1. 启动 CodexPin
2. 等待它自动完成接入
3. 在当前项目目录里进行一轮新的 Codex 对话
4. 观察小部件：
   - 右上角从 `未接入` / `待命中` 变成 `工作中`
   - 中间出现该轮回答提炼出的 `phase + details`

如果没有接入成功：

- 自动接入失败时，会显示 `未接入`
- 已接入但当前没有 Codex 进程时，会显示 `暂无 Codex 进程`
- 已接入且有 `status.json` 但当前项目没有匹配 session 时，会显示 `待命中`

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
  源码模式的 Codex `notify` hook 入口
- [`electron/hookRuntime.js`](D:\Github\CodexPin\electron\hookRuntime.js)
  打包后 `CodexPin.exe --codex-hook` 的 hook 运行时入口
- [`electron/installBootstrap.js`](D:\Github\CodexPin\electron\installBootstrap.js)
  首次启动自动接入逻辑
- [`scripts/codexpinHookLib.js`](D:\Github\CodexPin\scripts\codexpinHookLib.js)
  文本分段与状态写入逻辑
- [`electron/codexpinStatus.js`](D:\Github\CodexPin\electron\codexpinStatus.js)
  Electron 端状态选择逻辑

更详细的设计说明见：

- [`docs/codexpin-hook-design.md`](D:\Github\CodexPin\docs\codexpin-hook-design.md)
- [`docs/codexpin-state-schema.md`](D:\Github\CodexPin\docs\codexpin-state-schema.md)
- [`docs/tests-checklist.md`](D:\Github\CodexPin\docs\tests-checklist.md)
