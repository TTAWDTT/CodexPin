function parseLaunchMode(argv = process.argv) {
  const normalizedArgv = Array.isArray(argv) ? argv.slice() : [];
  return {
    argv: normalizedArgv,
    isHookMode: normalizedArgv.includes('--codex-hook'),
  };
}

function extractHookPayloadArg(argv = process.argv) {
  const normalizedArgv = Array.isArray(argv) ? argv : [];
  const hookFlagIndex = normalizedArgv.indexOf('--codex-hook');
  if (hookFlagIndex === -1) return null;
  return normalizedArgv[hookFlagIndex + 1] || null;
}

module.exports = {
  extractHookPayloadArg,
  parseLaunchMode,
};
