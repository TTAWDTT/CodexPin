const { app, BrowserWindow } = require('electron');
const path = require('path');

/**
 * Creates the main CodexPin widget window.
 * For now this is a minimal Electron window that loads renderer/index.html.
 */
function createWindow() {
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
}

app.whenReady().then(() => {
  createWindow();

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
