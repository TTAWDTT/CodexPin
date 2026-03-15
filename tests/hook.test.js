const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  summarizeAssistantMessage,
  updateCodexPinStateFromEvent,
} = require('../scripts/codexpinHookLib');

function createTempRoot() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-hook-test-'));
  const rootDir = path.join(base, 'codex-status');
  fs.mkdirSync(rootDir, { recursive: true });
  return rootDir;
}

function testSummarizeAssistantMessage() {
  const raw = [
    '## 实装 CodexPin hook',
    '- 第一步：解析 notify JSON',
    '- 第二步：写入本地状态文件',
    '',
    '一些额外说明行',
  ].join('\n');

  const { phase, details, rawMessagePreview } = summarizeAssistantMessage(raw);

  assert.strictEqual(
    phase,
    '实装 CodexPin hook',
    'phase 应该提炼为首行的语义标题',
  );
  assert.deepStrictEqual(
    details,
    ['第一步：解析 notify JSON', '第二步：写入本地状态文件'],
    'details 应该选取后续两行的高信息量内容',
  );
  assert.ok(
    typeof rawMessagePreview === 'string' && rawMessagePreview.length > 0,
    'rawMessagePreview 应该保留原文的前若干字符',
  );
}

function testUpdateCodexPinStateFromEvent() {
  const rootDir = createTempRoot();

  const event = {
    type: 'agent-turn-complete',
    'thread-id': 'session-1',
    'turn-id': 'turn-1',
    cwd: 'D:\\\\Github\\\\CodexPin',
    'input-messages': [
      {
        role: 'user',
        content: '请帮我实装 CodexPin 的 Codex hook 输出面板',
      },
    ],
    'last-assistant-message': [
      '已完成 CodexPin hook 实装',
      '1. 解析 agent-turn-complete 事件',
      '2. 写入 ~/.codexpin/codex-status/status.json',
    ].join('\n'),
  };

  updateCodexPinStateFromEvent(event, { rootDir });

  const statusPath = path.join(rootDir, 'status.json');
  const sessionPath = path.join(rootDir, 'sessions', 'session-1.json');

  assert.ok(fs.existsSync(statusPath), 'status.json 应该被写入');
  assert.ok(fs.existsSync(sessionPath), 'sessions/<sessionId>.json 应该被写入');

  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  assert.strictEqual(status.version, 1, 'status.json 应该包含 version=1');
  assert.ok(
    typeof status.lastUpdated === 'number' && status.lastUpdated > 0,
    'status.json 应该包含有效的 lastUpdated 时间戳',
  );
  assert.ok(
    status.sessions && status.sessions['session-1'],
    'status.sessions 中应包含该 sessionId',
  );

  const summary = status.sessions['session-1'];
  assert.strictEqual(
    summary.sessionId,
    'session-1',
    'summary 中的 sessionId 应与事件 thread-id 一致',
  );
  assert.strictEqual(
    summary.status,
    'active',
    '收到 turn-complete 事件后 session 状态应该是 active',
  );
  assert.ok(
    summary.lastEvent && summary.lastEvent.phase,
    'summary.lastEvent.phase 应该存在',
  );
  assert.ok(
    Array.isArray(summary.lastEvent.details),
    'summary.lastEvent.details 应该是数组',
  );

  assert.strictEqual(
    session.sessionId,
    'session-1',
    '每 session 文件中的 sessionId 应正确设置',
  );
  assert.ok(
    Array.isArray(session.turns) && session.turns.length === 1,
    '每 session 文件中应追加一条 turn 记录',
  );
  assert.strictEqual(
    session.turns[0].turnId,
    'turn-1',
    'turnId 应与事件 turn-id 对应',
  );
}

function run() {
  console.log('Running Codex hook tests...');
  testSummarizeAssistantMessage();
  testUpdateCodexPinStateFromEvent();
  console.log('All Codex hook tests passed.');
}

run();

