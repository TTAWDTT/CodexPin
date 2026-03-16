const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildDefaultHookCommand,
  buildPackagedHookCommand,
  runCli,
} = require('../scripts/codexpin-cli');

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-cli-home-'));
}

function readConfig(homeDir) {
  const configPath = path.join(homeDir, '.codex', 'config.toml');
  return fs.readFileSync(configPath, 'utf8');
}

function testBuildDefaultHookCommand() {
  const command = buildDefaultHookCommand();
  assert.strictEqual(Array.isArray(command), true);
  assert.strictEqual(command[0], process.execPath);
  assert.ok(
    command[1].endsWith(path.join('scripts', 'codexpin-codex-hook.js')),
    '默认 hook 脚本应指向仓库内的 codexpin-codex-hook.js',
  );
}

function testRunCliSetupAndUninstall() {
  const homeDir = createTempHome();

  const setup = runCli(['setup', '--home', homeDir]);
  assert.strictEqual(setup.exitCode, 0);

  const configAfterSetup = readConfig(homeDir);
  assert.ok(
    configAfterSetup.includes('notify'),
    '执行 setup 后应写入 notify 配置',
  );

  const uninstall = runCli(['uninstall', '--home', homeDir]);
  assert.strictEqual(uninstall.exitCode, 0);

  const configAfterUninstall = readConfig(homeDir);
  assert.ok(
    !configAfterUninstall.includes('notify'),
    '执行 uninstall 后应移除当前 CodexPin notify 配置',
  );
}

function testBuildPackagedHookCommand() {
  const command = buildPackagedHookCommand('C:\\Program Files\\CodexPin\\CodexPin.exe');
  assert.deepStrictEqual(
    command,
    ['C:\\Program Files\\CodexPin\\CodexPin.exe', '--codex-hook'],
    '打包模式下的 hook 命令应直接调用 CodexPin.exe --codex-hook',
  );
}

function run() {
  console.log('Running CodexPin CLI tests...');
  testBuildDefaultHookCommand();
  testBuildPackagedHookCommand();
  testRunCliSetupAndUninstall();
  console.log('All CodexPin CLI tests passed.');
}

run();
