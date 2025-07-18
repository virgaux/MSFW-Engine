const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDiagnostics: () => ipcRenderer.invoke('get-diagnostics'),
  exportMotion: (config) => ipcRenderer.invoke('export-motion', config),
  startOpenPose: (mode) => ipcRenderer.invoke('start-openpose', mode),
  poseListener: (callback) => ipcRenderer.on('pose-data', (event, data) => callback(data)),
  loadBounceConfig: () => ipcRenderer.invoke('load-bounce-config'),

  loadPlugins: () => ipcRenderer.invoke('load-plugins')
});


