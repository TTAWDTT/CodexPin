const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createStorage } = require('./storage');

/**
 * Creates the main CodexPin widget window.
 * For now this is a minimal Electron window that loads renderer/index.html.
 */
let storage;

async function createWindow() {
  const mainWindow = new BrowserWindow({
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
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Wire IPC handlers for state persistence and window bounds.
  const storageApi = storage || createStorage(app);

  ipcMain.handle('codexpin-load-state', async () => {
    return storageApi.loadState();
  });

  ipcMain.handle('codexpin-save-state', async (_event, state) => {
    await storageApi.saveState(state);
  });

  mainWindow.on('moved', async () => {
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
