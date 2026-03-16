const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createStorage } = require('./storage');
const { getSessionStatus } = require('./codexpinStatus');

let storage;

async function createWindow(bounds) {
  const windowOptions = {
    width: 360,
    height: 220,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (bounds && typeof bounds === 'object') {
    Object.assign(windowOptions, bounds);
  }

  const mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  // Ensure always-on-top behavior across platforms
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Wire IPC handlers for state persistence and window bounds.
  const storageApi = storage || createStorage(app);

  ipcMain.handle('codexpin-load-state', async () => {
    return storageApi.loadState();
  });

  ipcMain.handle('codexpin-save-state', async (_event, state) => {
    await storageApi.saveState(state);
  });

  ipcMain.handle('codexpin-get-session-status', async () => {
    return getSessionStatus();
  });

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
