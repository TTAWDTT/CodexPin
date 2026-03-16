const fs = require('fs');
const os = require('os');
const path = require('path');

const { getLiveRolloutStatus } = require('./codexRolloutLive');

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

function buildNotConnectedState() {
  return {
    integrationState: 'not_connected',
    hasSession: false,
    isActive: false,
    elapsedSeconds: 0,
    statusText: '未接入',
    phase: '未接入 Codex Hook',
    details: ['运行 codexpin setup 后，新的 Codex 回合会显示在这里。'],
    rawMessagePreview: '',
  };
}

function buildIdleState() {
  return {
    integrationState: 'idle',
    hasSession: false,
    isActive: false,
    elapsedSeconds: 0,
    statusText: '待命中',
    phase: '待命中',
    details: ['当前项目还没有收到新的 Codex Hook 事件。'],
    rawMessagePreview: '',
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

function getSessionStatus(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const rootDir = options.rootDir || path.join(homeDir, '.codexpin', 'codex-status');
  const codexRoot = options.codexRoot || path.join(homeDir, '.codex');
  const projectDir = options.projectDir || process.cwd();
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();

  const statusIndex = loadStatusIndex(rootDir);
  if (!statusIndex) {
    return buildNotConnectedState();
  }

  const session = findLatestSessionForDirectory(statusIndex, projectDir);
  if (!session) {
    return buildIdleState();
  }

  const lastEventTimestamp = session?.lastEvent?.timestamp || 0;
  const liveStatus = getLiveRolloutStatus({
    codexRoot,
    sessionId: session.sessionId,
  });

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
  };
}

module.exports = {
  getSessionStatus,
  __internal: {
    normalizePathForMatch,
    loadStatusIndex,
    findLatestSessionForDirectory,
    ACTIVE_WINDOW_MS,
    OPEN_TURN_STALE_MS,
  },
};
