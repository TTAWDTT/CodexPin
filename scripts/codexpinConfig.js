const fs = require('fs');
const path = require('path');
const os = require('os');

const TOML = require('@iarna/toml');

function getPaths(homeDir) {
  const home = homeDir || os.homedir();
  const codexDir = path.join(home, '.codex');
  const codexConfigPath = path.join(codexDir, 'config.toml');
  const codexpinDir = path.join(home, '.codexpin');
  const originalNotifyPath = path.join(codexpinDir, 'original-notify.json');
  return {
    homeDir: home,
    codexDir,
    codexConfigPath,
    codexpinDir,
    originalNotifyPath,
  };
}

function readTomlConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return TOML.parse(raw);
  } catch {
    // 如果解析失败，则退回到空配置，避免破坏原有文件
    return {};
  }
}

function writeTomlConfig(configPath, obj) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tomlStr = TOML.stringify(obj);
  fs.writeFileSync(configPath, tomlStr, 'utf8');
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildPackagedHookCommand(executablePath) {
  if (!executablePath || typeof executablePath !== 'string') {
    throw new Error('executablePath must be a non-empty string');
  }

  return [executablePath, '--codex-hook'];
}

function isNotifyHookConfigured(options) {
  const { homeDir, hookCommand } = options || {};
  if (!Array.isArray(hookCommand) || hookCommand.length === 0) {
    return false;
  }

  const { codexConfigPath } = getPaths(homeDir);
  const config = readTomlConfig(codexConfigPath);
  const existingNotify = Array.isArray(config.notify) ? config.notify : undefined;
  return arraysEqual(existingNotify, hookCommand);
}

/**
 * 确保 Codex 的 config.toml 中已经注册 CodexPin hook：
 * - 无 notify 时：直接写入 CodexPin hook
 * - 有 notify 时：备份原值到 ~/.codexpin/original-notify.json，并覆盖为 CodexPin hook
 * - 重复执行时：保持幂等，不重复修改
 */
function ensureNotifyHook(options) {
  const { homeDir, hookCommand } = options || {};
  if (!Array.isArray(hookCommand) || hookCommand.length === 0) {
    throw new Error('hookCommand must be a non-empty string array');
  }

  const {
    codexConfigPath,
    codexpinDir,
    originalNotifyPath,
  } = getPaths(homeDir);

  const config = readTomlConfig(codexConfigPath);
  const existingNotify = Array.isArray(config.notify) ? config.notify : undefined;

  if (arraysEqual(existingNotify, hookCommand)) {
    // 已经是 CodexPin hook，不需要重复写入
    return {
      changed: false,
      alreadyConfigured: true,
    };
  }

  // 如果存在原始 notify 且尚未备份，保存到 original-notify.json
  if (existingNotify && !fs.existsSync(originalNotifyPath)) {
    if (!fs.existsSync(codexpinDir)) {
      fs.mkdirSync(codexpinDir, { recursive: true });
    }
    try {
      fs.writeFileSync(
        originalNotifyPath,
        JSON.stringify(existingNotify),
        'utf8',
      );
    } catch {
      // 备份失败时不应破坏原有行为
    }
  }

  config.notify = hookCommand.slice();
  writeTomlConfig(codexConfigPath, config);

  return {
    changed: true,
    alreadyConfigured: false,
  };
}

/**
 * 卸载 CodexPin hook：
 * - 若存在 original-notify.json：恢复为原有 notify，并删除备份
 * - 否则：仅在 notify 等于 CodexPin hook 时删除 notify 字段
 */
function uninstallNotifyHook(options) {
  const { homeDir, hookCommand } = options || {};
  const {
    codexConfigPath,
    codexpinDir,
    originalNotifyPath,
  } = getPaths(homeDir);

  if (!fs.existsSync(codexConfigPath)) {
    return { changed: false };
  }

  const config = readTomlConfig(codexConfigPath);

  let restoredFromBackup = false;

  if (fs.existsSync(originalNotifyPath)) {
    try {
      const original = JSON.parse(fs.readFileSync(originalNotifyPath, 'utf8'));
      if (Array.isArray(original)) {
        config.notify = original;
        restoredFromBackup = true;
      }
    } catch {
      // 如果备份损坏，则直接删除 notify
      delete config.notify;
    }

    try {
      fs.unlinkSync(originalNotifyPath);
    } catch {
      // 失败时忽略
    }
  } else if (Array.isArray(config.notify) && Array.isArray(hookCommand)) {
    if (arraysEqual(config.notify, hookCommand)) {
      delete config.notify;
    }
  }

  writeTomlConfig(codexConfigPath, config);

  // 清理空的 ~/.codexpin 目录（可选）
  try {
    const files = fs.readdirSync(codexpinDir);
    if (files.length === 0) {
      fs.rmdirSync(codexpinDir);
    }
  } catch {
    // 忽略目录清理失败
  }

  return {
    changed: true,
    restoredFromBackup,
  };
}

module.exports = {
  buildPackagedHookCommand,
  ensureNotifyHook,
  isNotifyHookConfigured,
  uninstallNotifyHook,
  // 导出内部路径工具便于未来扩展或调试
  __internal: {
    arraysEqual,
    getPaths,
    readTomlConfig,
    writeTomlConfig,
  },
};
