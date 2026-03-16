const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getSessionStatus, getSessionList } = require('../electron/codexpinStatus');

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

function getSessionStatusIsolated(options) {
  return getSessionStatus({
    codexRoot: createTempRoot(),
    ...options,
  });
}

function getSessionListIsolated(options) {
  return getSessionList({
    codexRoot: createTempRoot(),
    ...options,
  });
}

function testReturnsNotConnectedWithoutStatusFile() {
  const rootDir = createTempRoot();
  const result = getSessionStatusIsolated({
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
  const result = getSessionStatusIsolated({
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
  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

function testAllowsSelectingASpecificSessionInsteadOfTheLatestOne() {
  const rootDir = createTempRoot();
  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {
      older: {
        sessionId: 'older',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 1000,
        endedAt: 9000,
        status: 'completed',
        title: 'Older thread',
        lastEvent: {
          timestamp: 9000,
          phase: '较早线程',
          details: ['older detail'],
          rawMessagePreview: 'older',
          turnId: 't-older',
        },
      },
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 20000,
        endedAt: null,
        status: 'active',
        title: 'Latest thread',
        lastEvent: {
          timestamp: 29000,
          phase: '最新线程',
          details: ['latest detail'],
          rawMessagePreview: 'latest',
          turnId: 't-latest',
        },
      },
    },
  });

  const result = getSessionStatusIsolated({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 30000,
    selectedSessionId: 'older',
    detectCodexProcess: () => ({
      hasCodexProcess: true,
    }),
  });

  assert.strictEqual(result.sessionId, 'older');
  assert.strictEqual(result.phase, '较早线程');
  assert.deepStrictEqual(result.details, ['older detail']);
  assert.strictEqual(result.statusText, '待命中');
}

function testListsSessionsForTheCurrentViewSortedByLatestEvent() {
  const rootDir = createTempRoot();
  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {
      older: {
        sessionId: 'older',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 1000,
        endedAt: 9000,
        status: 'completed',
        title: 'Older thread',
        lastEvent: {
          timestamp: 9000,
          phase: '较早线程',
          details: ['older detail'],
          rawMessagePreview: 'older',
          turnId: 't-older',
        },
      },
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 20000,
        endedAt: null,
        status: 'active',
        title: 'Latest thread',
        lastEvent: {
          timestamp: 29000,
          phase: '最新线程',
          details: ['latest detail'],
          rawMessagePreview: 'latest',
          turnId: 't-latest',
        },
      },
      otherProject: {
        sessionId: 'other-project',
        workingDirectory: 'D:\\Github\\OtherProject',
        startedAt: 25000,
        endedAt: null,
        status: 'active',
        title: 'Other project thread',
        lastEvent: {
          timestamp: 29500,
          phase: '别的项目',
          details: ['should be filtered'],
          rawMessagePreview: 'other',
          turnId: 't-other',
        },
      },
    },
  });

  const result = getSessionListIsolated({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 30000,
  });

  assert.deepStrictEqual(
    result.map((session) => session.sessionId),
    ['latest', 'older'],
  );
  assert.strictEqual(result[0].title, 'Latest thread');
  assert.strictEqual(result[0].statusText, '工作中');
  assert.strictEqual(result[1].statusText, '待命中');
}

function testSessionListKeepsActiveIndicatorForOpenRolloutTurnsBeyondShortFreshnessWindow() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const sessionId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {},
  });

  writeRollout(codexRoot, sessionId, [
    JSON.stringify({
      timestamp: '2026-03-16T02:29:50.000Z',
      type: 'session_meta',
      payload: {
        id: sessionId,
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
        name: 'apply_patch',
        input: '{"command":"patch files"}',
      },
    }),
  ]);

  const result = getSessionListIsolated({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:35.000Z'),
  });

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].sessionId, sessionId);
  assert.strictEqual(result[0].statusText, '工作中');
  assert.strictEqual(result[0].isActive, true);
}

function testSessionListShowsIdleForRecentlyCompletedRolloutTurns() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const sessionId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {},
  });

  writeRollout(codexRoot, sessionId, [
    JSON.stringify({
      timestamp: '2026-03-16T02:29:50.000Z',
      type: 'session_meta',
      payload: {
        id: sessionId,
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
        name: 'apply_patch',
        input: '{"command":"patch files"}',
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

  const result = getSessionListIsolated({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T02:30:13.000Z'),
  });

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].sessionId, sessionId);
  assert.strictEqual(result[0].statusText, '待命中');
  assert.strictEqual(result[0].isActive, false);
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
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

  const result = getSessionStatusIsolated({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T03:30:13.000Z'),
    detectCodexProcess: () => ({
      hasCodexProcess: false,
    }),
  });

  assert.strictEqual(result.isActive, false);
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.phase, '上一轮已完成');
  assert.deepStrictEqual(result.details, ['不应该继续占据当前空闲态']);
}

function testSkipsLiveRolloutLookupForHistoricalSession() {
  const rootDir = createTempRoot();
  const hookAt = Date.parse('2026-03-16T02:30:12.000Z');
  let liveLookupCount = 0;

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: hookAt,
    sessions: {
      latest: {
        sessionId: 'latest',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: Date.parse('2026-03-16T02:29:50.000Z'),
        endedAt: hookAt,
        status: 'completed',
        lastEvent: {
          timestamp: hookAt,
          phase: '历史总结',
          details: ['这里应该直接使用 hook 摘要'],
          rawMessagePreview: 'done',
          turnId: 't-final',
        },
      },
    },
  });

  const result = getSessionStatusIsolated({
    rootDir,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: Date.parse('2026-03-16T10:30:13.000Z'),
    getLiveRolloutStatus: () => {
      liveLookupCount += 1;
      return null;
    },
  });

  assert.strictEqual(liveLookupCount, 0);
  assert.strictEqual(result.phase, '历史总结');
  assert.deepStrictEqual(result.details, ['这里应该直接使用 hook 摘要']);
}

function testSessionListFiltersOutSyntheticSessionsButKeepsRealRolloutThreads() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const realSessionId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';
  const historicalRolloutOnlyId = '019cf1f1-4d8f-74d0-859b-0a653552d3b6';

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {
      'manual-test-session': {
        sessionId: 'manual-test-session',
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 1000,
        endedAt: 2000,
        status: 'completed',
        lastEvent: {
          timestamp: 2000,
          phase: 'Synthetic thread',
          details: ['should be hidden'],
          rawMessagePreview: 'synthetic',
          turnId: 't-synthetic',
        },
      },
      [realSessionId]: {
        sessionId: realSessionId,
        workingDirectory: 'D:\\Github\\CodexPin',
        startedAt: 20000,
        endedAt: null,
        status: 'active',
        lastEvent: {
          timestamp: 29000,
          phase: 'Real hook thread',
          details: ['real'],
          rawMessagePreview: 'real',
          turnId: 't-real',
        },
      },
    },
  });

  writeRollout(codexRoot, realSessionId, [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: realSessionId,
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Real rollout thread',
        phase: 'commentary',
      },
    }),
  ]);

  writeRollout(codexRoot, historicalRolloutOnlyId, [
    JSON.stringify({
      timestamp: '2026-03-16T01:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: historicalRolloutOnlyId,
        timestamp: '2026-03-16T01:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T01:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Historical rollout only thread',
        phase: 'commentary',
      },
    }),
  ]);

  const result = getSessionListIsolated({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    nowMs: 30000,
  });

  assert.deepStrictEqual(
    result.map((session) => session.sessionId),
    [realSessionId, historicalRolloutOnlyId],
  );
}

function testCanSelectRolloutOnlyHistoricalThread() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const sessionId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {},
  });

  writeRollout(codexRoot, sessionId, [
    JSON.stringify({
      timestamp: '2026-03-16T01:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: sessionId,
        timestamp: '2026-03-16T01:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T01:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Historical rollout only thread',
        phase: 'commentary',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T01:30:06.000Z',
      type: 'event_msg',
      payload: {
        type: 'task_complete',
      },
    }),
  ]);

  const result = getSessionStatusIsolated({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    selectedSessionId: sessionId,
    nowMs: Date.parse('2026-03-16T10:30:13.000Z'),
  });

  assert.strictEqual(result.sessionId, sessionId);
  assert.strictEqual(result.phase, 'Historical rollout only thread');
  assert.deepStrictEqual(result.details, []);
}

function testSessionListCanListGlobalThreadsAcrossProjects() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const currentProjectId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';
  const otherProjectId = '019cf1f1-4d8f-74d0-859b-0a653552d3b6';

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {},
  });

  writeRollout(codexRoot, currentProjectId, [
    JSON.stringify({
      timestamp: '2026-03-16T01:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: currentProjectId,
        timestamp: '2026-03-16T01:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T01:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'CodexPin thread',
        phase: 'commentary',
      },
    }),
  ]);

  writeRollout(codexRoot, otherProjectId, [
    JSON.stringify({
      timestamp: '2026-03-16T02:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: otherProjectId,
        timestamp: '2026-03-16T02:29:50.000Z',
        cwd: 'D:\\Github\\Aelin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T02:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Aelin thread',
        phase: 'commentary',
      },
    }),
  ]);

  const result = getSessionList({
    rootDir,
    codexRoot,
    projectDir: 'D:\\Github\\CodexPin',
    preferGlobalSession: true,
    nowMs: 30000,
  });

  assert.deepStrictEqual(
    result.map((session) => session.sessionId),
    [otherProjectId, currentProjectId],
  );
}

function testFallsBackToGlobalRateLimitsWhenSelectedThreadHasNone() {
  const rootDir = createTempRoot();
  const codexRoot = createTempRoot();
  const currentProjectId = '019cf1f1-4d8f-74d0-859b-0a653552d3b5';
  const otherProjectId = '019cf1f1-4d8f-74d0-859b-0a653552d3b6';

  writeStatus(rootDir, {
    version: 1,
    lastUpdated: 30000,
    sessions: {},
  });

  writeRollout(codexRoot, currentProjectId, [
    JSON.stringify({
      timestamp: '2026-03-16T03:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: currentProjectId,
        timestamp: '2026-03-16T03:29:50.000Z',
        cwd: 'D:\\Github\\CodexPin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T03:30:10.000Z',
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
  ]);

  writeRollout(codexRoot, otherProjectId, [
    JSON.stringify({
      timestamp: '2026-03-16T01:30:00.000Z',
      type: 'session_meta',
      payload: {
        id: otherProjectId,
        timestamp: '2026-03-16T01:29:50.000Z',
        cwd: 'D:\\Github\\Aelin',
      },
    }),
    JSON.stringify({
      timestamp: '2026-03-16T01:30:05.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Aelin thread',
        phase: 'commentary',
      },
    }),
  ]);

  const result = getSessionStatus({
    rootDir,
    codexRoot,
    projectDir: null,
    preferGlobalSession: true,
    selectedSessionId: otherProjectId,
    nowMs: Date.parse('2026-03-16T10:30:13.000Z'),
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

function run() {
  console.log('Running CodexPin status tests...');
  testReturnsNotConnectedWithoutStatusFile();
  testReturnsIdleWithoutStatusFileWhenHookIsInstalled();
  testShowsNoCodexProcessWhenHookInstalledButProcessMissing();
  testReturnsIdleWhenProjectHasNoSession();
  testMatchesWindowsPathsAndSelectsLatestSession();
  testSelectsLatestSessionGloballyWhenProjectDirIsMissing();
  testAllowsSelectingASpecificSessionInsteadOfTheLatestOne();
  testListsSessionsForTheCurrentViewSortedByLatestEvent();
  testSessionListKeepsActiveIndicatorForOpenRolloutTurnsBeyondShortFreshnessWindow();
  testSessionListShowsIdleForRecentlyCompletedRolloutTurns();
  testPrefersLiveRolloutWhileSessionIsActive();
  testFallsBackToHookSummaryAfterTaskComplete();
  testStopsWorkingWhenTurnIsAborted();
  testKeepsWorkingWhenLatestTurnHasNotCompletedYet();
  testExposesRateLimitsFromLiveRollout();
  testOverridesStaleIdleSummaryWhenNoCodexProcessExists();
  testSkipsLiveRolloutLookupForHistoricalSession();
  testSessionListFiltersOutSyntheticSessionsButKeepsRealRolloutThreads();
  testCanSelectRolloutOnlyHistoricalThread();
  testSessionListCanListGlobalThreadsAcrossProjects();
  testFallsBackToGlobalRateLimitsWhenSelectedThreadHasNone();
  console.log('All CodexPin status tests passed.');
}

run();
