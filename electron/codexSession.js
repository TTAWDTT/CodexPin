const fs = require('fs');
const path = require('path');

/**
 * Safely read a UTF-8 file. Returns null if anything goes wrong.
 */
function readFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Find the most recent session_id from .codex/history.jsonl.
 * This approximates the "current" or last-active Codex session.
 */
function getLatestSessionId(codexRoot) {
  const historyPath = path.join(codexRoot, 'history.jsonl');
  const text = readFileSafe(historyPath);
  if (!text) return null;

  const lines = text.trim().split(/\r?\n/);
  // Walk from the end to find the first line that has a session_id.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.session_id) {
        return {
          sessionId: obj.session_id,
          lastTs: typeof obj.ts === 'number' ? obj.ts : null,
        };
      }
    } catch {
      // ignore malformed lines
    }
  }

  return null;
}

/**
 * Given a session id and (optional) unix timestamp, locate its JSONL file.
 * Codex stores sessions as:
 *   sessions/YYYY/MM/DD/rollout-<timestamp>-<sessionId>.jsonl
 */
function findSessionFile(codexRoot, sessionId, lastTs) {
  const sessionsRoot = path.join(codexRoot, 'sessions');
  if (!fs.existsSync(sessionsRoot)) return null;

  // Prefer to search within the date directory derived from lastTs, if available.
  const candidateDirs = [];
  if (lastTs) {
    const d = new Date(lastTs * 1000);
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    candidateDirs.push(path.join(sessionsRoot, year, month, day));
  }
  // Fallback: search root if specific date directory fails.
  candidateDirs.push(sessionsRoot);

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      const stack = entries.map((e) => ({
        dir,
        entry: e,
      }));

      while (stack.length > 0) {
        const { dir: currentDir, entry } = stack.pop();
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          const nested = fs.readdirSync(full, { withFileTypes: true });
          nested.forEach((n) => stack.push({ dir: full, entry: n }));
          continue;
        }
        if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(sessionId)) {
          return full;
        }
      }
    } catch {
      // Continue trying other dirs
    }
  }

  return null;
}

/**
 * Parse a Codex session JSONL file and return:
 * - start timestamp
 * - last timestamp
 * - last assistant segment, split into phase + details
 */
function parseSessionFile(sessionPath) {
  const text = readFileSafe(sessionPath);
  if (!text) {
    return {
      startTs: null,
      lastTs: null,
      lines: [],
    };
  }

  const lines = text.trim().split(/\r?\n/);
  let startTs = null;
  let lastTs = null;
  const assistantTexts = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const tsIso = obj.timestamp || (obj.payload && obj.payload.timestamp);
    if (tsIso) {
      const ts = Date.parse(tsIso) / 1000;
      if (!Number.isNaN(ts)) {
        if (!startTs) startTs = ts;
        lastTs = ts;
      }
    }

    if (obj.type === 'response_item' && obj.payload && obj.payload.type === 'message') {
      const role = obj.payload.role;
      if (role !== 'assistant') continue;

      const content = obj.payload.content || [];
      const pieces = [];
      for (const c of content) {
        if (!c) continue;
        if (typeof c.text === 'string') {
          pieces.push(c.text);
        } else if (typeof c.value === 'string') {
          pieces.push(c.value);
        }
      }
      const textJoined = pieces.join('\n').trim();
      if (textJoined) {
        assistantTexts.push(textJoined);
      }
    }
  }

  // 只取最后一段 assistant 输出，将其拆成「阶段 + 细节」
  let phase = '';
  let details = [];
  if (assistantTexts.length > 0) {
    const last = assistantTexts[assistantTexts.length - 1];
    const segments = last
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (segments.length > 0) {
      phase = segments[0];
      details = segments.slice(1, 3);
    }
  }

  return {
    startTs,
    lastTs,
    // 兼容旧字段，同时返回结构化信息
    lines: [phase, ...details].filter(Boolean),
    phase,
    details,
  };
}

/**
 * Compute a simple "session overview" for the most recently active Codex session.
 * - hasSession: whether we found any session data
 * - isActive: whether the session appears "recent" (last event within ~5 minutes)
 * - elapsedSeconds: how long the session has been running (or ran), in seconds
 * - lines: last few assistant messages for display
 */
function getSessionOverview() {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    return {
      hasSession: false,
      isActive: false,
      elapsedSeconds: 0,
      lines: [],
    };
  }

  const codexRoot = path.join(home, '.codex');
  if (!fs.existsSync(codexRoot)) {
    return {
      hasSession: false,
      isActive: false,
      elapsedSeconds: 0,
      lines: [],
    };
  }

  const latest = getLatestSessionId(codexRoot);
  if (!latest || !latest.sessionId) {
    return {
      hasSession: false,
      isActive: false,
      elapsedSeconds: 0,
      lines: [],
    };
  }

  const sessionFile = findSessionFile(codexRoot, latest.sessionId, latest.lastTs);
  if (!sessionFile) {
    return {
      hasSession: false,
      isActive: false,
      elapsedSeconds: 0,
      lines: [],
    };
  }

  const { startTs, lastTs, lines, phase, details } = parseSessionFile(sessionFile);
  if (!startTs) {
    return {
      hasSession: false,
      isActive: false,
      elapsedSeconds: 0,
      lines: [],
    };
  }

  const nowSec = Date.now() / 1000;
  const lastEventTs = lastTs || latest.lastTs || startTs;

  // If there has been activity in the last 5 minutes, consider the session "active".
  const isActive = nowSec - lastEventTs < 5 * 60;

  let elapsedSeconds;
  if (isActive) {
    elapsedSeconds = Math.max(0, Math.floor(nowSec - startTs));
  } else {
    elapsedSeconds = Math.max(0, Math.floor(lastEventTs - startTs));
  }

  return {
    hasSession: true,
    isActive,
    elapsedSeconds,
    lines,
    phase,
    details,
  };
}

module.exports = {
  getSessionOverview,
};
