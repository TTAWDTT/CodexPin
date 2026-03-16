const path = require('path');

const {
  buildPackagedHookCommand,
  ensureNotifyHook,
  isNotifyHookConfigured,
} = require('../scripts/codexpinConfig');

function buildRuntimeHookCommand(options = {}) {
  if (Array.isArray(options.hookCommand) && options.hookCommand.length > 0) {
    return options.hookCommand.slice();
  }

  const executablePath = options.executablePath || process.execPath;
  const isPackaged = Boolean(options.isPackaged);

  if (isPackaged) {
    return buildPackagedHookCommand(executablePath);
  }

  const appPath = options.appPath || process.cwd();
  return [executablePath, path.resolve(appPath), '--codex-hook'];
}

function runInstallBootstrap(options = {}) {
  const desiredHookCommand = buildRuntimeHookCommand(options);
  const detectHookConfigured =
    typeof options.isNotifyHookConfigured === 'function'
      ? options.isNotifyHookConfigured
      : isNotifyHookConfigured;
  const installHook =
    typeof options.ensureNotifyHook === 'function'
      ? options.ensureNotifyHook
      : ensureNotifyHook;

  try {
    if (
      detectHookConfigured({
        homeDir: options.homeDir,
        hookCommand: desiredHookCommand,
      })
    ) {
      return {
        installState: 'ready',
        hookConfigured: true,
        autoSetupAttempted: false,
        autoSetupSucceeded: false,
        hookCommand: desiredHookCommand,
        message: 'CodexPin hook 已接入。',
      };
    }

    installHook({
      homeDir: options.homeDir,
      hookCommand: desiredHookCommand,
    });

    return {
      installState: 'ready',
      hookConfigured: true,
      autoSetupAttempted: true,
      autoSetupSucceeded: true,
      hookCommand: desiredHookCommand,
      message: 'CodexPin 已自动接入 Codex。',
    };
  } catch (error) {
    return {
      installState: 'setup_failed',
      hookConfigured: false,
      autoSetupAttempted: true,
      autoSetupSucceeded: false,
      hookCommand: desiredHookCommand,
      message: error && error.message ? error.message : 'CodexPin 自动接入失败。',
    };
  }
}

module.exports = {
  buildRuntimeHookCommand,
  runInstallBootstrap,
};
