#!/usr/bin/env node

const path = require('path');

const {
  buildPackagedHookCommand,
  ensureNotifyHook,
  uninstallNotifyHook,
} = require('./codexpinConfig');

function buildDefaultHookCommand() {
  return [process.execPath, path.resolve(__dirname, 'codexpin-codex-hook.js')];
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const command = args.shift() || 'help';
  const options = {};

  while (args.length > 0) {
    const current = args.shift();
    if (current === '--home') {
      options.homeDir = args.shift();
      continue;
    }
    if (current === '--hook-script') {
      options.hookScript = args.shift();
    }
  }

  return {
    command,
    options,
  };
}

function formatUsage() {
  return [
    'Usage:',
    '  node scripts/codexpin-cli.js setup',
    '  node scripts/codexpin-cli.js uninstall',
    '',
    'Optional flags:',
    '  --home <path>        Override home directory (mainly for tests)',
    '  --hook-script <path> Override hook script path',
  ].join('\n');
}

function runCli(argv) {
  const { command, options } = parseArgs(argv);
  const hookCommand = [
    process.execPath,
    options.hookScript || path.resolve(__dirname, 'codexpin-codex-hook.js'),
  ];

  if (command === 'setup') {
    const result = ensureNotifyHook({
      homeDir: options.homeDir,
      hookCommand,
    });
    return {
      exitCode: 0,
      message: result.alreadyConfigured
        ? 'CodexPin hook is already configured.'
        : 'CodexPin hook configured successfully.',
    };
  }

  if (command === 'uninstall') {
    uninstallNotifyHook({
      homeDir: options.homeDir,
      hookCommand,
    });
    return {
      exitCode: 0,
      message: 'CodexPin hook removed successfully.',
    };
  }

  return {
    exitCode: command === 'help' ? 0 : 1,
    message: formatUsage(),
  };
}

function main() {
  const result = runCli(process.argv.slice(2));
  if (result.message) {
    console.log(result.message);
  }
  process.exitCode = result.exitCode;
}

if (require.main === module) {
  main();
}

module.exports = {
  buildDefaultHookCommand,
  buildPackagedHookCommand,
  parseArgs,
  runCli,
};
