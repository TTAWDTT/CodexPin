const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runInstallBootstrap } = require('../electron/installBootstrap');

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-bootstrap-'));
}

function testAutoConfiguresHookWhenMissing() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  const result = runInstallBootstrap({
    homeDir,
    hookCommand,
  });

  assert.strictEqual(result.installState, 'ready');
  assert.strictEqual(result.hookConfigured, true);
  assert.strictEqual(result.autoSetupAttempted, true);
  assert.strictEqual(result.autoSetupSucceeded, true);
}

function testReturnsReadyWhenAlreadyConfigured() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  fs.mkdirSync(path.join(homeDir, '.codex'), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, '.codex', 'config.toml'),
    'notify = ["node", "C:/codexpin/hooks/codexpin-codex-hook.js"]\n',
    'utf8',
  );

  const result = runInstallBootstrap({
    homeDir,
    hookCommand,
  });

  assert.strictEqual(result.installState, 'ready');
  assert.strictEqual(result.hookConfigured, true);
  assert.strictEqual(result.autoSetupAttempted, false);
  assert.strictEqual(result.autoSetupSucceeded, false);
}

function testReturnsFailureWhenSetupThrows() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  const result = runInstallBootstrap({
    homeDir,
    hookCommand,
    ensureNotifyHook: () => {
      throw new Error('write failed');
    },
  });

  assert.strictEqual(result.installState, 'setup_failed');
  assert.strictEqual(result.hookConfigured, false);
  assert.strictEqual(result.autoSetupAttempted, true);
  assert.strictEqual(result.autoSetupSucceeded, false);
  assert.match(result.message, /write failed/);
}

function run() {
  console.log('Running install bootstrap tests...');
  testAutoConfiguresHookWhenMissing();
  testReturnsReadyWhenAlreadyConfigured();
  testReturnsFailureWhenSetupThrows();
  console.log('All install bootstrap tests passed.');
}

run();
