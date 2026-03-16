# CodexPin v1.0.0 Release Notes / 发行说明

> Installer / 安装程序: `dist/CodexPin Setup 1.0.0.exe`

---

## EN

### Overview

CodexPin is a lightweight always-on-top widget that mirrors your Codex threads locally. It shows:

- Current thread elapsed time (top-left)
- Global Codex status (Working / Idle) via the animated status dot
- Streaming task output with phase-aware formatting
- Footer chips for 5h / weekly token quota (when available from Codex)

This build is packaged for Windows using `electron-builder` (NSIS installer, one-click disabled so users can choose the install directory).

### What’s new in this build

- Thread picker:
  - Shows real, global Codex threads discovered from `~/.codex/sessions`
  - Only keeps “real” rollout-backed threads and hides old synthetic/manual test sessions when real data exists
  - Dropdown overlay now cleanly covers the content area (no overlapping text)
- Status dot and state model:
  - Unified status between header and thread list: we now trust the live rollout status first, then fall back to the last hook summary
  - The status dot in the thread picker reflects:
    - Green: active/open turn (`工作中 / Working`)
    - Gray: completed/historical (`待命中 / Idle`)
    - Dimmed gray: no Codex process detected
- Streaming output:
  - Live streaming now reads Codex rollout JSONL files and extracts the latest meaningful message (agent message, tool call, assistant message, or turn aborted)
  - Uses richer formatting: phase line + detail lines, with subtle vs. active color contrast
- Quota display:
  - 5h / Week quota chips are derived from Codex `token_count` events (primary/secondary windows)
  - If the selected thread has no quota info, we fall back to the latest global token window instead of showing `--`
- Stability and correctness:
  - Thread selection uses a merged view of `~/.codexpin/codex-status/status.json` and live rollouts, so historical rollout-only threads can still be selected and viewed
  - Multiple tests added to keep CodexPin aligned with Codex behavior (active/idle detection, aborted turns, task completion, global vs. project session selection)

### How to install

1. Download `CodexPin Setup 1.0.0.exe` from the repository `dist` folder or GitHub Release.
2. Double-click the installer.
3. Choose the installation directory (one-click install is disabled on purpose).
4. After installation, you’ll get:
   - A desktop shortcut
   - A Start Menu entry (`CodexPin`)

### How to use

1. Make sure Codex is running normally on this machine.
2. Launch CodexPin from the desktop icon or Start Menu.
3. Watch the header:
   - Left: current thread elapsed time
   - Middle: thread selector with an animated status dot
4. Use the thread selector to switch between active and historical threads; the middle panel will stream the latest task output for the selected thread.

> Tip: CodexPin does not require any cloud API keys. It reads local Codex hook + session files only.

---

## 中文版说明

### 概览

CodexPin 是一个常驻置顶的小挂件，用来在本地镜像你的 Codex 线程，方便你一边干别的事情、一边随时瞄一眼当前 Codex 在干嘛。

它会展示：

- 左上角：当前选中 Codex 线程的本轮会话已运行时间
- 中间：线程选择器（带状态光点，显示工作中 / 待命中）
- 中间区域：Codex 正在执行任务时的流式输出，按阶段拆分成一行主阶段 + 若干描述行
- 底部：5 小时额度 / 一周额度的剩余百分比（在 Codex 提供 `token_count` 事件时可用）

本版本通过 `electron-builder` 打包为 Windows 安装包（NSIS，非一键安装，可自选安装目录）。

### 本次构建的主要更新

- 线程选择器：
  - 线程列表来自 `~/.codex/sessions` 中的真实 rollout 文件，支持跨项目的全局线程
  - 当存在真实 rollout 线程时，会自动隐藏早期的手动 / 测试型线程，避免列表被噪音占满
  - 展开线程列表时会有黑色遮罩覆盖内容区，不会再出现文字互相重叠的现象
- 状态光点与状态模型：
  - 统一了顶部与列表的状态来源：优先信任实时 rollout 状态，其次才回退到 hook 摘要
  - 线程选项前的光点含义：
    - 绿色：当前线程存在未完成的 turn / 最近仍在活动（“工作中”）
    - 灰色：线程已完成 / 历史线程（“待命中”）
    - 暗灰色：当前没有检测到 Codex 进程
- 流式输出：
  - 直接读取 Codex rollout JSONL 日志，提取最近一条具有展示价值的事件（agent_message / 工具调用 / 助手回答 / turn 中断）
  - 使用分行展示：主阶段行 + 详情行，颜色层级明确（主阶段更亮，细节稍淡）
- 限额展示：
  - 5 小时 / 一周额度来自 Codex 的 `token_count` 事件（primary / secondary 窗口）
  - 当当前线程没有额度信息时，会回退到“全局最近一次额度窗口”，而不是直接显示 `--`
- 稳定性与正确性：
  - 线程列表使用 `status.json` 与 rollout 的合并视图，历史上只有 rollout 但没有 status 记录的线程也可以被选中并浏览
  - 新增多条测试用例，覆盖：活动 / 待命检测、被手动中断的 turn、task 完成后的回退逻辑、全局 / 当前项目线程选择等场景

### 安装方式

1. 从仓库的 `dist` 目录或 GitHub Release 下载 `CodexPin Setup 1.0.0.exe`。
2. 双击运行安装程序。
3. 按提示选择安装目录（默认开启“允许选择安装目录”，不会强制一键安装）。
4. 安装完成后会得到：
   - 桌面快捷方式
   - 开始菜单中的 `CodexPin` 入口

### 使用方式

1. 确保本机已经正常运行 Codex，并且 Codex Hook 已按 README 说明完成安装。
2. 从桌面图标或开始菜单启动 CodexPin。
3. 观察顶部区域：
   - 左侧：当前线程已持续时间
   - 右侧：线程选择器 + 状态光点
4. 使用线程选择器切换不同的线程，中央内容区域会展示相应线程最近一轮任务的流式输出。

> 小提示：CodexPin 只读取本地 Codex 的 hook / session 文件，不需要配置任何云端 API Key。

