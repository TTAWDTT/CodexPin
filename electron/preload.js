const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal API surface for the renderer.
contextBridge.exposeInMainWorld('codexpin', {
  getInstallationStatus: () => ipcRenderer.invoke('codexpin-get-installation-status'),
  loadState: () => ipcRenderer.invoke('codexpin-load-state'),
  retryInstallation: () => ipcRenderer.invoke('codexpin-retry-installation'),
  saveState: (state) => ipcRenderer.invoke('codexpin-save-state', state),
  getSessionStatus: () => ipcRenderer.invoke('codexpin-get-session-status'),
});
