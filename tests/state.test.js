const assert = require('assert');

const stateModule = require('../renderer/state');

const {
  getState,
  startSession,
  stopSession,
  setIdle,
  setPhase,
  appendStatusLine,
  resetForTest,
  __unsafeGetInternalStateForTest,
} = stateModule;

function reset() {
  if (typeof resetForTest === 'function') {
    resetForTest();
  }
}

function runTests() {
  console.log('Running state tests...');

  reset();
  {
    const state = getState();
    assert.strictEqual(state.weeklyBudget.weeklyLimitMinutes, 5 * 60, 'weekly limit should be 5h in minutes');
    assert.strictEqual(state.weeklyBudget.weeklyUsedMinutes, 0, 'weekly used should start at 0');
    assert.strictEqual(state.session.status, 'idle', 'initial session should be idle');
  }

  reset();
  {
    startSession('Test');
    let state = getState();
    assert.strictEqual(state.session.status, 'active', 'session should be active after start');
    assert.strictEqual(state.session.title, 'Test', 'session title should be set');
    assert.ok(state.session.startTimeMs > 0, 'session start time should be set');

    // Simulate some elapsed time by tweaking internal elapsedSeconds for test purposes
    const internal = __unsafeGetInternalStateForTest();
    internal.session.elapsedSeconds = 120; // 2 minutes

    stopSession();
    state = getState();
    assert.strictEqual(state.session.status, 'idle', 'session should become idle after stop');
    assert.ok(state.weeklyBudget.weeklyUsedMinutes >= 2, 'weekly used minutes should increase by at least 2 minutes');
  }

  reset();
  {
    appendStatusLine('Line 1');
    appendStatusLine('Line 2');
    appendStatusLine('Line 3');
    appendStatusLine('Line 4');
    appendStatusLine('Line 5');

    const state = getState();
    assert.strictEqual(state.statusLines.length, 4, 'statusLines should keep at most 4 entries');
    assert.deepStrictEqual(state.statusLines, ['Line 2', 'Line 3', 'Line 4', 'Line 5'], 'statusLines should discard oldest entries first');
  }

  reset();
  {
    startSession();
    setIdle(true);
    const state = getState();
    assert.strictEqual(state.session.status, 'idle', 'setIdle(true) should transition to idle');
  }

  reset();
  {
    startSession();
    setPhase('coding');
    const state = getState();
    assert.strictEqual(state.session.phase, 'coding', 'setPhase should update phase');
  }

  console.log('All state tests passed.');
}

runTests();
