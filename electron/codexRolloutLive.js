const fs = require('fs');
const path = require('path');

const { summarizeAssistantMessage } = require('../scripts/codexpinHookLib');

const DISPLAY_PRIORITY = {
  agent_message: 3,
  tool_call: 2,
  assistant_message: 1,
};

function safeJsonParse(value) {
  if (!value || typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function clampText(text, maxLength = 120) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return 0;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeToolInput(input) {
  let value = input;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const parsed = safeJsonParse(trimmed);
    if (!parsed) {
      return clampText(trimmed);
    }
    value = parsed;
  }

  if (!value || typeof value !== 'object') return '';

  const preferredKeys = ['command', 'cmd', 'file_path', 'path', 'query', 'pattern', 'url', 'text'];

  for (const key of preferredKeys) {
    const current = value[key];
    if (typeof current !== 'string' || !current.trim()) continue;

    if (key.includes('path')) {
      return path.basename(current.trim());
    }

    return clampText(current.trim());
  }

  for (const [key, current] of Object.entries(value)) {
    if (typeof current !== 'string' || !current.trim()) continue;

    if (key.toLowerCase().includes('path')) {
      return path.basename(current.trim());
    }

    return clampText(current.trim());
  }

  return '';
}

function extractAssistantText(payload) {
  if (!payload || payload.type !== 'message' || payload.role !== 'assistant') {
    return '';
  }

  if (!Array.isArray(payload.content)) return '';

  const parts = payload.content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (typeof item.text === 'string') return item.text;
      if (typeof item.value === 'string') return item.value;
      return '';
    })
    .filter(Boolean);

  return parts.join('\n').trim();
}

function makeMessageDisplay(sourceType, message, timestampMs) {
  const summary = summarizeAssistantMessage(message);

  return {
    phase: summary.phase || '',
    details: summary.details,
    rawMessagePreview: summary.rawMessagePreview,
    sourceType,
    sourceTimestampMs: timestampMs,
  };
}

function makeToolDisplay(payload, timestampMs) {
  const toolName = payload?.name || payload?.tool_name || 'unknown';
  const inputSummary = summarizeToolInput(payload?.input || payload?.arguments);

  return {
    phase: `调用工具 ${toolName}`,
    details: inputSummary ? [inputSummary] : [],
    rawMessagePreview: inputSummary,
    sourceType: 'tool_call',
    sourceTimestampMs: timestampMs,
  };
}

function chooseDisplayCandidate(candidates) {
  return candidates
    .filter(Boolean)
    .sort((left, right) => {
      if (right.sourceTimestampMs !== left.sourceTimestampMs) {
        return right.sourceTimestampMs - left.sourceTimestampMs;
      }

      return (DISPLAY_PRIORITY[right.sourceType] || 0) - (DISPLAY_PRIORITY[left.sourceType] || 0);
    })[0] || null;
}

function parseRolloutLines(lines) {
  const state = {
    sessionStartedAt: 0,
    lastActivityMs: 0,
    terminalMs: 0,
    latestAgentMessage: null,
    latestToolCall: null,
    latestAssistantMessage: null,
  };

  for (const line of lines || []) {
    if (typeof line !== 'string' || !line.trim()) continue;

    const entry = safeJsonParse(line);
    if (!entry || typeof entry !== 'object') continue;

    const timestampMs =
      parseTimestamp(entry.timestamp) || parseTimestamp(entry?.payload?.timestamp);
    const payload = entry.payload || {};

    if (entry.type === 'session_meta') {
      const startedAt = parseTimestamp(payload.timestamp) || timestampMs;
      if (startedAt && (!state.sessionStartedAt || startedAt < state.sessionStartedAt)) {
        state.sessionStartedAt = startedAt;
      }
    }

    if (!(entry.type === 'event_msg' && payload.type === 'token_count') && timestampMs) {
      state.lastActivityMs = Math.max(state.lastActivityMs, timestampMs);
    }

    if (entry.type === 'event_msg' && payload.type === 'agent_message' && payload.message) {
      const candidate = makeMessageDisplay('agent_message', payload.message, timestampMs);
      state.latestAgentMessage = chooseDisplayCandidate([
        state.latestAgentMessage,
        candidate,
      ]);
      continue;
    }

    if (entry.type === 'event_msg' && payload.type === 'task_complete') {
      state.terminalMs = Math.max(state.terminalMs, timestampMs);
      continue;
    }

    if (
      entry.type === 'response_item' &&
      (payload.type === 'custom_tool_call' || payload.type === 'function_call')
    ) {
      const candidate = makeToolDisplay(payload, timestampMs);
      state.latestToolCall = chooseDisplayCandidate([
        state.latestToolCall,
        candidate,
      ]);
      continue;
    }

    if (entry.type === 'response_item' && payload.type === 'message') {
      const assistantText = extractAssistantText(payload);
      if (!assistantText) continue;

      const candidate = makeMessageDisplay(
        'assistant_message',
        assistantText,
        timestampMs,
      );
      state.latestAssistantMessage = chooseDisplayCandidate([
        state.latestAssistantMessage,
        candidate,
      ]);
    }
  }

  const display = chooseDisplayCandidate([
    state.latestAgentMessage,
    state.latestToolCall,
    state.latestAssistantMessage,
  ]);

  return {
    phase: display?.phase || '',
    details: Array.isArray(display?.details) ? display.details : [],
    rawMessagePreview: display?.rawMessagePreview || '',
    sourceType: display?.sourceType || '',
    sourceTimestampMs: display?.sourceTimestampMs || 0,
    lastActivityMs: state.lastActivityMs,
    sessionStartedAt: state.sessionStartedAt,
    isTerminal: Boolean(state.terminalMs && state.terminalMs >= state.lastActivityMs),
    terminalMs: state.terminalMs,
  };
}

function walkDirectory(rootDir, visitor) {
  if (!rootDir || !fs.existsSync(rootDir)) return;

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, visitor);
      continue;
    }
    visitor(fullPath, entry);
  }
}

function findLatestRolloutFileForSession(options = {}) {
  const codexRoot = options.codexRoot;
  const sessionId = options.sessionId;
  if (!codexRoot || !sessionId) return null;

  const sessionsRoot = path.join(codexRoot, 'sessions');
  if (!fs.existsSync(sessionsRoot)) return null;

  let latestMatch = null;
  let latestSortKey = '';
  let latestMtimeMs = -1;

  walkDirectory(sessionsRoot, (fullPath, entry) => {
    if (!entry.isFile()) return;
    if (!entry.name.endsWith(`${sessionId}.jsonl`)) return;
    if (!entry.name.startsWith('rollout-')) return;

    const sortKey = fullPath.toLowerCase();
    const { mtimeMs } = fs.statSync(fullPath);
    if (
      sortKey > latestSortKey ||
      (sortKey === latestSortKey && mtimeMs > latestMtimeMs)
    ) {
      latestSortKey = sortKey;
      latestMtimeMs = mtimeMs;
      latestMatch = fullPath;
    }
  });

  return latestMatch;
}

function getLiveRolloutStatus(options = {}) {
  const rolloutFilePath = options.rolloutFilePath || findLatestRolloutFileForSession(options);
  if (!rolloutFilePath || !fs.existsSync(rolloutFilePath)) return null;

  const raw = fs.readFileSync(rolloutFilePath, 'utf8');
  const parsed = parseRolloutLines(raw.split(/\r?\n/));

  return {
    ...parsed,
    rolloutFilePath,
  };
}

module.exports = {
  summarizeToolInput,
  parseRolloutLines,
  findLatestRolloutFileForSession,
  getLiveRolloutStatus,
  __internal: {
    clampText,
    parseTimestamp,
    extractAssistantText,
  },
};
