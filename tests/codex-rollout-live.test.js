const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  summarizeToolInput,
  parseRolloutLines,
  findLatestRolloutFileForSession,
} = require('../electron/codexRolloutLive');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function testSummarizeToolInput() {
  assert.strictEqual(
    summarizeToolInput({ command: 'npm test -- --watch=false' }),
    'npm test -- --watch=false',
  );
  assert.strictEqual(
    summarizeToolInput({ file_path: 'D:\\Github\\CodexPin\\renderer\\renderer.js' }),
    'renderer.js',
  );
}

function testParseRolloutLinesPrefersAgentMessage() {
  const lines = [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        status: 'completed',
        name: 'shell_command',
        input: '{"command":"npm test"}',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: '正在整理 rollout 流式解析逻辑\n\n下一步会把工具调用映射成状态段',
        phase: 'commentary',
      },
    }),
  ];

  const result = parseRolloutLines(lines);

  assert.strictEqual(result.phase, '正在整理 rollout 流式解析逻辑');
  assert.deepStrictEqual(result.details, ['下一步会把工具调用映射成状态段']);
  assert.strictEqual(result.sourceType, 'agent_message');
  assert.ok(result.lastActivityMs > 0);
}

function testParseRolloutLinesFallsBackToToolCall() {
  const lines = [
    JSON.stringify({
      timestamp: '2026-03-16T02:31:00.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        status: 'completed',
        name: 'shell_command',
        input: '{"command":"bun run start"}',
      },
    }),
  ];

  const result = parseRolloutLines(lines);

  assert.strictEqual(result.phase, '调用工具 shell_command');
  assert.deepStrictEqual(result.details, ['bun run start']);
  assert.strictEqual(result.sourceType, 'tool_call');
}

function testFindLatestRolloutFileForSession() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-rollout-'));
  const sessionsRoot = path.join(base, 'sessions');
  const sessionId = 'session-123';

  writeFile(
    path.join(sessionsRoot, '2026', '03', '15', `rollout-2026-03-15T10-00-00-${sessionId}.jsonl`),
    '{}\n',
  );
  const newer = path.join(
    sessionsRoot,
    '2026',
    '03',
    '16',
    `rollout-2026-03-16T10-00-00-${sessionId}.jsonl`,
  );
  writeFile(newer, '{}\n');

  const found = findLatestRolloutFileForSession({
    codexRoot: base,
    sessionId,
  });

  assert.strictEqual(found, newer);
}

function run() {
  console.log('Running Codex rollout live tests...');
  testSummarizeToolInput();
  testParseRolloutLinesPrefersAgentMessage();
  testParseRolloutLinesFallsBackToToolCall();
  testFindLatestRolloutFileForSession();
  console.log('All Codex rollout live tests passed.');
}

run();

