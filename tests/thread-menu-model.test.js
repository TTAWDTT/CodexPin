const assert = require('assert');

const {
  buildThreadMenuSignature,
  findSessionById,
  getThreadMenuLabel,
} = require('../renderer/threadMenuModel');

function testBuildThreadMenuSignatureIsStableForEquivalentLists() {
  const first = buildThreadMenuSignature([
    { sessionId: 'a', title: 'Alpha', isActive: true },
    { sessionId: 'b', title: 'Beta', isActive: false },
  ]);
  const second = buildThreadMenuSignature([
    { sessionId: 'a', title: 'Alpha', isActive: true },
    { sessionId: 'b', title: 'Beta', isActive: false },
  ]);

  assert.strictEqual(
    first,
    second,
    'equivalent session lists should produce the same render signature',
  );
}

function testBuildThreadMenuSignatureChangesWhenVisibleSessionContentChanges() {
  const first = buildThreadMenuSignature([
    { sessionId: 'a', title: 'Alpha', isActive: true },
  ]);
  const second = buildThreadMenuSignature([
    { sessionId: 'a', title: 'Alpha updated', isActive: true },
  ]);

  assert.notStrictEqual(
    first,
    second,
    'changing visible title content should invalidate the render signature',
  );
}

function testGetThreadMenuLabelPrefersTheSelectedSessionTitle() {
  const label = getThreadMenuLabel({
    sessions: [
      { sessionId: 'a', title: 'Alpha' },
      { sessionId: 'b', title: 'Beta' },
    ],
    selectedSessionId: 'b',
    fallbackLabel: '待命中',
  });

  assert.strictEqual(label, 'Beta');
}

function testGetThreadMenuLabelFallsBackWhenSelectionIsMissing() {
  const label = getThreadMenuLabel({
    sessions: [{ sessionId: 'a', title: 'Alpha' }],
    selectedSessionId: 'missing',
    fallbackLabel: '待命中',
  });

  assert.strictEqual(label, '待命中');
}

function testFindSessionByIdMatchesTheExpectedThread() {
  const matched = findSessionById(
    [
      { sessionId: 'thread-a', title: 'Alpha' },
      { sessionId: 'thread-b', title: 'Beta' },
    ],
    'thread-b',
  );

  assert.deepStrictEqual(matched, { sessionId: 'thread-b', title: 'Beta' });
}

function run() {
  testBuildThreadMenuSignatureIsStableForEquivalentLists();
  testBuildThreadMenuSignatureChangesWhenVisibleSessionContentChanges();
  testGetThreadMenuLabelPrefersTheSelectedSessionTitle();
  testGetThreadMenuLabelFallsBackWhenSelectionIsMissing();
  testFindSessionByIdMatchesTheExpectedThread();
  console.log('All thread menu model tests passed.');
}

run();
