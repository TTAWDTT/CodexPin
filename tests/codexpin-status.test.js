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

function run() {
  console.log('Running CodexPin status tests...');
  testReturnsNotConnectedWithoutStatusFile();
  testReturnsIdleWhenProjectHasNoSession();
  testMatchesWindowsPathsAndSelectsLatestSession();
  console.log('All CodexPin status tests passed.');
}

run();

