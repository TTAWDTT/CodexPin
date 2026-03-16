const assert = require('assert');
const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');

function testBuildUsesCustomIconAssets() {
  const build = packageJson.build || {};
  const win = build.win || {};
  const nsis = build.nsis || {};

  assert.strictEqual(
    win.icon,
    'assets/icon/codexpin.ico',
    'Windows build 应使用自定义 ico 图标',
  );
  assert.strictEqual(
    nsis.oneClick,
    false,
    '安装器应关闭 oneClick，允许用户选择安装路径',
  );
  assert.strictEqual(
    nsis.allowToChangeInstallationDirectory,
    true,
    '安装器应允许修改安装目录',
  );
}

function testBuildIconFilesExist() {
  const pngPath = path.join(__dirname, '..', 'assets', 'icon', 'codexpin-logo.png');
  const icoPath = path.join(__dirname, '..', 'assets', 'icon', 'codexpin.ico');

  assert.strictEqual(fs.existsSync(pngPath), true, '透明 PNG logo 应存在');
  assert.strictEqual(fs.existsSync(icoPath), true, 'Windows ICO 图标应存在');
}

function run() {
  console.log('Running build config tests...');
  testBuildUsesCustomIconAssets();
  testBuildIconFilesExist();
  console.log('All build config tests passed.');
}

run();
