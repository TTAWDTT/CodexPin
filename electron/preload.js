const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal API surface for the renderer. We will extend this later.
contextBridge.exposeInMainWorld('codexpin', {
  loadState: () => ipcRenderer.invoke('codexpin-load-state'),
  saveState: (state) => ipcRenderer.invoke('codexpin-save-state', state),
});
