const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  summarizeAssistantMessage,
  updateCodexPinStateFromEvent,
} = require('../scripts/codexpinHookLib');
const {
  shouldForwardToOriginalNotify,
} = require('../scripts/codexpin-codex-hook');

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

function testSummarizeMarkdownBoldAndLongDetail() {
  const raw = [
    '**实装 CodexPin 状态同步**',
    '- 这是一条非常长非常长非常长非常长非常长非常长非常长非常长非常长的说明文本，需要在 detail 中被安全截断，避免小面板显示过长',
    '- 第二条细节保留',
  ].join('\n');

  const { phase, details } = summarizeAssistantMessage(raw);

  assert.strictEqual(
    phase,
    '实装 CodexPin 状态同步',
    'phase 应该去掉 Markdown 粗体包裹',
  );
  assert.strictEqual(
    details.length,
    2,
    '应最多返回两条 details',
  );
  assert.ok(
    details[0].length <= 80,
    '超长 detail 应被截断到小面板可读长度',
  );
  assert.strictEqual(details[1], '第二条细节保留');
}

function testSummarizeSingleLineMessage() {
  const raw = '已经完成 Electron 状态桥接';
  const { phase, details } = summarizeAssistantMessage(raw);

  assert.strictEqual(phase, '已经完成 Electron 状态桥接');
  assert.deepStrictEqual(
    details,
    [],
    '单行回复时 details 应为空数组',
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

function testSkipsForwardWhenOriginalNotifyPointsBackToCodexPinThroughConfirmo() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-hook-loop-'));
  const homeDir = path.join(base, 'home');
  const codexpinDir = path.join(homeDir, '.codexpin');
  const confirmoHooksDir = path.join(homeDir, '.confirmo', 'hooks');
  fs.mkdirSync(codexpinDir, { recursive: true });
  fs.mkdirSync(confirmoHooksDir, { recursive: true });

  const codexpinHookPath = path.join(base, 'repo', 'scripts', 'codexpin-codex-hook.js');
  const confirmoHookPath = path.join(homeDir, '.confirmo', 'hooks', 'confirmo-codex-hook.js');

  fs.writeFileSync(
    path.join(codexpinDir, 'original-notify.json'),
    JSON.stringify(['C:\\Users\\86153\\.bun\\bin\\bun.exe', confirmoHookPath]),
    'utf8',
  );
  fs.writeFileSync(
    path.join(confirmoHooksDir, 'codex-original-notify.json'),
    JSON.stringify({
      notify: ['C:\\Program Files\\nodejs\\node.exe', codexpinHookPath],
    }),
    'utf8',
  );

  const shouldForward = shouldForwardToOriginalNotify({
    homeDir,
    currentHookPath: codexpinHookPath,
  });

  assert.strictEqual(
    shouldForward,
    false,
    '当 Confirmo 的原始 notify 又指回 CodexPin 时，应阻止转发形成循环',
  );
}

function testAllowsForwardWhenOriginalNotifyDoesNotLoopBack() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-hook-forward-'));
  const homeDir = path.join(base, 'home');
  const codexpinDir = path.join(homeDir, '.codexpin');
  fs.mkdirSync(codexpinDir, { recursive: true });

  const codexpinHookPath = path.join(base, 'repo', 'scripts', 'codexpin-codex-hook.js');
  fs.writeFileSync(
    path.join(codexpinDir, 'original-notify.json'),
    JSON.stringify(['C:\\Windows\\System32\\cmd.exe', '/c', 'echo', 'ok']),
    'utf8',
  );

  const shouldForward = shouldForwardToOriginalNotify({
    homeDir,
    currentHookPath: codexpinHookPath,
  });

  assert.strictEqual(
    shouldForward,
    true,
    '普通的原始 notify 不应被误判为循环',
  );
}

function run() {
  console.log('Running Codex hook tests...');
  testSummarizeAssistantMessage();
  testSummarizeMarkdownBoldAndLongDetail();
  testSummarizeSingleLineMessage();
  testUpdateCodexPinStateFromEvent();
  testSkipsForwardWhenOriginalNotifyPointsBackToCodexPinThroughConfirmo();
  testAllowsForwardWhenOriginalNotifyDoesNotLoopBack();
  console.log('All Codex hook tests passed.');
}

run();
