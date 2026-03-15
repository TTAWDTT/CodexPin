const fs = require('fs');
const path = require('path');

function createStorage(app) {
  const userDataPath = app.getPath('userData');
  const stateFile = path.join(userDataPath, 'codexpin-state.json');

  function readFileSafe() {
    try {
      if (!fs.existsSync(stateFile)) {
        return null;
      }
      const raw = fs.readFileSync(stateFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeFileSafe(payload) {
    try {
      const dir = path.dirname(stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(stateFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Swallow errors; renderer should handle missing persistence gracefully.
    }
  }

  function loadState() {
    return Promise.resolve(readFileSafe());
  }

  function saveState(state) {
    const current = readFileSafe() || {};
    const next = { ...current, ...state };
    writeFileSafe(next);
    return Promise.resolve();
  }

  function saveWindowBounds(bounds) {
    const current = readFileSafe() || {};
    const next = { ...current, windowBounds: bounds };
    writeFileSafe(next);
    return Promise.resolve();
  }

  return {
    loadState,
    saveState,
    saveWindowBounds,
  };
}

module.exports = { createStorage };

