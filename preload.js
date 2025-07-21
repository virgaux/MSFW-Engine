// preload.js
const { contextBridge, ipcRenderer } = require('electron');


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
    processVideo: (filePath) => {
        // Note: progressCallback is not passed through here.
        // If you want real-time progress, you'll need a separate ipcRenderer.on('video-progress', ...)
        return ipcRenderer.invoke('process-video', filePath);
    },
    chooseModelFile: () => ipcRenderer.invoke('choose-model-file'),
    saveModelPath: (filePath) => ipcRenderer.invoke('save-model-path', filePath),
    loadSavedModelPath: () => ipcRenderer.invoke('load-saved-model-path'), // <--- ADDED THIS CRITICAL LINE
    showNotification: (options) => ipcRenderer.send('show-notification', options), // <--- Changed to .send (more typical for notifications)
    readModelFile: (filePath) => ipcRenderer.invoke('read-model-file', filePath)

});