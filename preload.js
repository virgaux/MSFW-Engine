// preload.js
console.log('------------------- Preload script started! -------------------');
const { contextBridge, ipcRenderer } = require('electron');
// REMOVED: const path = require('path'); // This line is removed

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
    // NEW: Expose path functions via IPC
    getPathBasename: (filePath) => ipcRenderer.invoke('get-path-basename', filePath),
    getPathDirname: (filePath) => ipcRenderer.invoke('get-path-dirname', filePath),
    getPathJoin: (...args) => ipcRenderer.invoke('get-path-join', ...args),

    // Expose specific path...
    // REMOVED: The `path` object exposure as it relied on direct require('path')
    onVideoProcessingStatus: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('video-processing-status', handler);
        return () => ipcRenderer.removeListener('video-processing-status', handler);
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

     // capture provider controls
    getCaptureProvider: () => ipcRenderer.invoke('get-capture-provider'),
    setCaptureProvider: (p) => ipcRenderer.invoke('set-capture-provider', p),
    listCaptureProviders: () => ipcRenderer.invoke('list-capture-providers'),

    // processing
    processVideo: (payload) => ipcRenderer.invoke('process-video', payload),

    // status streams with proper cleanup
    onProcessingStatus: (cb) => {
        const handler = (_e, msg) => cb(msg);
        ipcRenderer.on('video-processing-status', handler);
        return () => ipcRenderer.removeListener('video-processing-status', handler);
    },
    onOpenPoseStatus: (cb) => {
        const handler = (_e, msg) => cb(msg);
        ipcRenderer.on('openpose-status', handler);
        return () => ipcRenderer.removeListener('openpose-status', handler);
    },
    onTranscodePlaybackProgress: (cb) => {
        const handler = (_e, progress) => cb(progress);
        ipcRenderer.on('transcode-playback-progress', handler);
        return () => ipcRenderer.removeListener('transcode-playback-progress', handler);
    },

    // EasyMocap options persistence
    getEasyMocapOptions: () => ipcRenderer.invoke('get-easymocap-options'),
    setEasyMocapOptions: (opts) => ipcRenderer.invoke('set-easymocap-options', opts),
    cancelProcessing: () => ipcRenderer.invoke('cancel-processing'),

});
console.log('------------------- window.api exposed! -------------------');