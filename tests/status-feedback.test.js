const assert = require('assert');

const { shouldPlayCompletionPing } = require('../renderer/statusFeedback');

function testDoesNotPlayWithoutPreviousStatus() {
  assert.strictEqual(
    shouldPlayCompletionPing(null, {
      integrationState: 'connected',
      isActive: false,
      sessionId: 's1',
    }),
    false,
  );
}

function testPlaysWhenActiveSessionBecomesIdle() {
  assert.strictEqual(
    shouldPlayCompletionPing(
      {
        integrationState: 'connected',
        isActive: true,
        sessionId: 's1',
      },
      {
        integrationState: 'connected',
        isActive: false,
        sessionId: 's1',
      },
    ),
    true,
  );
}

function testDoesNotPlayForDifferentSession() {
  assert.strictEqual(
    shouldPlayCompletionPing(
      {
        integrationState: 'connected',
        isActive: true,
        sessionId: 's1',
      },
      {
        integrationState: 'connected',
        isActive: false,
        sessionId: 's2',
      },
    ),
    false,
  );
}

function testDoesNotPlayWhenStillActive() {
  assert.strictEqual(
    shouldPlayCompletionPing(
      {
        integrationState: 'connected',
        isActive: true,
        sessionId: 's1',
      },
      {
        integrationState: 'connected',
        isActive: true,
        sessionId: 's1',
      },
    ),
    false,
  );
}

function run() {
  console.log('Running status feedback tests...');
  testDoesNotPlayWithoutPreviousStatus();
  testPlaysWhenActiveSessionBecomesIdle();
  testDoesNotPlayForDifferentSession();
  testDoesNotPlayWhenStillActive();
  console.log('All status feedback tests passed.');
}

run();
