const assert = require('assert');

const {
  parseLaunchMode,
  extractHookPayloadArg,
} = require('../electron/runtimeMode');
const { handleHookRuntime } = require('../electron/hookRuntime');

function testDetectsNormalLaunchMode() {
  const result = parseLaunchMode(['C:\\Program Files\\CodexPin\\CodexPin.exe']);
  assert.strictEqual(result.isHookMode, false);
}

function testDetectsPackagedHookLaunchMode() {
  const rawPayload = '{"type":"agent-turn-complete"}';
  const result = parseLaunchMode([
    'C:\\Program Files\\CodexPin\\CodexPin.exe',
    '--codex-hook',
    rawPayload,
  ]);

  assert.strictEqual(result.isHookMode, true);
  assert.strictEqual(extractHookPayloadArg(result.argv), rawPayload);
}

function testDetectsDevHookLaunchMode() {
  const rawPayload = '{"type":"agent-turn-complete"}';
  const result = parseLaunchMode([
    'D:\\Github\\CodexPin\\node_modules\\.bin\\electron.exe',
    'D:\\Github\\CodexPin',
    '--codex-hook',
    rawPayload,
  ]);

  assert.strictEqual(result.isHookMode, true);
  assert.strictEqual(extractHookPayloadArg(result.argv), rawPayload);
}

function testHandlesHookRuntimeWithoutLaunchingUi() {
  let receivedPayload = null;

  const handled = handleHookRuntime({
    argv: [
      'C:\\Program Files\\CodexPin\\CodexPin.exe',
      '--codex-hook',
      '{"type":"agent-turn-complete","thread-id":"s1"}',
    ],
    runHookPayload: (rawPayload) => {
      receivedPayload = rawPayload;
    },
  });

  assert.strictEqual(handled, true);
  assert.strictEqual(
    receivedPayload,
    '{"type":"agent-turn-complete","thread-id":"s1"}',
  );
}

function run() {
  console.log('Running runtime mode tests...');
  testDetectsNormalLaunchMode();
  testDetectsPackagedHookLaunchMode();
  testDetectsDevHookLaunchMode();
  testHandlesHookRuntimeWithoutLaunchingUi();
  console.log('All runtime mode tests passed.');
}

run();
