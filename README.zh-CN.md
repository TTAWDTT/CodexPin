<p align="center">
  <img src="./assets/readme/codexpin-hero.png" alt="CodexPin README Hero" width="860" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
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
  CodexPin 是一个始终置顶的 Codex 桌面悬浮窗，让你在切去别的窗口工作时，依然能看到当前任务状态。
</p>

## 项目概览

CodexPin 面向 Windows 本地 Codex 工作流。打包后的应用会在首次启动时自动配置 Codex `notify` hook，再结合本地 hook 事件和 Codex rollout 日志，提取出当前会话最新的一段任务状态。

当前特性：

- 打包应用首次启动时自动安装并串联 Codex `notify` hook
- 悬浮窗始终置顶，并且可以直接拖动位置
- 中间区域只显示最新的一段 live segment，而不是整份日志
- 如果本地能解析到限额信息，会显示 5h 和 Week 的剩余百分比
- 当前任务从工作中转回待命时，会播放一声完成提示音
- 纯本地链路，不依赖 Confirmo

## 悬浮窗会显示什么

- 左上角：当前 Codex 回合的持续时间
- 右上角：当前状态
  - `未接入`
  - `待命中`
  - `工作中`
- 中间区域：最新的一段 live segment
  - 一个 `phase`
  - 最多两条简短 `details`
- 左下角 / 右下角：尽力从本地解析出来的限额百分比
  - `5h xx%`
  - `Week xx%`
- 当前没有 Codex 进程时的兜底显示：
  - `暂无 Codex 进程`

双击顶部栏可以切换紧凑模式。

## 安装与使用

普通用户推荐流程：

1. 下载并安装 `CodexPin Setup.exe`
2. 如果你不想用默认目录，可以在安装时手动选择安装位置
3. 启动 `CodexPin`
4. 等待 CodexPin 自动配置本机 Codex hook
5. 开始或继续使用 Codex，悬浮窗会自动更新

如果自动接入失败：

- 右上角会显示 `未接入`
- 中间会显示失败原因
- 面板中会出现 `重试接入` 按钮

如果 CodexPin 已接入，但当前没有运行中的 Codex 进程：

- 右上角保持 `待命中`
- 中间显示 `暂无 Codex 进程`

## 工作原理

主链路：

`Codex notify -> CodexPin hook -> ~/.codexpin/codex-status/status.json -> Electron widget`

用于细化实时显示的链路：

`~/.codex/sessions/.../rollout-<session>.jsonl -> live segment parser -> 当前 phase/details + 本地限额`

补充说明：

- 打包模式会跟踪本机最新的 Codex 会话
- 源码模式主要用于开发，默认只跟踪当前工作目录对应的会话
- 已有的 Codex `notify` 不会被粗暴覆盖，而是通过 `~/.codexpin/original-notify.json` 做备份与串联

## 本地状态文件

CodexPin 会把自己的状态写入：

```text
~/.codexpin/
  original-notify.json
  codex-status/
    status.json
    sessions/
      <sessionId>.json
```

这些文件分别用于：

- `status.json`
  - 给悬浮窗读取的汇总索引
- `sessions/<sessionId>.json`
  - 保存更完整的单会话历史
- `original-notify.json`
  - 备份用户原本的 Codex notify 配置，方便回滚与串联

## 开发命令

```bash
npm install
npm start
```

常用命令：

```bash
npm test
npm run build
npm run setup:hook
npm run uninstall:hook
```

说明：

- `npm start` 会以源码模式启动 Electron 小组件
- 源码模式下也会尝试把当前应用入口接到 Codex `notify`
- `npm run build` 会生成 Windows 安装包与解包后的应用

## 关键文件

- `scripts/codexpin-cli.js`
  - 手动 setup / uninstall CLI
- `scripts/codexpin-codex-hook.js`
  - 源码模式的 Codex hook 入口
- `electron/hookRuntime.js`
  - 打包后 `CodexPin.exe --codex-hook` 的运行时入口
- `electron/installBootstrap.js`
  - 应用启动时的自动接入逻辑
- `scripts/codexpinHookLib.js`
  - hook 侧的状态写入与摘要逻辑
- `electron/codexpinStatus.js`
  - 悬浮窗侧的会话选择与状态计算逻辑
- `electron/codexRolloutLive.js`
  - rollout 实时解析、segment 提炼与限额提取逻辑

## 更多文档

- [`docs/codexpin-hook-design.md`](./docs/codexpin-hook-design.md)
- [`docs/codexpin-state-schema.md`](./docs/codexpin-state-schema.md)
- [`docs/tests-checklist.md`](./docs/tests-checklist.md)
- [`docs/solution.md`](./docs/solution.md)
