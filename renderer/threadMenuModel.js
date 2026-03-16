const CodexPinThreadMenuModelFactory = () => {
  function normalizeText(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function buildThreadMenuSignature(sessions = []) {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return '';
    }

    return sessions
      .map((session) => {
        const sessionId = normalizeText(session?.sessionId);
        const title = normalizeText(session?.title, 'Untitled thread');
        const isActive = session?.isActive ? '1' : '0';
        return `${sessionId}|${title}|${isActive}`;
      })
      .join('||');
  }

  function getThreadMenuLabel(options = {}) {
    const sessions = Array.isArray(options.sessions) ? options.sessions : [];
    const selectedSessionId = normalizeText(options.selectedSessionId);
    const fallbackLabel = normalizeText(options.fallbackLabel, '待命中');

    if (!selectedSessionId) {
      return fallbackLabel;
    }

    const selectedSession = sessions.find((session) => session?.sessionId === selectedSessionId);
    return normalizeText(selectedSession?.title, fallbackLabel);
  }

  function findSessionById(sessions = [], sessionId) {
    const normalizedSessionId = normalizeText(sessionId);
    if (!normalizedSessionId || !Array.isArray(sessions)) {
      return null;
    }

    return sessions.find((session) => normalizeText(session?.sessionId) === normalizedSessionId) || null;
  }

  return {
    buildThreadMenuSignature,
    findSessionById,
    getThreadMenuLabel,
  };
};

(function attachThreadMenuModel(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodexPinThreadMenuModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, CodexPinThreadMenuModelFactory);
