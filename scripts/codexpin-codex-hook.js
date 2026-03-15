#!/usr/bin/env node

/**
 * CodexPin Codex hook CLI 入口：
 * - 从 argv[2] 读取 JSON 字符串
 * - 仅处理 type === "agent-turn-complete" 的事件
 * - 调用 codexpinHookLib 更新本地状态
 * - 如有 original-notify.json，则在后台转发给原有 notify 链
 *
 * 所有错误都被吞掉，不影响 Codex 自身执行。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const {
  updateCodexPinStateFromEvent,
} = require('./codexpinHookLib');

function forwardToOriginalNotify(rawJsonArg) {
  try {
    const home = os.homedir();
    const originalPath = path.join(home, '.codexpin', 'original-notify.json');
    if (!fs.existsSync(originalPath)) return;

    const raw = fs.readFileSync(originalPath, 'utf8');
    const original = JSON.parse(raw);
    if (!Array.isArray(original) || original.length === 0) return;

    const cmd = original[0];
    const args = original.slice(1).concat([rawJsonArg]);

    const child = childProcess.spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // 转发失败不应影响 Codex 行为
  }
}

function main() {
  try {
    const arg = process.argv[2];
    if (!arg) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(arg);
    } catch {
      // 非法 JSON 直接忽略
      return;
    }

    if (!payload || payload.type !== 'agent-turn-complete') {
      // 只关心 agent-turn-complete 事件，其余直接返回
      return;
    }

    updateCodexPinStateFromEvent(payload);
    forwardToOriginalNotify(arg);
  } catch {
    // 任何异常都不应影响 Codex 本身
  }
}

main();

