const { extractHookPayloadArg, parseLaunchMode } = require('./runtimeMode');
const { runCodexHookArg } = require('../scripts/codexpin-codex-hook');
const fs = require('fs');

function writeHookDebug(record) {
  const debugFilePath = process.env.CODEXPIN_HOOK_DEBUG_FILE;
  if (!debugFilePath) {
    return;
  }

  try {
    fs.writeFileSync(debugFilePath, JSON.stringify(record, null, 2), 'utf8');
  } catch {
    // ignore debug write failures
  }
}

function handleHookRuntime(options = {}) {
  const argv = Array.isArray(options.argv) ? options.argv : process.argv;
  const launchMode = parseLaunchMode(argv);
  if (!launchMode.isHookMode) {
    return false;
  }

  const rawPayload = extractHookPayloadArg(launchMode.argv);
  if (!rawPayload) {
    writeHookDebug({
      argv,
      isHookMode: true,
      rawPayload: null,
      handled: true,
      note: 'Missing hook payload argument.',
    });
    return true;
  }

  const runHookPayload =
    typeof options.runHookPayload === 'function'
      ? options.runHookPayload
      : (payload) =>
          runCodexHookArg(payload, {
            currentHookPath: process.execPath,
          });

  runHookPayload(rawPayload);
  writeHookDebug({
    argv,
    isHookMode: true,
    rawPayload,
    handled: true,
  });
  return true;
}

module.exports = {
  handleHookRuntime,
};
