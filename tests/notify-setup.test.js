const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOML = require('@iarna/toml');

const {
  ensureNotifyHook,
  isNotifyHookConfigured,
  uninstallNotifyHook,
} = require('../scripts/codexpinConfig');

function createTempHome() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codexpin-home-'));
  return base;
}

function readConfig(homeDir) {
  const configPath = path.join(homeDir, '.codex', 'config.toml');
  const raw = fs.readFileSync(configPath, 'utf8');
  return TOML.parse(raw);
}

function readOriginalNotify(homeDir) {
  const originalPath = path.join(homeDir, '.codexpin', 'original-notify.json');
  if (!fs.existsSync(originalPath)) return null;
  return JSON.parse(fs.readFileSync(originalPath, 'utf8'));
}

function testSetupWithoutExistingConfig() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  ensureNotifyHook({ homeDir, hookCommand });

  const cfg = readConfig(homeDir);
  assert.ok(Array.isArray(cfg.notify), 'notify 应该是数组');
  assert.deepStrictEqual(
    cfg.notify,
    hookCommand,
    '在无 config.toml 场景下，notify 应该只包含 CodexPin hook',
  );

  const original = readOriginalNotify(homeDir);
  assert.strictEqual(
    original,
    null,
    '无原始 notify 时不应创建 original-notify.json',
  );
}

function testSetupWithExistingNotifyAndIdempotency() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  const codexDir = path.join(homeDir, '.codex');
  fs.mkdirSync(codexDir, { recursive: true });
  const configPath = path.join(codexDir, 'config.toml');
  fs.writeFileSync(
    configPath,
    'foo = "bar"\nnotify = ["bun", "C:/tools/other-hook.js"]\n',
    'utf8',
  );

  // 第一次 setup：应备份原有 notify，并覆盖为 CodexPin hook
  ensureNotifyHook({ homeDir, hookCommand });

  let cfg = readConfig(homeDir);
  assert.deepStrictEqual(
    cfg.notify,
    hookCommand,
    '有原始 notify 时，config.toml 中的 notify 应替换为 CodexPin hook',
  );

  let original = readOriginalNotify(homeDir);
  assert.deepStrictEqual(
    original,
    ['bun', 'C:/tools/other-hook.js'],
    '原始 notify 应写入 original-notify.json 备份',
  );

  // 第二次 setup：应保持 idempotent，不重复写入 original-notify，也不改变 notify
  ensureNotifyHook({ homeDir, hookCommand });

  cfg = readConfig(homeDir);
  assert.deepStrictEqual(
    cfg.notify,
    hookCommand,
    '重复执行 setup 时，notify 应保持为 CodexPin hook',
  );

  const originalAgain = readOriginalNotify(homeDir);
  assert.deepStrictEqual(
    originalAgain,
    original,
    '重复执行 setup 不应改变 original-notify.json',
  );
}

function testUninstallRestoresOriginalOrRemovesNotify() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  // 场景 A：有原始 notify 备份
  {
    const codexDir = path.join(homeDir, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const configPath = path.join(codexDir, 'config.toml');
    fs.writeFileSync(
      configPath,
      'notify = ["bun", "C:/tools/other-hook.js"]\n',
      'utf8',
    );

    ensureNotifyHook({ homeDir, hookCommand });

    uninstallNotifyHook({ homeDir, hookCommand });

    const cfg = readConfig(homeDir);
    assert.deepStrictEqual(
      cfg.notify,
      ['bun', 'C:/tools/other-hook.js'],
      'uninstall 时应恢复原有 notify 配置',
    );

    const original = readOriginalNotify(homeDir);
    assert.strictEqual(
      original,
      null,
      'uninstall 后应删除 original-notify.json 备份',
    );
  }

  // 场景 B：无原始 notify，仅有 CodexPin hook
  {
    const homeDirB = createTempHome();
    const codexDirB = path.join(homeDirB, '.codex');
    fs.mkdirSync(codexDirB, { recursive: true });
    const configPathB = path.join(codexDirB, 'config.toml');
    const TOMLStr = TOML.stringify({
      notify: hookCommand,
      other: 'value',
    });
    fs.writeFileSync(configPathB, TOMLStr, 'utf8');

    uninstallNotifyHook({ homeDir: homeDirB, hookCommand });

    const cfgB = readConfig(homeDirB);
    assert.strictEqual(
      cfgB.notify,
      undefined,
      '无原始 notify 时，uninstall 应移除 notify 字段而不影响其他配置',
    );
    assert.strictEqual(
      cfgB.other,
      'value',
      'uninstall 不应修改其他配置项',
    );
  }
}

function testDetectsWhetherHookIsConfigured() {
  const homeDir = createTempHome();
  const hookCommand = ['node', 'C:/codexpin/hooks/codexpin-codex-hook.js'];

  assert.strictEqual(
    isNotifyHookConfigured({ homeDir, hookCommand }),
    false,
    '无 config.toml 时应视为未接入',
  );

  const codexDir = path.join(homeDir, '.codex');
  fs.mkdirSync(codexDir, { recursive: true });
  fs.writeFileSync(
    path.join(codexDir, 'config.toml'),
    TOML.stringify({
      notify: ['node', 'C:/other-hook.js'],
    }),
    'utf8',
  );

  assert.strictEqual(
    isNotifyHookConfigured({ homeDir, hookCommand }),
    false,
    'notify 指向其他 hook 时应视为未接入',
  );

  ensureNotifyHook({ homeDir, hookCommand });

  assert.strictEqual(
    isNotifyHookConfigured({ homeDir, hookCommand }),
    true,
    'notify 指向 CodexPin hook 时应识别为已接入',
  );
}

function run() {
  console.log('Running notify setup tests...');
  testSetupWithoutExistingConfig();
  testSetupWithExistingNotifyAndIdempotency();
  testUninstallRestoresOriginalOrRemovesNotify();
  testDetectsWhetherHookIsConfigured();
  console.log('All notify setup tests passed.');
}

run();
