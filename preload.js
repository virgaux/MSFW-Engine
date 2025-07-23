// preload.js
console.log('------------------- Preload script started! -------------------');
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path'); // CORRECTED: Import path module directly

contextBridge.exposeInMainWorld('api', {
    selectVideoFile: () => ipcRenderer.invoke('select-video-file-dialog'),
    processVideo: (config) => ipcRenderer.invoke('process-video', config),
    getVideoMetadata: (videoPath) => ipcRenderer.invoke('get-video-metadata', videoPath),
    exportMotion: (config) => ipcRenderer.invoke('export-motion', config),
    loadPlugins: () => ipcRenderer.invoke('load-plugins'),
    loadBounceConfig: () => ipcRenderer.invoke('load-bounce-config'),
    startOpenpose: (mode) => ipcRenderer.invoke('start-openpose', mode),
    savePlayback: (data) => ipcRenderer.invoke('save-playback', data),
    checkFile: (filePath) => ipcRenderer.invoke('check-file', filePath),
    loadPoseSequence: () => ipcRenderer.invoke('load-pose-sequence'),
    chooseModelFile: () => ipcRenderer.invoke('choose-model-file'),
    saveModelPath: (modelPath) => ipcRenderer.invoke('save-model-path', modelPath),
    loadSavedModelPath: () => ipcRenderer.invoke('load-saved-model-path'),
    readModelFile: (filePath) => ipcRenderer.invoke('read-model-file', filePath),
    readLocalFile: (filePath) => ipcRenderer.invoke('read-local-file', filePath),
    // Expose specific path methods
    path: {
        basename: (p) => path.basename(p) // This will now correctly use the 'path' module
    },

    // Listeners for status updates - CORRECTED to return unsubscription functions
    onVideoProcessingStatus: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('video-processing-status', handler);
        return () => ipcRenderer.removeListener('video-processing-status', handler);
    },
    onOpenposeStatus: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('openpose-status', handler);
        return () => ipcRenderer.removeListener('openpose-status', handler);
    },
    onPoseData: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('pose-data', handler);
        return () => ipcRenderer.removeListener('pose-data', handler);
    },
    onAppNotification: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('app-notification', handler);
        return () => ipcRenderer.removeListener('app-notification', handler);
    },
    // NEW: Expose the transcoding function
    transcodeForPlayback: (filePath) => ipcRenderer.invoke('transcode-for-playback', filePath),

    // NEW: Expose the transcoding progress listener
    onTranscodePlaybackProgress: (callback) => {
        ipcRenderer.on('transcode-playback-progress', (event, progress) => callback(progress));
        return () => ipcRenderer.removeListener('transcode-playback-progress', callback);
    },
});
console.log('------------------- window.api exposed! -------------------');
// console.log('window.api content:', Object.keys(window.api)); // Uncomment for inspection if needed