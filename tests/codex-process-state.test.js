const assert = require('assert');

const {
  detectCodexFromProcessSnapshot,
} = require('../electron/codexProcessState');

function testDetectsCodexFromOpenAICliCommandLine() {
  const result = detectCodexFromProcessSnapshot([
    {
      name: 'node.exe',
      commandLine:
        'C:\\Program Files\\nodejs\\node.exe C:\\Users\\86153\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js',
    },
  ]);

  assert.strictEqual(result.hasCodexProcess, true);
}

function testDetectsCodexFromShimCommandLine() {
  const result = detectCodexFromProcessSnapshot([
    {
      name: 'powershell.exe',
      commandLine: 'powershell.exe -File C:\\Users\\86153\\AppData\\Roaming\\npm\\codex.ps1',
    },
  ]);

  assert.strictEqual(result.hasCodexProcess, true);
}

function testReturnsFalseWhenNoCodexProcessExists() {
  const result = detectCodexFromProcessSnapshot([
    {
      name: 'node.exe',
      commandLine: 'C:\\Program Files\\nodejs\\node.exe D:\\Github\\CodexPin\\scripts\\watch.js',
    },
    {
      name: 'explorer.exe',
      commandLine: 'C:\\Windows\\Explorer.EXE',
    },
  ]);

  assert.strictEqual(result.hasCodexProcess, false);
}

function run() {
  console.log('Running Codex process state tests...');
  testDetectsCodexFromOpenAICliCommandLine();
  testDetectsCodexFromShimCommandLine();
  testReturnsFalseWhenNoCodexProcessExists();
  console.log('All Codex process state tests passed.');
}

run();
