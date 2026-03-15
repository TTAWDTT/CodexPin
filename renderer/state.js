// UMD-style state module so it can be used both in the renderer (browser)
// and in Node tests via require().

const CodexPinStateFactory = () => {
  const WEEKLY_LIMIT_MINUTES = 5 * 60;

  const initialState = () => ({
    session: {
      status: 'idle', // 'idle' | 'active'
      startTimeMs: null,
      elapsedSeconds: 0,
      phase: 'thinking',
      title: '',
    },
    weeklyBudget: {
      weekStartDate: getCurrentWeekStartISO(),
      weeklyLimitMinutes: WEEKLY_LIMIT_MINUTES,
      weeklyUsedMinutes: 0,
    },
    statusLines: [],
  });

  const state = initialState();

  function getCurrentWeekStartISO() {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (day + 6) % 7; // Monday as start of week
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - diffToMonday);
    return monday.toISOString();
  }

  function ensureWeek() {
    const currentWeek = getCurrentWeekStartISO();
    if (state.weeklyBudget.weekStartDate !== currentWeek) {
      state.weeklyBudget.weekStartDate = currentWeek;
      state.weeklyBudget.weeklyUsedMinutes = 0;
    }
  }

  function getState() {
    // Return a shallow clone to avoid accidental external mutation of top-level.
    return {
      session: { ...state.session },
      weeklyBudget: { ...state.weeklyBudget },
      statusLines: [...state.statusLines],
    };
  }

  function startSession(title = '') {
    ensureWeek();
    state.session.status = 'active';
    state.session.startTimeMs = Date.now();
    state.session.elapsedSeconds = 0;
    state.session.phase = 'thinking';
    state.session.title = title;
  }

  function stopSession() {
    if (state.session.status !== 'active' || !state.session.startTimeMs) {
      state.session.status = 'idle';
      return;
    }
    // Prefer using tracked elapsedSeconds (kept in sync via tickElapsedSeconds).
    let elapsedMinutes = Math.floor(state.session.elapsedSeconds / 60);
    if (elapsedMinutes <= 0) {
      const now = Date.now();
      const elapsedMs = now - state.session.startTimeMs;
      elapsedMinutes = Math.floor(elapsedMs / 60000);
    }

    state.session.status = 'idle';
    state.session.startTimeMs = null;
    // Keep the last elapsed seconds for display; will be recomputed when next session starts.

    ensureWeek();
    if (elapsedMinutes > 0) {
      state.weeklyBudget.weeklyUsedMinutes += elapsedMinutes;
    }
  }

  function setIdle(isIdle) {
    if (isIdle) {
      state.session.status = 'idle';
      state.session.startTimeMs = null;
      state.session.elapsedSeconds = 0;
    } else if (state.session.status === 'idle') {
      // If we transition from idle to active without explicit startSession call,
      // treat it as starting an untitled session.
      startSession('');
    }
  }

  function tickElapsedSeconds() {
    if (state.session.status !== 'active' || !state.session.startTimeMs) {
      return;
    }
    const now = Date.now();
    const elapsedMs = now - state.session.startTimeMs;
    state.session.elapsedSeconds = Math.floor(elapsedMs / 1000);
  }

  function setPhase(phase) {
    state.session.phase = phase;
  }

  function appendStatusLine(line) {
    if (typeof line !== 'string' || !line.trim()) return;
    state.statusLines.push(line.trim());
    if (state.statusLines.length > 4) {
      state.statusLines.splice(0, state.statusLines.length - 4);
    }
  }

  function resetWeeklyBudget() {
    state.weeklyBudget.weeklyUsedMinutes = 0;
    state.weeklyBudget.weeklyLimitMinutes = WEEKLY_LIMIT_MINUTES;
    state.weeklyBudget.weekStartDate = getCurrentWeekStartISO();
  }

  // Test-only reset to ensure deterministic tests.
  function resetForTest() {
    const fresh = initialState();
    state.session = fresh.session;
    state.weeklyBudget = fresh.weeklyBudget;
    state.statusLines = fresh.statusLines;
  }

  return {
    getState,
    startSession,
    stopSession,
    setIdle,
    setPhase,
    appendStatusLine,
    tickElapsedSeconds,
    resetWeeklyBudget,
    resetForTest,
    // Test-only escape hatch to manipulate internals in Node tests.
    __unsafeGetInternalStateForTest: () => state,
  };
};

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodexPinState = factory();
  }
})(typeof self !== 'undefined' ? self : this, CodexPinStateFactory);
