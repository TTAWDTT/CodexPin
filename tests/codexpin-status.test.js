const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getSessionStatus } = require('../electron/codexpinStatus');

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-status-test-'));
}

function writeStatus(rootDir, status) {
  fs.mkdirSync(rootDir, { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, 'status.json'),
    JSON.stringify(status, null, 2),
    'utf8',
  );
}

function writeRollout(codexRoot, sessionId, lines, dateParts = ['2026', '03', '16']) {
  const rolloutPath = path.join(
    codexRoot,
    'sessions',
    ...dateParts,
    `rollout-${dateParts.join('-')}T10-00-00-${sessionId}.jsonl`,
  );
  fs.mkdirSync(path.dirname(rolloutPath), { recursive: true });
  fs.writeFileSync(rolloutPath, `${lines.join('\n')}\n`, 'utf8');
  return rolloutPath;
}

function testReturnsNotConnectedWithoutStatusFile() {
  const rootDir = createTempRoot();
  const result = getSessionStatus({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 1000,
  });

  assert.strictEqual(result.integrationState, 'not_connected');
  assert.strictEqual(result.statusText, '未接入');
  assert.strictEqual(result.hasSession, false);
  assert.strictEqual(result.phase, '未接入 Codex Hook');
}

function testReturnsIdleWithoutStatusFileWhenHookIsInstalled() {
  const rootDir = createTempRoot();
  const result = getSessionStatus({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 1000,
    hookInstalled: true,
    detectCodexProcess: () => ({
      hasCodexProcess: true,
    }),
  });

  assert.strictEqual(result.integrationState, 'idle');
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.hasSession, false);
  assert.strictEqual(result.phase, '待命中');
}

function testShowsNoCodexProcessWhenHookInstalledButProcessMissing() {
  const rootDir = createTempRoot();
  const result = getSessionStatus({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 1000,
    hookInstalled: true,
    detectCodexProcess: () => ({
      hasCodexProcess: false,
    }),
  });

  assert.strictEqual(result.integrationState, 'idle');
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.hasSession, false);
  assert.strictEqual(result.phase, '暂无 Codex 进程');
}

function testReturnsIdleWhenProjectHasNoSession() {
  const rootDir = createTempRoot();
  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 2000,
    sessions: {
      s1: {
        sessionId: 's1',
        workingDirectory: 'D:\\Github\\OtherProject',
        startedAt: 1000,
        status: 'active',
        lastEvent: {
          timestamp: 2000,
          phase: '别的项目',
          details: ['不应该被选中'],
          turnId: 't1',
        },
      },
    },
  });

  const result = getSessionStatus({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 3000,
    detectCodexProcess: () => ({
      hasCodexProcess: true,
    }),
  });

  assert.strictEqual(result.integrationState, 'idle');
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.hasSession, false);
  assert.strictEqual(result.phase, '待命中');
}

function testMatchesWindowsPathsAndSelectsLatestSession() {
  const rootDir = createTempRoot();
  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 20000,
    sessions: {
      older: {
        sessionId: 'older',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 1000,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: 5000,
          phase: '旧事件',
          details: ['旧细节'],
          rawMessagePreview: 'old',
          turnId: 't-old',
        },
      },
      latest: {
        sessionId: 'latest',
        workingDirectory: '\\\\?\\D:\\Github\\CodexPin\\',
        startedAt: 10000,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: 19000,
          phase: '最新阶段',
          details: ['最新细节 1', '最新细节 2'],
          rawMessagePreview: 'latest',
          turnId: 't-new',
        },
      },
    },
  });

  const result = getSessionStatus({
    rootDir,
    projectDir: 'd:\\github\\codexpin',
    nowMs: 20000,
  });

  assert.strictEqual(result.integrationState, 'connected');
  assert.strictEqual(result.hasSession, true);
  assert.strictEqual(result.phase, '最新阶段');
  assert.deepStrictEqual(result.details, ['最新细节 1', '最新细节 2']);
  assert.strictEqual(result.isActive, true);
  assert.strictEqual(result.statusText, '工作中');
  assert.strictEqual(result.elapsedSeconds, 10);
}

function testSelectsLatestSessionGloballyWhenProjectDirIsMissing() {
  const rootDir = createTempRoot();
  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {
      older: {
        sessionId: 'older',
        workingDirectory: 'D:\\Github\\OtherProject',
        startedAt: 1000,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: 12000,
          phase: '旧项目阶段',
          details: ['旧项目细节'],
          rawMessagePreview: 'old',
          turnId: 't-old',
        },
      },
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CurrentProject',
        startedAt: 20000,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: 29000,
          phase: '全局最新阶段',
          details: ['全局最新细节'],
          rawMessagePreview: 'latest',
          turnId: 't-latest',
        },
      },
    },
  });

  const result = getSessionStatus({
    rootDir,
    projectDir: null,
    nowMs: 30000,
  });

  assert.strictEqual(result.integrationState, 'connected');
  assert.strictEqual(result.hasSession, true);
  assert.strictEqual(result.sessionId, 'latest');
  assert.strictEqual(result.phase, '全局最新阶段');
  assert.deepStrictEqual(result.details, ['全局最新细节']);
  assert.strictEqual(result.statusText, '工作中');
}

function testPrefersLiveRolloutWhileSessionIsActive() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const startedAt = Date.parse('2026-03-16T02:29:50.000Z');
  const hookAt = Date.parse('2026-03-16T02:30:04.000Z');

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: hookAt,
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: hookAt,
          phase: '最终总结',
          details: ['这不该在活跃期显示'],
          rawMessagePreview: 'final',
          turnId: 't-final',
        },
      },
    },
  });

  writeRollout(codexRoot, 'latest', [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'latest',
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: '正在运行测试\n\nbun test',
        phase: 'commentary',
      },
    }),
  ]);

  const result = getSessionStatus({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:08.000Z'),
  });

  assert.strictEqual(result.isActive, true);
  assert.strictEqual(result.statusText, '工作中');
  assert.strictEqual(result.phase, '正在运行测试');
  assert.deepStrictEqual(result.details, ['bun test']);
  assert.strictEqual(result.elapsedSeconds, 18);
}

function testFallsBackToHookSummaryAfterTaskComplete() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const startedAt = Date.parse('2026-03-16T02:29:50.000Z');
  const hookAt = Date.parse('2026-03-16T02:30:12.000Z');

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: hookAt,
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt,
        endedAt: hookAt,
        status: 'active',
        lastEvent: {
          timestamp: hookAt,
          phase: '测试已完成',
          details: ['输出已经汇总完毕'],
          rawMessagePreview: 'done',
          turnId: 't-final',
        },
      },
    },
  });

  writeRollout(codexRoot, 'latest', [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'latest',
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: '正在运行测试\n\nbun test',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:10.000Z',
      type: 'event_msg',
      payload: {
        type: 'task_complete',
      },
    }),
  ]);

  const result = getSessionStatus({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:13.000Z'),
    detectCodexProcess: () => ({
      hasCodexProcess: true,
    }),
  });

  assert.strictEqual(result.isActive, false);
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.phase, '测试已完成');
  assert.deepStrictEqual(result.details, ['输出已经汇总完毕']);
  assert.strictEqual(result.elapsedSeconds, 22);
}

function testStopsWorkingWhenTurnIsAborted() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const startedAt = Date.parse('2026-03-16T02:29:50.000Z');

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: Date.parse('2026-03-16T02:29:40.000Z'),
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: Date.parse('2026-03-16T02:29:40.000Z'),
          phase: '上一轮已完成',
          details: ['不该覆盖已中断的新回合'],
          rawMessagePreview: 'previous',
          turnId: 'turn-old',
        },
      },
    },
  });

  writeRollout(codexRoot, 'latest', [
    JSON.stringify({
      timestamp: '2026-03-16T02:29:50.000Z',
      type: 'session_meta',
      payload: {
        id: 'latest',
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'turn_context',
      payload: {
        turn_id: 'turn-current',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
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
        turn_id: 'turn-current',
        reason: 'interrupted',
      },
    }),
  ]);

  const result = getSessionStatus({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:07.000Z'),
    detectCodexProcess: () => ({
      hasCodexProcess: true,
    }),
  });

  assert.strictEqual(result.isActive, false);
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.phase, '已中断');
  assert.deepStrictEqual(result.details, ['本轮任务已被手动中断']);
  assert.strictEqual(result.elapsedSeconds, 6);
}

function testKeepsWorkingWhenLatestTurnHasNotCompletedYet() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const previousTurnId = 'turn-old';
  const currentTurnId = 'turn-current';
  const startedAt = Date.parse('2026-03-16T02:29:50.000Z');
  const currentTurnAt = Date.parse('2026-03-16T02:30:00.000Z');
  const lastToolAt = Date.parse('2026-03-16T02:30:05.000Z');

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: Date.parse('2026-03-16T02:29:40.000Z'),
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: Date.parse('2026-03-16T02:29:40.000Z'),
          phase: '上一轮已完成',
          details: ['不该覆盖当前进行中的 turn'],
          rawMessagePreview: 'previous',
          turnId: previousTurnId,
        },
      },
    },
  });

  writeRollout(codexRoot, 'latest', [
    JSON.stringify({
      timestamp: '2026-03-16T02:29:50.000Z',
      type: 'session_meta',
      payload: {
        id: 'latest',
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'turn_context',
      payload: {
        turn_id: currentTurnId,
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        status: 'completed',
        name: 'shell_command',
        input: '{"command":"Get-Content electron/codexpinStatus.js -TotalCount 80"}',
      },
    }),
  ]);

  const result = getSessionStatus({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:45.000Z'),
  });

  assert.strictEqual(result.isActive, true);
  assert.strictEqual(result.statusText, '工作中');
  assert.strictEqual(result.phase, '调用工具 shell_command');
  assert.deepStrictEqual(result.details, ['Get-Content electron/codexpinStatus.js -TotalCount 80']);
  assert.strictEqual(result.elapsedSeconds, 45);
}

function testExposesRateLimitsFromLiveRollout() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const startedAt = Date.parse('2026-03-16T02:29:50.000Z');
  const hookAt = Date.parse('2026-03-16T02:30:12.000Z');

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: hookAt,
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt,
        endedAt: hookAt,
        status: 'active',
        lastEvent: {
          timestamp: hookAt,
          phase: '测试已完成',
          details: ['输出已经汇总完毕'],
          rawMessagePreview: 'done',
          turnId: 't-final',
        },
      },
    },
  });

  writeRollout(codexRoot, 'latest', [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'latest',
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:10.000Z',
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
    JSON.stringify({
      timestamp: '2026-03-16T02:30:12.000Z',
      type: 'event_msg',
      payload: {
        type: 'task_complete',
      },
    }),
  ]);

  const result = getSessionStatus({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:13.000Z'),
    detectCodexProcess: () => ({
      hasCodexProcess: true,
    }),
  });

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

function testOverridesStaleIdleSummaryWhenNoCodexProcessExists() {
  const rootDir = createTempRoot();
  const hookAt = Date.parse('2026-03-16T02:30:12.000Z');

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: hookAt,
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: Date.parse('2026-03-16T02:29:50.000Z'),
        endedAt: hookAt,
        status: 'active',
        lastEvent: {
          timestamp: hookAt,
          phase: '上一轮已完成',
          details: ['不应该继续占据当前空闲态'],
          rawMessagePreview: 'done',
          turnId: 't-final',
        },
      },
    },
  });

  const result = getSessionStatus({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T03:30:13.000Z'),
    detectCodexProcess: () => ({
      hasCodexProcess: false,
    }),
  });

  assert.strictEqual(result.isActive, false);
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.phase, '暂无 Codex 进程');
}

function run() {
  console.log('Running CodexPin status tests...');
  testReturnsNotConnectedWithoutStatusFile();
  testReturnsIdleWithoutStatusFileWhenHookIsInstalled();
  testShowsNoCodexProcessWhenHookInstalledButProcessMissing();
  testReturnsIdleWhenProjectHasNoSession();
  testMatchesWindowsPathsAndSelectsLatestSession();
  testSelectsLatestSessionGloballyWhenProjectDirIsMissing();
  testPrefersLiveRolloutWhileSessionIsActive();
  testFallsBackToHookSummaryAfterTaskComplete();
  testStopsWorkingWhenTurnIsAborted();
  testKeepsWorkingWhenLatestTurnHasNotCompletedYet();
  testExposesRateLimitsFromLiveRollout();
  testOverridesStaleIdleSummaryWhenNoCodexProcessExists();
  console.log('All CodexPin status tests passed.');
}

run();
