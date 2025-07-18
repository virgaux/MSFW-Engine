const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDiagnostics: () => ipcRenderer.invoke('get-diagnostics'),
  exportMotion: (config) => ipcRenderer.invoke('export-motion', config),
  loadPlugins: () => ipcRenderer.invoke('load-plugins')
});