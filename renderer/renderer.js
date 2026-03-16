(() => {
  const sessionTimeEl = document.getElementById('session-time');
  const statusTextEl = document.getElementById('weekly-remaining');
  const statusEls = [
    document.getElementById('status-line-1'),
    document.getElementById('status-line-2'),
    document.getElementById('status-line-3'),
    document.getElementById('status-line-4'),
  ];
  const quotaFiveHourEl = document.getElementById('quota-five-hour');
  const quotaWeeklyEl = document.getElementById('quota-weekly');
  const hookActionEl = document.getElementById('hook-action');

  // Guard: if DOM is not ready for some reason, bail early.
  if (!sessionTimeEl || !statusTextEl) return;

  // CodexPinState is attached as a global in state.js
  const state = window.CodexPinState || window.CodexPinStateFactory?.();
  const statusFeedback = window.CodexPinStatusFeedback || {};
  const bridge = window.codexpin;
  const playCompletionPing =
    typeof statusFeedback.createCompletionPingPlayer === 'function'
      ? statusFeedback.createCompletionPingPlayer()
      : async () => {};
  let previousSessionStatus = null;
  let installationState = null;
  if (!state) {
    sessionTimeEl.textContent = '—';
    statusTextEl.textContent = '—';
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

  function renderStatusLines(lines, options = {}) {
    for (let i = 0; i < statusEls.length; i += 1) {
      const el = statusEls[i];
      if (!el) continue;

      const text = lines[i] ?? '';
      el.textContent = text;

      if (!text) {
        el.className = 'status-line';
        continue;
      }

      if (i === 0) {
        el.className = `status-line status-line--phase${
          options.active ? ' status-line--active' : ''
        }`;
      } else if (i === 1 || i === 2) {
        el.className = 'status-line status-line--detail';
      } else {
        el.className = 'status-line status-line--subtle';
      }
    }
  }

  function renderRateLimits(rateLimits) {
    if (!quotaFiveHourEl || !quotaWeeklyEl) return;

    const fiveHour = rateLimits?.fiveHour;
    const weekly = rateLimits?.weekly;

    quotaFiveHourEl.textContent = fiveHour
      ? `5h ${fiveHour.remainingPercent}%`
      : '5h --';
    quotaWeeklyEl.textContent = weekly
      ? `Week ${weekly.remainingPercent}%`
      : 'Week --';
  }

  function renderHookAction(nextInstallationState) {
    if (!hookActionEl) return;

    if (nextInstallationState?.installState === 'setup_failed') {
      hookActionEl.classList.remove('hook-action--hidden');
      hookActionEl.textContent = '重试接入';
      return;
    }

    hookActionEl.classList.add('hook-action--hidden');
  }

  function renderFromState() {
    const snapshot = state.getState();

    const isIdle = snapshot.session.status !== 'active';
    const elapsedSeconds = isIdle ? 0 : snapshot.session.elapsedSeconds;
    sessionTimeEl.textContent = isIdle ? '待命' : formatSessionTime(elapsedSeconds);

    statusTextEl.textContent = isIdle ? '待命中' : '工作中';
    renderStatusLines(snapshot.statusLines, { active: !isIdle });

    const root = document.getElementById('widget-root');
    if (root) {
      root.dataset.mode = snapshot.mode || 'full';
    }
  }

  async function saveSnapshot() {
    if (!bridge || typeof bridge.saveState !== 'function') return;
    const snapshot = state.getSerializableState();
    try {
      await bridge.saveState({ codexpinState: snapshot });
    } catch {
      // Persistence failures should not break the UI.
    }
  }

  async function bootstrap() {
    // Load persisted state if available.
    if (bridge && typeof bridge.loadState === 'function') {
      try {
        const persisted = await bridge.loadState();
        if (persisted && persisted.codexpinState) {
          state.setInitialState(persisted.codexpinState);
        } else if (persisted) {
          state.setInitialState(persisted);
        }
      } catch {
        // Ignore load errors and start from clean state.
      }
    }

    // If no status lines, seed an initial message.
    const snapshot = state.getState();
    if (!snapshot.mode) {
      state.setMode('full');
    }

    const topbar = document.querySelector('.widget-topbar');
    if (topbar) {
      topbar.addEventListener('dblclick', () => {
        const current = state.getState().mode || 'full';
        state.setMode(current === 'full' ? 'compact' : 'full');
        renderFromState();
        void saveSnapshot();
      });
    }

    if (bridge && typeof bridge.getInstallationStatus === 'function') {
      try {
        installationState = await bridge.getInstallationStatus();
      } catch {
        installationState = null;
      }
    }

    renderHookAction(installationState);

    if (hookActionEl && bridge && typeof bridge.retryInstallation === 'function') {
      hookActionEl.addEventListener('click', async () => {
        hookActionEl.disabled = true;
        hookActionEl.textContent = '接入中...';
        try {
          installationState = await bridge.retryInstallation();
        } catch {
          installationState = {
            installState: 'setup_failed',
            message: 'CodexPin 自动接入失败。',
          };
        } finally {
          renderHookAction(installationState);
          hookActionEl.disabled = false;
        }
      });
    }

    async function pollCodex() {
      if (!bridge || typeof bridge.getSessionStatus !== 'function') {
        renderFromState();
        return;
      }

      try {
        const info = await bridge.getSessionStatus();
        if (!info) {
          renderFromState();
          return;
        }

        if (info.integrationState === 'not_connected') {
          sessionTimeEl.textContent = '—';
          statusTextEl.textContent = info.statusText || '未接入';
        } else {
          const isIdle = !info.isActive;
          const elapsedSeconds = info.elapsedSeconds || 0;
          sessionTimeEl.textContent = isIdle ? '待命' : formatSessionTime(elapsedSeconds);
          statusTextEl.textContent = info.statusText || (isIdle ? '待命中' : '工作中');
        }

        renderHookAction(installationState);

        const root = document.getElementById('widget-root');
        if (root) {
          root.dataset.mode = state.getState().mode || 'full';
        }

        if (
          typeof statusFeedback.shouldPlayCompletionPing === 'function' &&
          statusFeedback.shouldPlayCompletionPing(previousSessionStatus, info)
        ) {
          void playCompletionPing();
        }

        renderStatusLines(
          [info.phase, ...(Array.isArray(info.details) ? info.details : [])],
          { active: Boolean(info.isActive) },
        );
        renderRateLimits(info.rateLimits);

        previousSessionStatus = {
          integrationState: info.integrationState,
          isActive: Boolean(info.isActive),
          sessionId: info.sessionId || null,
        };
      } catch {
        renderFromState();
      }
    }

    // 初始拉取一次，然后定期轮询。
    await pollCodex();
    setInterval(pollCodex, 1500);

    await saveSnapshot();
  }

  void bootstrap();
})();
