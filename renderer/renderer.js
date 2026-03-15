(() => {
  const sessionTimeEl = document.getElementById('session-time');
  const weeklyRemainingEl = document.getElementById('weekly-remaining');
  const statusEls = [
    document.getElementById('status-line-1'),
    document.getElementById('status-line-2'),
    document.getElementById('status-line-3'),
    document.getElementById('status-line-4'),
  ];

  // Guard: if DOM is not ready for some reason, bail early.
  if (!sessionTimeEl || !weeklyRemainingEl) return;

  // CodexPinState is attached as a global in state.js
  const state = window.CodexPinState || window.CodexPinStateFactory?.();
  if (!state) {
    sessionTimeEl.textContent = '—';
    weeklyRemainingEl.textContent = '—';
    return;
  }

  function formatSessionTime(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '0';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const restMinutes = minutes % 60;
      return `${hours}:${restMinutes.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function formatRemaining(weeklyLimitMinutes, weeklyUsedMinutes) {
    const remaining = Math.max(0, weeklyLimitMinutes - weeklyUsedMinutes);
    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;
    return `${hours}h${minutes.toString().padStart(2, '0')}m`;
  }

  function render() {
    const snapshot = state.getState();

    const isIdle = snapshot.session.status !== 'active';
    const elapsedSeconds = isIdle ? 0 : snapshot.session.elapsedSeconds;
    sessionTimeEl.textContent = isIdle ? '待命' : formatSessionTime(elapsedSeconds);

    const remainingMinutes =
      snapshot.weeklyBudget.weeklyLimitMinutes - snapshot.weeklyBudget.weeklyUsedMinutes;
    weeklyRemainingEl.textContent = formatRemaining(
      snapshot.weeklyBudget.weeklyLimitMinutes,
      snapshot.weeklyBudget.weeklyUsedMinutes,
    );
    if (remainingMinutes < 60) {
      weeklyRemainingEl.classList.add('weekly-remaining--low');
    } else {
      weeklyRemainingEl.classList.remove('weekly-remaining--low');
    }

    const lines = snapshot.statusLines;
    for (let i = 0; i < statusEls.length; i += 1) {
      if (!statusEls[i]) continue;
      statusEls[i].textContent = lines[i] ?? '';
    }

    const root = document.getElementById('widget-root');
    if (root) {
      root.dataset.mode = snapshot.mode || 'full';
    }
  }

  // Demo: start an initial untitled session and seed a status line so UI is not empty.
  state.startSession('');
  state.appendStatusLine('CodexPin 就绪，当前为演示会话');
  state.setMode('full');

  const topbar = document.querySelector('.widget-topbar');
  if (topbar) {
    topbar.addEventListener('dblclick', () => {
      const current = state.getState().mode || 'full';
      state.setMode(current === 'full' ? 'compact' : 'full');
      render();
    });
  }

  // Tick timer to keep elapsedSeconds up to date for active sessions.
  setInterval(() => {
    state.tickElapsedSeconds();
    render();
  }, 1000);

  render();
})();
