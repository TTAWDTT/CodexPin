const DEFAULT_WIDGET_WIDTH = 300;
const DEFAULT_WIDGET_HEIGHT = 164;

function normalizeWindowBounds(bounds) {
  const normalized = {
    width: DEFAULT_WIDGET_WIDTH,
    height: DEFAULT_WIDGET_HEIGHT,
  };

  if (!bounds || typeof bounds !== 'object') {
    return normalized;
  }

  if (typeof bounds.x === 'number') {
    normalized.x = bounds.x;
  }

  if (typeof bounds.y === 'number') {
    normalized.y = bounds.y;
  }

  return normalized;
}

module.exports = {
  DEFAULT_WIDGET_WIDTH,
  DEFAULT_WIDGET_HEIGHT,
  normalizeWindowBounds,
};
