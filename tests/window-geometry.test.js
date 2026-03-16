const assert = require('assert');

const {
  DEFAULT_WIDGET_HEIGHT,
  DEFAULT_WIDGET_WIDTH,
  normalizeWindowBounds,
} = require('../electron/windowGeometry');

function testReturnsDefaultSizeWithoutStoredBounds() {
  const result = normalizeWindowBounds();

  assert.strictEqual(result.width, DEFAULT_WIDGET_WIDTH);
  assert.strictEqual(result.height, DEFAULT_WIDGET_HEIGHT);
}

function testPreservesPositionButForcesNewWidgetSize() {
  const result = normalizeWindowBounds({
    x: 1280,
    y: 240,
    width: 360,
    height: 220,
  });

  assert.strictEqual(result.x, 1280);
  assert.strictEqual(result.y, 240);
  assert.strictEqual(result.width, DEFAULT_WIDGET_WIDTH);
  assert.strictEqual(result.height, DEFAULT_WIDGET_HEIGHT);
}

function run() {
  console.log('Running window geometry tests...');
  testReturnsDefaultSizeWithoutStoredBounds();
  testPreservesPositionButForcesNewWidgetSize();
  console.log('All window geometry tests passed.');
}

run();
