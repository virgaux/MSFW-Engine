const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('api', {
  getDiagnostics: () => ipcRenderer.invoke('get-diagnostics'),
  exportMotion: (config) => ipcRenderer.invoke('export-motion', config),
  startOpenPose: (mode) => ipcRenderer.invoke('start-openpose', mode),
  poseListener: (callback) => {
    // Adds a listener and returns a cleanup function
    const handler = (event, data) => callback(data);
    ipcRenderer.on('pose-data', handler);
    return () => ipcRenderer.removeListener('pose-data', handler);
  },
  loadBounceConfig: () => ipcRenderer.invoke('load-bounce-config'),
  savePlayback: (data) => ipcRenderer.invoke('save-playback', data),
  loadPlugins: () => ipcRenderer.invoke('load-plugins'),
  checkFile: (filePath) => ipcRenderer.invoke('check-file', filePath),
  loadPoseSequence: () => ipcRenderer.invoke('load-pose-sequence'),
  processVideo: (filePath, progressCallback) => {
    // Example: just invokes without progress support
    return ipcRenderer.invoke('process-video', filePath);
    // If you want progress, you'd need to also set up a 'video-progress' event here
  },
  chooseModelFile: () => ipcRenderer.invoke('choose-model-file'),
  saveModelPath: (filePath) => ipcRenderer.invoke('save-model-path', filePath),
  loadSavedModelPath: () => ipcRenderer.invoke('load-saved-model-path'),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  readModelFile: (filePath) => {
    // Return as base64 for easy transfer
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  }
});
