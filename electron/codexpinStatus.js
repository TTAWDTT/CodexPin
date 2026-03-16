const fs = require('fs');
const os = require('os');
const path = require('path');

const { getLiveRolloutStatus, listRolloutSessions } = require('./codexRolloutLive');
const { detectCodexProcess } = require('./codexProcessState');

const ACTIVE_WINDOW_MS = 15 * 1000;
const OPEN_TURN_STALE_MS = 30 * 60 * 1000;

function normalizePathForMatch(input) {
  if (!input || typeof input !== 'string') return '';

  let normalized = input.trim().replace(/\//g, '\\');
  if (normalized.startsWith('\\\\?\\')) {
    normalized = normalized.slice(4);
  }
  normalized = normalized.replace(/\\+$/, '');
  return normalized.toLowerCase();
}

function loadStatusIndex(rootDir) {
  const statusPath = path.join(rootDir, 'status.json');
  if (!fs.existsSync(statusPath)) return null;

  try {
    const raw = fs.readFileSync(statusPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.sessions || typeof parsed.sessions !== 'object') {
      parsed.sessions = {};
    }
    return parsed;
  } catch {
    return null;
  }
}

function findLatestSessionForDirectory(statusIndex, projectDir) {
  if (!statusIndex || !statusIndex.sessions) return null;

  const target = normalizePathForMatch(projectDir);
  const matches = Object.values(statusIndex.sessions).filter((session) => {
    const workingDirectory = normalizePathForMatch(session.workingDirectory);
    return Boolean(target) && workingDirectory === target;
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aTs = a?.lastEvent?.timestamp || 0;
    const bTs = b?.lastEvent?.timestamp || 0;
    return bTs - aTs;
  });

  return matches[0];
}

function findLatestSessionGlobally(statusIndex) {
  if (!statusIndex || !statusIndex.sessions) return null;

  const sessions = Object.values(statusIndex.sessions);
  if (sessions.length === 0) return null;

  sessions.sort((a, b) => {
    const aTs = a?.lastEvent?.timestamp || 0;
    const bTs = b?.lastEvent?.timestamp || 0;
    return bTs - aTs;
  });

  return sessions[0];
}

function getVisibleSessions(statusIndex, options = {}) {
  if (!statusIndex || !statusIndex.sessions) return [];

  const sessions = Object.values(statusIndex.sessions);
  if (sessions.length === 0) return [];

  if (options.preferGlobalSession || !options.projectDir) {
    return sessions.sort((a, b) => {
      const aTs = a?.lastEvent?.timestamp || 0;
      const bTs = b?.lastEvent?.timestamp || 0;
      return bTs - aTs;
    });
  }

  const target = normalizePathForMatch(options.projectDir);
  return sessions
    .filter((session) => {
      const workingDirectory = normalizePathForMatch(session.workingDirectory);
      return Boolean(target) && workingDirectory === target;
    })
    .sort((a, b) => {
      const aTs = a?.lastEvent?.timestamp || 0;
      const bTs = b?.lastEvent?.timestamp || 0;
      return bTs - aTs;
    });
}

function isLikelyCodexSessionId(sessionId) {
  return typeof sessionId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId.trim());
}

function mergeSessionRecords(baseSession, overrideSession) {
  if (!baseSession) return overrideSession;
  if (!overrideSession) return baseSession;

  const baseTimestamp = baseSession?.lastEvent?.timestamp || 0;
  const overrideTimestamp = overrideSession?.lastEvent?.timestamp || 0;
  const preferredLastEvent = overrideTimestamp >= baseTimestamp
    ? overrideSession.lastEvent
    : baseSession.lastEvent;

  return {
    ...baseSession,
    ...overrideSession,
    startedAt: overrideSession.startedAt || baseSession.startedAt || 0,
    endedAt: Object.prototype.hasOwnProperty.call(overrideSession, 'endedAt')
      ? overrideSession.endedAt
      : baseSession.endedAt,
    lastEvent: preferredLastEvent,
    title:
      overrideSession.title ||
      baseSession.title ||
      preferredLastEvent?.phase ||
      '',
  };
}

function getMergedVisibleSessions(options = {}) {
  const statusIndex = options.statusIndex || null;
  const projectDir = options.projectDir || '';
  const preferGlobalSession = Boolean(options.preferGlobalSession);
  const codexRoot = options.codexRoot || path.join(os.homedir(), '.codex');
  const rolloutSessions = listRolloutSessions({
    codexRoot,
    projectDir: preferGlobalSession ? '' : projectDir,
  });
  const rolloutSessionIds = new Set(rolloutSessions.map((session) => session.sessionId));
  const visibleStatusSessions = getVisibleSessions(statusIndex, {
    projectDir,
    preferGlobalSession,
  }).filter((session) => {
    if (rolloutSessionIds.size === 0) {
      return true;
    }

    return isLikelyCodexSessionId(session?.sessionId) || rolloutSessionIds.has(session?.sessionId);
  });

  const merged = new Map();

  for (const rolloutSession of rolloutSessions) {
    merged.set(rolloutSession.sessionId, rolloutSession);
  }

  for (const statusSession of visibleStatusSessions) {
    const existing = merged.get(statusSession.sessionId) || null;
    merged.set(statusSession.sessionId, mergeSessionRecords(existing, statusSession));
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aTs = a?.lastEvent?.timestamp || 0;
    const bTs = b?.lastEvent?.timestamp || 0;
    return bTs - aTs;
  });
}

function findSelectedVisibleSession(statusIndex, options = {}) {
  if (!options.selectedSessionId) return null;

  const visibleSessions = getMergedVisibleSessions({
    statusIndex,
    projectDir: options.projectDir,
    preferGlobalSession: options.preferGlobalSession,
    codexRoot: options.codexRoot,
  });
  return (
    visibleSessions.find((session) => session.sessionId === options.selectedSessionId) || null
  );
}

function buildNotConnectedState(message) {
  return {
    integrationState: 'not_connected',
    hasSession: false,
    isActive: false,
    elapsedSeconds: 0,
    statusText: '未接入',
    phase: '未接入 Codex Hook',
    details: [message || 'CodexPin 无法自动接入 Codex。'],
    rawMessagePreview: '',
  };
}

function buildIdleState(options = {}) {
  const hasCodexProcess = options.hasCodexProcess !== false;
  const phase = hasCodexProcess ? '待命中' : '暂无 Codex 进程';
  const details = hasCodexProcess
    ? ['当前项目还没有收到新的 Codex Hook 事件。']
    : ['启动 Codex 后，这里会显示当前任务进度。'];

  return {
    integrationState: 'idle',
    hasSession: false,
    isActive: false,
    elapsedSeconds: 0,
    statusText: '待命中',
    phase,
    details,
    rawMessagePreview: '',
    hasCodexProcess,
  };
}

function buildDisplayFromHookEvent(lastEvent) {
  if (!lastEvent || typeof lastEvent !== 'object') return null;

  return {
    phase: lastEvent.phase || '待命中',
    details: Array.isArray(lastEvent.details) ? lastEvent.details : [],
    rawMessagePreview: lastEvent.rawMessagePreview || '',
    sourceType: 'hook',
    sourceTimestampMs: lastEvent.timestamp || 0,
  };
}

function pickDisplayState({ hookDisplay, liveDisplay, liveTurnAheadOfHook, liveIsActive }) {
  if ((liveTurnAheadOfHook || liveIsActive) && liveDisplay && liveDisplay.phase) {
    return liveDisplay;
  }

  if (hookDisplay && hookDisplay.phase) {
    return hookDisplay;
  }

  if (liveDisplay && liveDisplay.phase) {
    return liveDisplay;
  }

  return {
    phase: '待命中',
    details: [],
    rawMessagePreview: '',
    sourceType: 'fallback',
    sourceTimestampMs: 0,
  };
}

function buildSessionListItem(session, nowMs) {
  const lastEventTimestamp = session?.lastEvent?.timestamp || 0;
  const rolloutStatus = session?.status || '';
  const hasEnded = Boolean(session?.endedAt);
  const isActive = rolloutStatus === 'active'
    ? true
    : rolloutStatus === 'completed'
      ? false
      : Boolean(lastEventTimestamp && nowMs - lastEventTimestamp <= ACTIVE_WINDOW_MS);

  return {
    sessionId: session.sessionId || null,
    title:
      session.title ||
      session?.lastEvent?.phase ||
      (session.sessionId ? `Thread ${session.sessionId.slice(0, 8)}` : 'Untitled thread'),
    workingDirectory: session.workingDirectory || '',
    isActive,
    statusText: isActive ? '工作中' : hasEnded ? '待命中' : '待命中',
    lastEventTimestamp,
    phase: session?.lastEvent?.phase || '',
  };
}

function findFallbackRateLimits(options = {}) {
  const codexRoot = options.codexRoot;
  const readLiveRolloutStatus = options.getLiveRolloutStatus || getLiveRolloutStatus;
  if (!codexRoot) return null;

  const rolloutSessions = listRolloutSessions({
    codexRoot,
    projectDir: '',
  });

  for (const rolloutSession of rolloutSessions) {
    if (rolloutSession?.rateLimits) {
      return rolloutSession.rateLimits;
    }

    if (!rolloutSession?.sessionId) {
      continue;
    }

    const liveStatus = readLiveRolloutStatus({
      codexRoot,
      sessionId: rolloutSession.sessionId,
      rolloutFilePath: rolloutSession.rolloutFilePath,
    });

    if (liveStatus?.rateLimits) {
      return liveStatus.rateLimits;
    }
  }

  return null;
}

function getSessionList(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const rootDir = options.rootDir || path.join(homeDir, '.codexpin', 'codex-status');
  const projectDir =
    Object.prototype.hasOwnProperty.call(options, 'projectDir')
      ? options.projectDir
      : process.cwd();
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const preferGlobalSession = Boolean(options.preferGlobalSession);
  const codexRoot = options.codexRoot || path.join(homeDir, '.codex');

  const statusIndex = loadStatusIndex(rootDir);
  const visibleSessions = getMergedVisibleSessions({
    statusIndex,
    projectDir,
    preferGlobalSession,
    codexRoot,
  });

  return visibleSessions.map((session) => buildSessionListItem(session, nowMs));
}

function getSessionStatus(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const rootDir = options.rootDir || path.join(homeDir, '.codexpin', 'codex-status');
  const codexRoot = options.codexRoot || path.join(homeDir, '.codex');
  const projectDir =
    Object.prototype.hasOwnProperty.call(options, 'projectDir')
      ? options.projectDir
      : process.cwd();
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const hookInstalled = Boolean(options.hookInstalled);
  const notConnectedMessage = options.notConnectedMessage || '';
  const preferGlobalSession = Boolean(options.preferGlobalSession);
  const selectedSessionId = options.selectedSessionId || null;
  const readProcessState =
    typeof options.detectCodexProcess === 'function'
      ? options.detectCodexProcess
      : detectCodexProcess;
  const readLiveRolloutStatus =
    typeof options.getLiveRolloutStatus === 'function'
      ? options.getLiveRolloutStatus
      : getLiveRolloutStatus;

  const statusIndex = loadStatusIndex(rootDir);
  if (!statusIndex) {
    if (!hookInstalled) {
      return buildNotConnectedState(notConnectedMessage);
    }

    const processState = readProcessState();
    return buildIdleState(processState);
  }

  const session =
    findSelectedVisibleSession(statusIndex, {
      projectDir,
      preferGlobalSession,
      selectedSessionId,
      codexRoot,
    }) ||
    getMergedVisibleSessions({
      statusIndex,
      projectDir,
      preferGlobalSession,
      codexRoot,
    })[0] ||
    (preferGlobalSession || !projectDir
      ? findLatestSessionGlobally(statusIndex)
      : findLatestSessionForDirectory(statusIndex, projectDir));
  if (!session) {
    const processState = readProcessState();
    return buildIdleState(processState);
  }

  const lastEventTimestamp = session?.lastEvent?.timestamp || 0;
  const shouldReadLiveRollout = Boolean(
    session?.sessionId &&
      (
        session.status === 'active' ||
        !session.endedAt ||
        (lastEventTimestamp && nowMs - lastEventTimestamp <= OPEN_TURN_STALE_MS)
      ),
  );
  const liveStatus = shouldReadLiveRollout
    ? readLiveRolloutStatus({
        codexRoot,
        sessionId: session.sessionId,
      })
    : null;

  const hookDisplay = buildDisplayFromHookEvent(session.lastEvent);
  const hookTurnId = session?.lastEvent?.turnId || null;
  const liveTurnAheadOfHook = Boolean(
    liveStatus?.currentTurnId && liveStatus.currentTurnId !== hookTurnId,
  );
  const liveOpenTurn = Boolean(
    liveTurnAheadOfHook &&
      liveStatus?.currentTurnCompleted === false &&
      nowMs - (liveStatus.lastActivityMs || liveStatus.currentTurnStartedAt || 0) <= OPEN_TURN_STALE_MS,
  );
  const liveIsActive = Boolean(
    liveOpenTurn ||
      (liveStatus &&
        liveStatus.lastActivityMs &&
        !liveStatus.isTerminal &&
        nowMs - liveStatus.lastActivityMs <= ACTIVE_WINDOW_MS),
  );
  const display = pickDisplayState({
    hookDisplay,
    liveDisplay: liveStatus,
    liveTurnAheadOfHook,
    liveIsActive,
  });

  const startedAt =
    liveStatus?.currentTurnStartedAt ||
    liveStatus?.sessionStartedAt ||
    session.startedAt ||
    lastEventTimestamp ||
    nowMs;
  const terminalTimestamp =
    session.endedAt ||
    liveStatus?.terminalMs ||
    display.sourceTimestampMs ||
    lastEventTimestamp ||
    nowMs;
  const isActive = liveStatus?.lastActivityMs
    ? liveIsActive
    : nowMs - lastEventTimestamp <= ACTIVE_WINDOW_MS;
  const elapsedSeconds = Math.max(
    0,
    Math.floor(((isActive ? nowMs : terminalTimestamp) - startedAt) / 1000),
  );
  const rateLimits =
    liveStatus?.rateLimits ||
    findFallbackRateLimits({
      codexRoot,
      getLiveRolloutStatus: readLiveRolloutStatus,
    });

  return {
    integrationState: 'connected',
    hasSession: true,
    isActive,
    elapsedSeconds,
    statusText: isActive ? '工作中' : '待命中',
    phase: display.phase || '待命中',
    details: Array.isArray(display.details) ? display.details : [],
    rawMessagePreview: display.rawMessagePreview || '',
    sessionId: session.sessionId || null,
    turnId: session?.lastEvent?.turnId || null,
    sourceType: display.sourceType || null,
    rolloutFilePath: liveStatus?.rolloutFilePath || null,
    rateLimits,
  };
}

module.exports = {
  getSessionStatus,
  getSessionList,
  __internal: {
    findLatestSessionGlobally,
    getVisibleSessions,
    getMergedVisibleSessions,
    findSelectedVisibleSession,
    isLikelyCodexSessionId,
    mergeSessionRecords,
    normalizePathForMatch,
    loadStatusIndex,
    findLatestSessionForDirectory,
    ACTIVE_WINDOW_MS,
    OPEN_TURN_STALE_MS,
  },
};
