const fs = require('fs');
const os = require('os');
const path = require('path');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DETAIL_MAX_LENGTH = 80;

function normalizeDisplayLine(line) {
  if (!line || typeof line !== 'string') return '';

  let normalized = line.trim();
  if (!normalized) return '';

  // 去掉常见的 Markdown 标题、引用、列表、编号等前缀
  normalized = normalized.replace(/^(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[\.\)]\s+)/, '');

  // 去掉整行粗体或强调包裹
  normalized = normalized.replace(/^\*\*(.+)\*\*$/, '$1');
  normalized = normalized.replace(/^__(.+)__$/, '$1');
  normalized = normalized.replace(/^\*(.+)\*$/, '$1');
  normalized = normalized.replace(/^_(.+)_$/, '$1');

  return normalized.trim();
}

function clampDetail(text) {
  if (!text) return '';
  if (text.length <= DETAIL_MAX_LENGTH) return text;
  return `${text.slice(0, DETAIL_MAX_LENGTH - 3).trimEnd()}...`;
}

/**
 * 提炼助手回复为：phase + details[] + 原文预览。
 * - 按行切分，去掉空行
 * - phase：优先去掉 Markdown 标题/列表前缀后的首行
 * - details：后续最多两行，去掉列表前缀
 * - rawMessagePreview：截取前 400 字符
 */
function summarizeAssistantMessage(raw) {
  if (!raw || typeof raw !== 'string') {
    return {
      phase: '',
      details: [],
      rawMessagePreview: '',
    };
  }

  const rawMessagePreview = raw.slice(0, 400);

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      phase: '',
      details: [],
      rawMessagePreview,
    };
  }

  const normalizedLines = lines
    .map((line) => normalizeDisplayLine(line))
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return {
      phase: '',
      details: [],
      rawMessagePreview,
    };
  }

  const phase = normalizedLines[0];
  const details = [];

  for (let i = 1; i < normalizedLines.length && details.length < 2; i += 1) {
    const text = clampDetail(normalizedLines[i]);
    if (text && text !== phase) {
      details.push(text);
    }
  }

  return {
    phase,
    details,
    rawMessagePreview,
  };
}

/**
 * 从 input-messages 中提炼一个可选标题，通常基于首条用户输入。
 */
function deriveTitleFromInputMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const first = messages[0];
  let text = '';

  if (typeof first === 'string') {
    text = first;
  } else if (first && typeof first.content === 'string') {
    text = first.content;
  } else if (first && Array.isArray(first.content)) {
    text = first.content
      .map((part) => {
        if (!part) return '';
        if (typeof part.text === 'string') return part.text;
        if (typeof part.value === 'string') return part.value;
        return '';
      })
      .join(' ')
      .trim();
  }

  if (!text) return null;
  if (text.length > 80) {
    return `${text.slice(0, 77)}...`;
  }
  return text;
}

function loadStatus(statusFilePath) {
  try {
    if (!fs.existsSync(statusFilePath)) {
      return {
        version: 1,
        lastUpdated: 0,
        sessions: {},
      };
    }

    const raw = fs.readFileSync(statusFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.sessions || typeof parsed.sessions !== 'object') {
      parsed.sessions = {};
    }
    if (typeof parsed.version !== 'number') {
      parsed.version = 1;
    }
    if (typeof parsed.lastUpdated !== 'number') {
      parsed.lastUpdated = 0;
    }
    return parsed;
  } catch {
    return {
      version: 1,
      lastUpdated: 0,
      sessions: {},
    };
  }
}

function writeAtomicJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = path.join(dir, `${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function pruneOldSessions(status, rootDir, nowMs) {
  const sessions = status.sessions || {};
  const cutoff = nowMs - ONE_DAY_MS;

  for (const [sessionId, s] of Object.entries(sessions)) {
    const lastTs =
      (s.lastEvent && typeof s.lastEvent.timestamp === 'number' && s.lastEvent.timestamp) ||
      (typeof s.startedAt === 'number' && s.startedAt) ||
      0;

    if (lastTs && lastTs < cutoff) {
      delete sessions[sessionId];
      try {
        const perSessionPath = path.join(rootDir, 'sessions', `${sessionId}.json`);
        if (fs.existsSync(perSessionPath)) {
          fs.unlinkSync(perSessionPath);
        }
      } catch {
        // 清理失败不应影响主流程
      }
    }
  }
}

/**
 * 将单次 agent-turn-complete 事件写入 CodexPin 状态：
 * - 更新 ~/.codexpin/codex-status/status.json
 * - 追加 ~/.codexpin/codex-status/sessions/<sessionId>.json
 *
 * @param {object} event Codex notify 事件 JSON
 * @param {object} [options]
 * @param {string} [options.rootDir] 覆盖默认根目录（用于测试）
 * @param {number} [options.nowMs] 覆盖当前时间（用于测试）
 */
function updateCodexPinStateFromEvent(event, options = {}) {
  if (!event || typeof event !== 'object') return null;

  const sessionId = event['thread-id'];
  const turnId = event['turn-id'];
  const cwd = event.cwd || '';

  if (!sessionId) return null;

  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const homeDir = os.homedir();
  const rootDir =
    options.rootDir || path.join(homeDir, '.codexpin', 'codex-status');

  const { phase, details, rawMessagePreview } = summarizeAssistantMessage(
    event['last-assistant-message'],
  );

  const statusPath = path.join(rootDir, 'status.json');
  const status = loadStatus(statusPath);

  if (!status.sessions) status.sessions = {};

  const existing = status.sessions[sessionId] || {
    sessionId,
    workingDirectory: cwd,
    startedAt: nowMs,
    endedAt: null,
    status: 'active',
    lastEvent: null,
  };

  if (!existing.startedAt) {
    existing.startedAt = nowMs;
  }
  if (!existing.workingDirectory) {
    existing.workingDirectory = cwd;
  }
  const title = deriveTitleFromInputMessages(event['input-messages']);
  if (title) {
    existing.title = title;
  }

  existing.status = 'active';
  existing.lastEvent = {
    type: 'turn_complete',
    timestamp: nowMs,
    phase,
    details,
    rawMessagePreview,
    turnId,
  };

  status.sessions[sessionId] = existing;
  status.lastUpdated = nowMs;

  pruneOldSessions(status, rootDir, nowMs);
  writeAtomicJSON(statusPath, status);

  const sessionDir = path.join(rootDir, 'sessions');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  const sessionPath = path.join(sessionDir, `${sessionId}.json`);

  let sessionDoc;
  try {
    if (fs.existsSync(sessionPath)) {
      const raw = fs.readFileSync(sessionPath, 'utf8');
      sessionDoc = JSON.parse(raw);
    }
  } catch {
    // ignore parse errors and recreate
  }

  if (!sessionDoc || typeof sessionDoc !== 'object') {
    sessionDoc = {
      sessionId,
      workingDirectory: cwd,
      startedAt: existing.startedAt,
      endedAt: null,
    status: 'active',
    title,
    turns: [],
  };
  }

  if (!Array.isArray(sessionDoc.turns)) {
    sessionDoc.turns = [];
  }

  sessionDoc.turns.push({
    turnId,
    timestamp: nowMs,
    phase,
    details,
    rawMessagePreview,
  });

  // 目前只根据 turn-complete 事件维持 active 状态
  sessionDoc.status = 'active';

  writeAtomicJSON(sessionPath, sessionDoc);

  return {
    rootDir,
    status,
    session: sessionDoc,
  };
}

module.exports = {
  normalizeDisplayLine,
  summarizeAssistantMessage,
  deriveTitleFromInputMessages,
  updateCodexPinStateFromEvent,
};
