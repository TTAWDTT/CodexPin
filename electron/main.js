const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createStorage } = require('./storage');
const { getSessionStatus } = require('./codexpinStatus');
const { handleHookRuntime } = require('./hookRuntime');
const { runInstallBootstrap } = require('./installBootstrap');
const { normalizeWindowBounds } = require('./windowGeometry');

if (handleHookRuntime()) {
  process.exit(0);
}

let storage;
let installState = {
  installState: 'starting',
  hookConfigured: false,
  autoSetupAttempted: false,
  autoSetupSucceeded: false,
  hookCommand: null,
  message: 'CodexPin 正在检查 Codex 接入状态。',
};
let ipcRegistered = false;

function runAutoInstallBootstrap() {
  installState = runInstallBootstrap({
    executablePath: process.execPath,
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
  });
  return installState;
}

function registerIpcHandlers(storageApi) {
  if (ipcRegistered) {
    return;
  }

  ipcRegistered = true;

  ipcMain.handle('codexpin-load-state', async () => {
    return storageApi.loadState();
  });

  ipcMain.handle('codexpin-save-state', async (_event, state) => {
    await storageApi.saveState(state);
  });

  ipcMain.handle('codexpin-get-session-status', async () => {
    return getSessionStatus({
      hookInstalled: installState.hookConfigured,
      notConnectedMessage: installState.message,
    });
  });

  ipcMain.handle('codexpin-get-installation-status', async () => installState);

  ipcMain.handle('codexpin-retry-installation', async () => runAutoInstallBootstrap());
}

async function createWindow(bounds) {
  const windowOptions = {
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  Object.assign(windowOptions, normalizeWindowBounds(bounds));

  const mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  // Ensure always-on-top behavior across platforms
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Wire IPC handlers for state persistence and window bounds.
  const storageApi = storage || createStorage(app);
  registerIpcHandlers(storageApi);

  mainWindow.on('move', async () => {
    const bounds = mainWindow.getBounds();
    await storageApi.saveWindowBounds(bounds);
  });

  mainWindow.on('close', async () => {
    const bounds = mainWindow.getBounds();
    await storageApi.saveWindowBounds(bounds);
  });
}

app.whenReady().then(async () => {
  storage = createStorage(app);
  runAutoInstallBootstrap();
  const initialState = await storage.loadState();
  const bounds = (initialState && initialState.windowBounds) || null;

  await createWindow(bounds);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
