# CodexPin 实施方案（当前版本）

## 1. 产品目标

CodexPin 是一个始终置顶的小部件，用来把 Codex 在“当前项目”的最近一轮状态显示在屏幕上。

当前版本已经不再尝试展示订阅额度，也不再从 `.codex` 日志中推断内容。正式数据链路只有：

`Codex notify -> CodexPin hook -> ~/.codexpin/codex-status/status.json -> Electron widget`

这保证了面板看到的内容与我们自己定义的状态模型一致。

## 2. 当前展示内容

小部件分成三块：

- 左上：本轮 Codex 会话持续时间
- 右上：本地状态
  - `未接入`
  - `待命中`
  - `工作中`
- 中间：最近一轮回答中提炼出的单个状态段
  - 第一行 `phase`
  - 后两行 `details`

只有最近一段会被显示，不展示整段长日志。

## 3. 接入方式

### 3.1 Hook 接入

CodexPin 使用官方 `notify` 机制接入 Codex。

仓库内提供：

- `scripts/codexpin-cli.js`
  - `setup`
  - `uninstall`
- `scripts/codexpin-codex-hook.js`
  - 真正被 Codex `notify` 调用的 hook 入口

推荐命令：

```bash
npm run setup:hook
```

它会把 `~/.codex/config.toml` 中的 `notify` 设置为 CodexPin hook。

如果用户原本已经有 `notify`：

- 原值会保存到 `~/.codexpin/original-notify.json`
- CodexPin hook 在写完自己的状态后会继续转发给原有 `notify`

卸载时：

```bash
npm run uninstall:hook
```

会恢复之前的 `notify`，或移除当前 CodexPin 的 `notify`。

### 3.2 状态文件

CodexPin 的正式状态目录：

```text
~/.codexpin/
  original-notify.json
  codex-status/
    status.json
    sessions/
      <sessionId>.json
```

其中：

- `status.json`
  供 Electron 主进程快速读取最近 session 摘要
- `sessions/<sessionId>.json`
  保存更完整的 turn 历史

## 4. 文本提炼规则

hook 接收到 `last-assistant-message` 后，会做如下提炼：

1. 按行切分
2. 去空行
3. 清洗 Markdown 包裹
   - 标题
   - 列表
   - 编号
   - 粗体
4. 第一行作为 `phase`
5. 后续最多两行作为 `details`
6. 每条 `detail` 截断到适合小面板阅读的长度

目标不是完整复刻回答，而是让用户一眼看到“这一轮现在在说什么”。

## 5. Electron 端数据流

Electron 端分工如下：

- 主进程
  - 通过 `codexpin-get-session-status` IPC 读取 `~/.codexpin/codex-status/status.json`
  - 按当前项目路径筛选最近一条 session
- 渲染进程
  - 每 1.5 秒轮询一次 IPC
  - 把返回值映射成顶部时间、右上状态和中间段落

当前正式运行态只依赖 `~/.codexpin`，不再读取 `.codex`。

## 6. 三种状态

### 6.1 未接入

当 `~/.codexpin/codex-status/status.json` 不存在时：

- 右上显示 `未接入`
- 主标题显示 `未接入 Codex Hook`
- 细节提示用户先运行 `setup`

### 6.2 待命中

当 `status.json` 已存在，但当前项目没有匹配 session 时：

- 右上显示 `待命中`
- 主标题显示 `待命中`

### 6.3 工作中

当当前项目有最新 session 且最新事件仍在活跃窗口内时：

- 右上显示 `工作中`
- 中间显示最新 `phase + details`
- 第一行小圆点会 pulsing

## 7. 测试与验证

当前已覆盖的验证包括：

- `tests/hook.test.js`
  - 文本分段与状态写入
- `tests/notify-setup.test.js`
  - `notify` setup / uninstall 幂等性与回滚
- `tests/codexpin-status.test.js`
  - 只从 `~/.codexpin` 读取状态，不回退 `.codex`
- `tests/codexpin-cli.test.js`
  - CLI setup / uninstall 可用

完整清单见：

- `docs/tests-checklist.md`

## 8. 用户完成路径

一个新用户应能按下面流程独立完成接入：

1. `npm install`
2. `npm run setup:hook`
3. `npm start`
4. 在当前项目里完成一轮新的 Codex 对话
5. 看到小部件显示该轮最新的 `phase + details`

## 9. 后续扩展方向

后续如果继续做产品化，建议优先往这几个方向扩展：

- 安装包内置 hook 注册，而不是要求用户从源码目录执行 setup
- 更丰富的状态事件，而不只依赖 `agent-turn-complete`
- 更细的 session 生命周期管理
- 更强的多项目切换与路径匹配策略
