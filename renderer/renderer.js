(() => {
  const sessionTimeEl = document.getElementById('session-time');
  const threadTriggerEl = document.getElementById('thread-trigger');
  const threadIndicatorEl = document.getElementById('thread-indicator');
  const threadLabelEl = document.getElementById('thread-label');
  const threadMenuEl = document.getElementById('thread-menu');
  const threadOverlayEl = document.getElementById('thread-overlay');
  const threadMenuListEl = document.getElementById('thread-menu-list');
  const threadMenuScrollbarEl = document.getElementById('thread-menu-scrollbar');
  const threadMenuScrollbarThumbEl = document.getElementById('thread-menu-scrollbar-thumb');
  const threadSwitcherEl = document.querySelector('.thread-switcher');
  const statusEls = [
    document.getElementById('status-line-1'),
    document.getElementById('status-line-2'),
    document.getElementById('status-line-3'),
    document.getElementById('status-line-4'),
  ];
  const quotaFiveHourEl = document.getElementById('quota-five-hour');
  const quotaWeeklyEl = document.getElementById('quota-weekly');
  const hookActionEl = document.getElementById('hook-action');

  if (!sessionTimeEl || !threadLabelEl) return;

  const state = window.CodexPinState || window.CodexPinStateFactory?.();
  const statusFeedback = window.CodexPinStatusFeedback || {};
  const threadMenuModel = window.CodexPinThreadMenuModel || {};
  const bridge = window.codexpin;
  const playCompletionPing =
    typeof statusFeedback.createCompletionPingPlayer === 'function'
      ? statusFeedback.createCompletionPingPlayer()
      : async () => {};
  const buildThreadMenuSignature =
    typeof threadMenuModel.buildThreadMenuSignature === 'function'
      ? threadMenuModel.buildThreadMenuSignature
      : (sessions) => JSON.stringify(sessions || []);
  const findSessionById =
    typeof threadMenuModel.findSessionById === 'function'
      ? threadMenuModel.findSessionById
      : (sessions, sessionId) =>
          (Array.isArray(sessions)
            ? sessions.find((session) => session?.sessionId === sessionId)
            : null) || null;
  const getThreadMenuLabel =
    typeof threadMenuModel.getThreadMenuLabel === 'function'
      ? threadMenuModel.getThreadMenuLabel
      : ({ sessions, selectedSessionId, fallbackLabel }) => {
          const matched = Array.isArray(sessions)
            ? sessions.find((session) => session?.sessionId === selectedSessionId)
            : null;
          return matched?.title || fallbackLabel || '待命中';
        };
  let previousSessionStatus = null;
  let installationState = null;
  let currentSessionList = [];
  let currentThreadMenuSignature = '';
  let currentInfo = null;
  const sessionStatusCache = new Map();
  let threadMenuOpen = false;

  if (!state) {
    sessionTimeEl.textContent = '—';
    threadLabelEl.textContent = '未接入';
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

  function truncateThreadLabel(text, maxLength = 18) {
    if (!text || typeof text !== 'string') return '待命中';
    const normalized = text.trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1)}…`;
  }

  function getIndicatorMode(info) {
    if (!info) return 'idle';
    if (info.integrationState === 'not_connected') return 'error';
    if (info.phase === '暂无 Codex 进程') return 'offline';
    return info.isActive ? 'working' : 'idle';
  }

  function applyIndicatorMode(mode) {
    if (!threadIndicatorEl) return;
    threadIndicatorEl.className = `thread-indicator thread-indicator--${mode || 'idle'}`;
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

  function setThreadMenuOpen(isOpen) {
    threadMenuOpen = Boolean(isOpen);
    const root = document.getElementById('widget-root');

    if (threadMenuEl) {
      threadMenuEl.classList.toggle('thread-menu--hidden', !threadMenuOpen);
    }

    if (root) {
      root.dataset.threadMenuOpen = threadMenuOpen ? 'true' : 'false';
    }

    if (threadOverlayEl) {
      threadOverlayEl.classList.toggle('thread-overlay--hidden', !threadMenuOpen);
    }

    if (threadTriggerEl) {
      threadTriggerEl.setAttribute('aria-expanded', threadMenuOpen ? 'true' : 'false');
      threadTriggerEl.classList.toggle('thread-trigger--open', threadMenuOpen);
    }

    if (threadMenuOpen) {
      window.requestAnimationFrame(syncThreadMenuScrollbar);
    }
  }

  function renderThreadMenuSelection(selectedSessionId) {
    if (!threadMenuListEl) return;

    const items = threadMenuListEl.querySelectorAll('.thread-menu-item');
    for (const item of items) {
      item.classList.toggle(
        'thread-menu-item--selected',
        item.dataset.sessionId === (selectedSessionId || ''),
      );
    }
  }

  function syncThreadMenuScrollbar() {
    if (!threadMenuEl || !threadMenuListEl || !threadMenuScrollbarEl || !threadMenuScrollbarThumbEl) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = threadMenuListEl;
    const isScrollable = scrollHeight - clientHeight > 1;
    threadMenuEl.classList.toggle('thread-menu--scrollable', isScrollable);

    if (!isScrollable) {
      threadMenuScrollbarThumbEl.style.height = '0px';
      threadMenuScrollbarThumbEl.style.transform = 'translateY(0)';
      return;
    }

    const trackHeight = threadMenuScrollbarEl.clientHeight;
    const minimumThumbHeight = 18;
    const thumbHeight = Math.max(
      minimumThumbHeight,
      Math.round((clientHeight / scrollHeight) * trackHeight),
    );
    const maxOffset = Math.max(0, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
    const offset = Math.round((scrollTop / maxScrollTop) * maxOffset);

    threadMenuScrollbarThumbEl.style.height = `${thumbHeight}px`;
    threadMenuScrollbarThumbEl.style.transform = `translateY(${offset}px)`;
  }

  function suppressPointerDrag(event) {
    event.stopPropagation();
  }

  function isPrimaryPointer(event) {
    return !event || typeof event.button !== 'number' || event.button === 0;
  }

  async function activateSession(session) {
    const nextSessionId = session.sessionId || null;

    if (typeof state.setSelectedSessionId === 'function') {
      state.setSelectedSessionId(nextSessionId);
    }

    renderThreadMenuSelection(nextSessionId);
    threadLabelEl.textContent = truncateThreadLabel(
      getThreadMenuLabel({
        sessions: currentSessionList,
        selectedSessionId: nextSessionId,
        fallbackLabel: session.title || '待命中',
      }),
    );
    applyIndicatorMode(session.isActive ? 'working' : 'idle');
    renderStatusLines([session.phase || session.title || '待命中'], {
      active: Boolean(session.isActive),
    });

    const cachedInfo = nextSessionId ? sessionStatusCache.get(nextSessionId) : null;
    if (cachedInfo) {
      renderSessionInfo(cachedInfo);
    }

    setThreadMenuOpen(false);
    void saveSnapshot();
    await pollCodex({
      skipListRefresh: true,
      selectedSessionIdOverride: nextSessionId,
    });
  }

  function buildThreadMenuItem(session, selectedSessionId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `thread-menu-item${
      session.sessionId === selectedSessionId ? ' thread-menu-item--selected' : ''
    }`;
    button.dataset.sessionId = session.sessionId || '';

    const indicator = document.createElement('span');
    indicator.className = `thread-indicator thread-indicator--${
      session.isActive ? 'working' : 'idle'
    }`;

    const copy = document.createElement('span');
    copy.className = 'thread-menu-item-copy';

    const title = document.createElement('span');
    title.className = 'thread-menu-item-title';
    title.textContent = session.title || 'Untitled thread';

    copy.appendChild(title);
    button.appendChild(indicator);
    button.appendChild(copy);

    return button;
  }

  function renderThreadMenu(info) {
    if (!threadMenuListEl) return;

    const nextSignature = buildThreadMenuSignature(currentSessionList);
    const selectedSessionId = info?.sessionId || state.getState().selectedSessionId || null;

    if (nextSignature === currentThreadMenuSignature) {
      renderThreadMenuSelection(selectedSessionId);
      window.requestAnimationFrame(syncThreadMenuScrollbar);
      return;
    }

    const previousScrollTop = threadMenuListEl.scrollTop;
    threadMenuListEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const session of currentSessionList) {
      fragment.appendChild(buildThreadMenuItem(session, selectedSessionId));
    }

    threadMenuListEl.appendChild(fragment);
    threadMenuListEl.scrollTop = previousScrollTop;
    currentThreadMenuSignature = nextSignature;
    renderThreadMenuSelection(selectedSessionId);
    window.requestAnimationFrame(syncThreadMenuScrollbar);
  }

  function renderThreadSwitcher(info) {
    const selectedSessionId = info?.sessionId || state.getState().selectedSessionId || null;
    const label = getThreadMenuLabel({
      sessions: currentSessionList,
      selectedSessionId,
      fallbackLabel: info?.statusText || '待命中',
    });

    threadLabelEl.textContent = truncateThreadLabel(label);
    applyIndicatorMode(getIndicatorMode(info));

    if (threadTriggerEl) {
      const isDisabled = currentSessionList.length <= 1;
      threadTriggerEl.classList.toggle('thread-trigger--disabled', isDisabled);
      threadTriggerEl.disabled = false;
      if (isDisabled && threadMenuOpen) {
        setThreadMenuOpen(false);
      }
    }

    renderThreadMenu(info);
  }

  function renderSessionInfo(info) {
    currentInfo = info;

    if (info.integrationState === 'not_connected') {
      sessionTimeEl.textContent = '—';
    } else {
      const isIdle = !info.isActive;
      const elapsedSeconds = info.elapsedSeconds || 0;
      sessionTimeEl.textContent = isIdle ? '待命' : formatSessionTime(elapsedSeconds);
    }

    const root = document.getElementById('widget-root');
    if (root) {
      root.dataset.mode = state.getState().mode || 'full';
    }

    renderThreadSwitcher(info);
    renderStatusLines(
      [info.phase, ...(Array.isArray(info.details) ? info.details : [])],
      { active: Boolean(info.isActive) },
    );
    renderRateLimits(info.rateLimits);
  }

  function renderFromState() {
    const snapshot = state.getState();

    const isIdle = snapshot.session.status !== 'active';
    const elapsedSeconds = isIdle ? 0 : snapshot.session.elapsedSeconds;
    sessionTimeEl.textContent = isIdle ? '待命' : formatSessionTime(elapsedSeconds);

    threadLabelEl.textContent = '待命中';
    applyIndicatorMode('idle');
    renderStatusLines(snapshot.statusLines, { active: !isIdle });
    renderThreadMenu(currentInfo);

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

  async function pollCodex(options = {}) {
    if (!bridge || typeof bridge.getSessionStatus !== 'function') {
      renderFromState();
      return;
    }

    try {
      if (!options.skipListRefresh) {
        currentSessionList =
          bridge && typeof bridge.getSessionList === 'function'
            ? await bridge.getSessionList()
            : [];

        const selectedSessionId = state.getState().selectedSessionId || null;
        if (
          selectedSessionId &&
          !currentSessionList.some((session) => session.sessionId === selectedSessionId)
        ) {
          if (typeof state.setSelectedSessionId === 'function') {
            state.setSelectedSessionId(null);
          }
          void saveSnapshot();
        }
      }

      const requestedSessionId =
        typeof options.selectedSessionIdOverride === 'string'
          ? options.selectedSessionIdOverride
          : state.getState().selectedSessionId || null;

      const info = await bridge.getSessionStatus(requestedSessionId);
      if (!info) {
        renderFromState();
        return;
      }

      if (info.sessionId) {
        sessionStatusCache.set(info.sessionId, {
          ...info,
          details: Array.isArray(info.details) ? [...info.details] : [],
        });
      }

      renderHookAction(installationState);

      if (
        typeof statusFeedback.shouldPlayCompletionPing === 'function' &&
        statusFeedback.shouldPlayCompletionPing(previousSessionStatus, info)
      ) {
        void playCompletionPing();
      }

      renderSessionInfo(info);

      previousSessionStatus = {
        integrationState: info.integrationState,
        isActive: Boolean(info.isActive),
        sessionId: info.sessionId || null,
      };
    } catch {
      renderFromState();
    }
  }

  async function bootstrap() {
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

    const snapshot = state.getState();
    if (!snapshot.mode) {
      state.setMode('full');
    }

    if (threadTriggerEl) {
      threadTriggerEl.addEventListener('pointerdown', suppressPointerDrag);
      threadTriggerEl.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      threadTriggerEl.addEventListener('mousedown', (event) => {
        if (!isPrimaryPointer(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (currentSessionList.length <= 1) return;
        setThreadMenuOpen(!threadMenuOpen);
      });
    }

    if (threadMenuEl) {
      threadMenuEl.addEventListener('pointerdown', suppressPointerDrag);
      threadMenuEl.addEventListener('mousedown', suppressPointerDrag);
      threadMenuEl.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }

    document.addEventListener('click', (event) => {
      if (!threadMenuOpen || !threadSwitcherEl) return;
      if (threadSwitcherEl.contains(event.target)) return;
      setThreadMenuOpen(false);
    });

    if (threadMenuListEl) {
      threadMenuListEl.addEventListener('mousedown', (event) => {
        if (!isPrimaryPointer(event)) return;
        const targetItem = event.target.closest('.thread-menu-item');
        if (!targetItem || !threadMenuListEl.contains(targetItem)) return;

        const session = findSessionById(currentSessionList, targetItem.dataset.sessionId || '');
        if (!session) return;

        event.preventDefault();
        event.stopPropagation();
        void activateSession(session);
      });
      threadMenuListEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const targetItem = event.target.closest('.thread-menu-item');
        if (!targetItem || !threadMenuListEl.contains(targetItem)) return;

        const session = findSessionById(currentSessionList, targetItem.dataset.sessionId || '');
        if (!session) return;

        event.preventDefault();
        event.stopPropagation();
        void activateSession(session);
      });
      threadMenuListEl.addEventListener('scroll', syncThreadMenuScrollbar);
    }

    window.addEventListener('resize', () => {
      window.requestAnimationFrame(syncThreadMenuScrollbar);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && threadMenuOpen) {
        setThreadMenuOpen(false);
      }
    });

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

    await pollCodex();
    setInterval(() => {
      void pollCodex();
    }, 1500);

    await saveSnapshot();
  }

  void bootstrap();
})();
