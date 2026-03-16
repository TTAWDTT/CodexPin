# CodexPin 测试清单

## 1. 自动化验证

- [ ] 运行 `npm test`
- [ ] 确认 `tests/hook.test.js` 通过
  目标：验证 `last-assistant-message` 会被稳定提炼为 `phase + details[]`
- [ ] 确认 `tests/notify-setup.test.js` 通过
  目标：验证 `codexpin setup / uninstall` 对 `~/.codex/config.toml` 的修改是可恢复且幂等的
- [ ] 确认 `tests/codexpin-status.test.js` 通过
  目标：验证 Electron 状态选择逻辑只读取 `~/.codexpin/codex-status/status.json`

## 2. Codex Hook 模式测试

- [ ] 执行 `codexpin setup` 或等效脚本
  验收：`~/.codex/config.toml` 中的 `notify` 被设置为 CodexPin hook，若原本存在 `notify`，其原值已备份到 `~/.codexpin/original-notify.json`
- [ ] 启动 CodexPin 小部件
  验收：初始状态显示 `未接入` 或 `待命中`，界面不崩溃
- [ ] 在目标项目目录中完成一轮 Codex 对话
  验收：1–2 秒内小部件展示最新 `phase` 与 1–2 条 `details`
- [ ] 观察小圆点动画
  验收：仅在最新事件处于活跃窗口内时 pulsing，之后恢复静态

## 3. 未接入与待命状态

- [ ] 删除或重命名 `~/.codexpin/codex-status/status.json` 后启动小部件
  验收：右上角显示 `未接入`，主标题显示 `未接入 Codex Hook`
- [ ] 保留 `status.json`，但让其中不包含当前项目路径的 session
  验收：右上角显示 `待命中`，主标题显示 `待命中`
- [ ] 确认以上两种场景下不会回退读取 `.codex`
  验收：即使 `.codex` 中存在旧日志，小部件也不显示推断出的旧内容

## 4. 桌面交互

- [ ] 窗口置顶
  验收：切换其他窗口到前台后，CodexPin 仍保持在最上层
- [ ] 顶栏拖动
  验收：拖拽顶栏时窗口位置可以平滑变化，无明显闪烁
- [ ] 双击顶栏切换完整 / 极简模式
  验收：状态区域可以折叠与恢复，重启后模式保持不变

## 5. 构建验证

- [ ] 运行 `npm run build`
  验收：Electron 构建成功，打包产物包含 `electron/`、`renderer/`、`scripts/` 与 `assets/`
