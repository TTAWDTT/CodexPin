const { contextBridge } = require('electron');

// Expose a minimal API surface for the renderer. We will extend this later.
contextBridge.exposeInMainWorld('codexpin', {
  // placeholder to verify preload wiring; real APIs will be added in later steps
  ping: () => 'pong',
});

