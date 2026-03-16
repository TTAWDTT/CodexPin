const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  summarizeToolInput,
  parseRolloutLines,
  findLatestRolloutFileForSession,
  getLiveRolloutStatus,
  listRolloutSessions,
  __internal,
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

function testParseRolloutLinesTracksOpenTurn() {
  const lines = [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'turn_context',
      payload: {
        turn_id: 'turn-1',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:04.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        status: 'completed',
        name: 'shell_command',
        input: '{"command":"bun test"}',
      },
    }),
  ];

  const result = parseRolloutLines(lines);

  assert.strictEqual(result.currentTurnId, 'turn-1');
  assert.strictEqual(result.currentTurnCompleted, false);
  assert.strictEqual(result.currentTurnStartedAt, Date.parse('2026-03-16T02:30:00.000Z'));
}

function testParseRolloutLinesExtractsRateLimits() {
  const lines = [
    JSON.stringify({
      timestamp: '2026-03-16T08:46:42.745Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        rate_limits: {
          primary: {
            used_percent: 22.0,
            window_minutes: 300,
            resets_at: 1773665240,
          },
          secondary: {
            used_percent: 16.0,
            window_minutes: 10080,
            resets_at: 1774229439,
          },
        },
      },
    }),
  ];

  const result = parseRolloutLines(lines);

  assert.deepStrictEqual(result.rateLimits, {
    fiveHour: {
      usedPercent: 22,
      remainingPercent: 78,
      windowMinutes: 300,
      resetsAt: 1773665240,
    },
    weekly: {
      usedPercent: 16,
      remainingPercent: 84,
      windowMinutes: 10080,
      resetsAt: 1774229439,
    },
  });
}

function testParseRolloutLinesMarksAbortedTurnAsTerminal() {
  const lines = [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'turn_context',
      payload: {
        turn_id: 'turn-1',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:04.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        status: 'completed',
        name: 'shell_command',
        input: '{"command":"bun run start"}',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:06.000Z',
      type: 'event_msg',
      payload: {
        type: 'turn_aborted',
        turn_id: 'turn-1',
        reason: 'interrupted',
      },
    }),
  ];

  const result = parseRolloutLines(lines);

  assert.strictEqual(result.currentTurnId, 'turn-1');
  assert.strictEqual(result.currentTurnCompleted, true);
  assert.strictEqual(result.currentTurnCompletedAt, Date.parse('2026-03-16T02:30:06.000Z'));
  assert.strictEqual(result.isTerminal, true);
  assert.strictEqual(result.phase, '已中断');
  assert.deepStrictEqual(result.details, ['本轮任务已被手动中断']);
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

function testListRolloutSessionsFiltersByProjectDirectory() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-rollout-list-'));
  const sessionId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';
  const otherSessionId = '019cf1f1-4d8f-74d0-859b-0a653552d3b6';

  writeFile(
    path.join(
      base,
      'sessions',
      '2026',
      '03',
      '17',
      `rollout-2026-03-17T10-00-00-${sessionId}.jsonl`,
    ),
    [
      JSON.stringify({
        timestamp: '2026-03-17T10:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: sessionId,
          timestamp: '2026-03-17T10:00:00.000Z',
          cwd: 'D:\\Github\\CodexPin',
        },
      }),
      JSON.stringify({
        timestamp: '2026-03-17T10:00:05.000Z',
        type: 'event_msg',
        payload: {
          type: 'agent_message',
          message: 'Alpha thread',
          phase: 'commentary',
        },
      }),
    ].join('\n'),
  );

  writeFile(
    path.join(
      base,
      'sessions',
      '2026',
      '03',
      '17',
      `rollout-2026-03-17T10-00-00-${otherSessionId}.jsonl`,
    ),
    [
      JSON.stringify({
        timestamp: '2026-03-17T10:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: otherSessionId,
          timestamp: '2026-03-17T10:00:00.000Z',
          cwd: 'D:\\Github\\OtherProject',
        },
      }),
      JSON.stringify({
        timestamp: '2026-03-17T10:00:05.000Z',
        type: 'event_msg',
        payload: {
          type: 'agent_message',
          message: 'Other thread',
          phase: 'commentary',
        },
      }),
    ].join('\n'),
  );

  const sessions = listRolloutSessions({
    codexRoot: base,
    projectDir: 'D:\\Github\\CodexPin',
  });

  assert.strictEqual(sessions.length, 1);
  assert.strictEqual(sessions[0].sessionId, sessionId);
  assert.strictEqual(sessions[0].workingDirectory, 'D:\\Github\\CodexPin');
  assert.strictEqual(sessions[0].lastEvent.phase, 'Alpha thread');
}

function testFindLatestRolloutFileForSessionUsesCacheAfterFirstLookup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-rollout-cache-'));
  const sessionsRoot = path.join(base, 'sessions');
  const sessionId = 'session-cache';
  const target = path.join(
    sessionsRoot,
    '2026',
    '03',
    '17',
    `rollout-2026-03-17T10-00-00-${sessionId}.jsonl`,
  );

  writeFile(target, '{}\n');
  __internal.clearRolloutFileCache();

  const first = findLatestRolloutFileForSession({
    codexRoot: base,
    sessionId,
  });

  const originalReaddirSync = fs.readdirSync;
  fs.readdirSync = () => {
    throw new Error('cache should avoid rescanning the rollout tree');
  };

  try {
    const second = findLatestRolloutFileForSession({
      codexRoot: base,
      sessionId,
    });
    assert.strictEqual(first, target);
    assert.strictEqual(second, target);
  } finally {
    fs.readdirSync = originalReaddirSync;
    __internal.clearRolloutFileCache();
  }
}

function testGetLiveRolloutStatusUsesParseCacheWhenFileIsUnchanged() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-rollout-live-cache-'));
  const sessionId = 'session-live-cache';
  const rolloutPath = path.join(
    base,
    'sessions',
    '2026',
    '03',
    '17',
    `rollout-2026-03-17T10-00-00-${sessionId}.jsonl`,
  );

  writeFile(
    rolloutPath,
    `${JSON.stringify({
      timestamp: '2026-03-17T10:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        status: 'completed',
        name: 'shell_command',
        input: '{"command":"npm test"}',
      },
    })}\n`,
  );

  __internal.clearRolloutFileCache();
  __internal.clearLiveRolloutStatusCache();

  const first = getLiveRolloutStatus({
    codexRoot: base,
    sessionId,
  });

  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = () => {
    throw new Error('cached rollout status should avoid rereading unchanged file');
  };

  try {
    const second = getLiveRolloutStatus({
      codexRoot: base,
      sessionId,
    });
    assert.strictEqual(first.phase, '调用工具 shell_command');
    assert.strictEqual(second.phase, '调用工具 shell_command');
  } finally {
    fs.readFileSync = originalReadFileSync;
    __internal.clearRolloutFileCache();
    __internal.clearLiveRolloutStatusCache();
  }
}

function run() {
  console.log('Running Codex rollout live tests...');
  testSummarizeToolInput();
  testParseRolloutLinesPrefersAgentMessage();
  testParseRolloutLinesFallsBackToToolCall();
  testParseRolloutLinesTracksOpenTurn();
  testParseRolloutLinesExtractsRateLimits();
  testParseRolloutLinesMarksAbortedTurnAsTerminal();
  testFindLatestRolloutFileForSession();
  testListRolloutSessionsFiltersByProjectDirectory();
  testFindLatestRolloutFileForSessionUsesCacheAfterFirstLookup();
  testGetLiveRolloutStatusUsesParseCacheWhenFileIsUnchanged();
  console.log('All Codex rollout live tests passed.');
}

run();
