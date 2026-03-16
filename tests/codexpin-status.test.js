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
  });

  assert.strictEqual(result.isActive, false);
  assert.strictEqual(result.statusText, '待命中');
  assert.strictEqual(result.phase, '测试已完成');
  assert.deepStrictEqual(result.details, ['输出已经汇总完毕']);
  assert.strictEqual(result.elapsedSeconds, 22);
}

function run() {
  console.log('Running CodexPin status tests...');
  testReturnsNotConnectedWithoutStatusFile();
  testReturnsIdleWhenProjectHasNoSession();
  testMatchesWindowsPathsAndSelectsLatestSession();
  testPrefersLiveRolloutWhileSessionIsActive();
  testFallsBackToHookSummaryAfterTaskComplete();
  console.log('All CodexPin status tests passed.');
}

run();
