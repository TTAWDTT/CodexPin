const fs = require('fs');
const os = require('os');
const path = require('path');

const ACTIVE_WINDOW_MS = 15 * 1000;

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

function getSessionStatus(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const rootDir = options.rootDir || path.join(homeDir, '.codexpin', 'codex-status');
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
  const startedAt = session.startedAt || lastEventTimestamp || nowMs;
  const terminalTimestamp = session.endedAt || lastEventTimestamp || nowMs;
  const isActive = nowMs - lastEventTimestamp <= ACTIVE_WINDOW_MS;
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
    phase: session?.lastEvent?.phase || '待命中',
    details: Array.isArray(session?.lastEvent?.details) ? session.lastEvent.details : [],
    rawMessagePreview: session?.lastEvent?.rawMessagePreview || '',
    sessionId: session.sessionId || null,
    turnId: session?.lastEvent?.turnId || null,
  };
}

module.exports = {
  getSessionStatus,
  __internal: {
    normalizePathForMatch,
    loadStatusIndex,
    findLatestSessionForDirectory,
    ACTIVE_WINDOW_MS,
  },
};

