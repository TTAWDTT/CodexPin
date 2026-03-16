const childProcess = require('child_process');

function normalizeText(input) {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function isLikelyCodexCommandLine(commandLine, processName = '') {
  const haystack = `${processName} ${commandLine}`.toLowerCase();

  return (
    haystack.includes('@openai\\codex\\bin\\codex.js') ||
    haystack.includes('@openai/codex/bin/codex.js') ||
    haystack.includes('\\npm\\codex.ps1') ||
    haystack.includes('/npm/codex.ps1') ||
    haystack.includes('\\npm\\codex.cmd') ||
    haystack.includes('/npm/codex.cmd') ||
    /\bcodex(?:\.exe|\.cmd|\.ps1|\.js)?\b/.test(haystack)
  );
}

function detectCodexFromProcessSnapshot(processes = []) {
  const items = Array.isArray(processes) ? processes : [];
  const hasCodexProcess = items.some((processInfo) => {
    const name = normalizeText(processInfo?.name || processInfo?.Name || '');
    const commandLine = normalizeText(
      processInfo?.commandLine || processInfo?.CommandLine || '',
    );

    if (name === 'codex.exe') {
      return true;
    }

    return isLikelyCodexCommandLine(commandLine, name);
  });

  return {
    hasCodexProcess,
    inspectedAt: Date.now(),
    source: 'snapshot',
  };
}

function parsePowerShellJsonOutput(raw) {
  if (!raw || typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
    return [];
  } catch {
    return [];
  }
}

function readWindowsProcessSnapshot(runCommand = childProcess.execFileSync) {
  const raw = runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object Name,CommandLine | ConvertTo-Json -Compress',
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    },
  );

  return parsePowerShellJsonOutput(raw);
}

function detectCodexProcess(options = {}) {
  const platform = options.platform || process.platform;
  const runCommand =
    typeof options.runCommand === 'function'
      ? options.runCommand
      : childProcess.execFileSync;

  if (platform !== 'win32') {
    return {
      hasCodexProcess: false,
      inspectedAt: Date.now(),
      source: 'unsupported',
    };
  }

  try {
    const snapshot = readWindowsProcessSnapshot(runCommand);
    return detectCodexFromProcessSnapshot(snapshot);
  } catch {
    return {
      hasCodexProcess: false,
      inspectedAt: Date.now(),
      source: 'unavailable',
    };
  }
}

module.exports = {
  detectCodexFromProcessSnapshot,
  detectCodexProcess,
  __internal: {
    isLikelyCodexCommandLine,
    parsePowerShellJsonOutput,
    readWindowsProcessSnapshot,
  },
};
