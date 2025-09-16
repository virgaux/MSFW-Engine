// main.js
console.log("------------------- Main.js VERSION 5.1 LOADING -------------------");

const { ipcMain, app, BrowserWindow, dialog, Notification, protocol } = require('electron');
const { watchKeypoints } = require('./backend/poseDataWatcher');
const { loadBounceConfig } = require('./backend/helpers/bounceTagger');
const { exportMotionData } = require('./backend/exporters/exporter');


const { getVideoMetadata, processVideoForOpenPose } = require('./backend/videoService'); 
const ffmpegHelper = require('./backend/helpers/ffmpegHelper'); 
const { OpenPoseWrapper } = require('./backend/openposeWrapper');

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// --- Helper Functions ---
function getUserDataPath() {
    return app.getPath('userData');
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}
// --- END Helper Functions ---

// Path for general settings (msfw_settings.json)
const settingsPath = path.join(getUserDataPath(), 'msfw_settings.json');

// Settings helpers
async function getSettings() {
    try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        if (e.code === 'ENOENT') {
            return {}; // File not found, return empty settings
        }
        console.error("Error loading settings:", e.message, `(Code: ${e.code})`);
        return {};
    }
}

async function setSettings(newSettings) {
    try {
        await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
    } catch (e) {
        console.error("Error saving settings:", e.message, `(Code: ${e.code})`);
    }
}

// NEW: Define tempVideoDir for transcoded playback files
const tempVideoDir = path.join(os.tmpdir(), 'msfw_temp_playback'); 

// ADDED: Declare mainWindow and openPoseWrapper globally
let mainWindow; // <--- ADDED
let openPoseWrapper; // <--- ADDED

function createWindow() {
    // CHANGED: Assign to global mainWindow instead of local 'win'
    mainWindow = new BrowserWindow({ // <--- CHANGED
        width: 1200,
        height: 800,
        minWidth: 800, // <--- ADDED: Good practice for responsive UI
        minHeight: 600, // <--- ADDED: Good practice for responsive UI
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // CHANGED: Corrected security settings for webPreferences
            nodeIntegration: false, // <--- CHANGED: Set to false for security with contextIsolation
            contextIsolation: true, // <--- CHANGED: Should be true for security
            webSecurity: false // <--- ADDED: May be needed for local file access, consider hardening for production
        },
        title: "MSFW Engine" // <--- ADDED: Add a title to the window
    });

    // DETERMINE OPENPOSE PATH BASED ON ENVIRONMENT
    let openposeBasePath;
    if (app.isPackaged) {
        openposeBasePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'openpose');
    } else {
        openposeBasePath = path.join(__dirname, 'openpose');
    }
    console.log(`[Main Process] OpenPose base path: ${openposeBasePath}`);
    console.log(path.join(getUserDataPath(), 'openpose_output_keypoints'))
    openPoseWrapper = new OpenPoseWrapper({
        openposePath: openposeBasePath,
        userDataPath: getUserDataPath(), 
        outputDir: path.join(getUserDataPath(), 'openpose_output_keypoints'), // Set default output path for OpenPose
    }); // <--- ADDED

    // ADDED: Set up listeners for OpenPoseWrapper events once and forward them to the renderer
    openPoseWrapper.on('progress', (data) => {
        if (mainWindow) mainWindow.webContents.send('openpose-status', { type: 'progress', data: data });
    }); // <--- ADDED
    openPoseWrapper.on('start', (message) => {
        if (mainWindow) mainWindow.webContents.send('openpose-status', { type: 'start', data: message });
    }); // <--- ADDED
    openPoseWrapper.on('complete', (data) => {
        if (mainWindow) mainWindow.webContents.send('openpose-status', { type: 'complete', data: data });
    }); // <--- ADDED
    openPoseWrapper.on('error', (error) => {
        if (mainWindow) mainWindow.webContents.send('openpose-status', { type: 'error', data: error.message });
    }); // <--- ADDED
    openPoseWrapper.on('cancelled', (message) => {
        if (mainWindow) mainWindow.webContents.send('openpose-status', { type: 'cancelled', data: message });
    }); // <--- ADDED

    // ADDED: Initialize OpenPoseWrapper to detect GPU etc. This should run once at startup.
    openPoseWrapper.initialize().catch(err => {
        console.error('[Main Process] OpenPoseWrapper initialization failed:', err.message);
        if (mainWindow) {
            mainWindow.webContents.send('app-notification', {
                title: 'OpenPose Setup Error',
                body: `OpenPose initialization failed: ${err.message}. Please check your OpenPose installation and ensure models are present.`,
                severity: 'error'
            });
        }
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000'); // <--- CHANGED: Use mainWindow
        mainWindow.webContents.openDevTools(); // <--- CHANGED: Use mainWindow
    } else {
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html')); // <--- CHANGED: Use mainWindow
    }
}


app.whenReady().then(async () => { // Made this async to await directory creation
    createWindow();

    // Ensure the temporary directory for playback transcoding exists
    await fs.mkdir(tempVideoDir, { recursive: true });
    console.log(`[Main Process] Playback temp directory created at: ${tempVideoDir}`);

    watchKeypoints(async (keypoints, filename) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.send('pose-data', { keypoints, filename });
        }

        const playbackPath = path.join(getUserDataPath(), 'playback.json');
        try {
            await fs.writeFile(playbackPath, JSON.stringify(keypoints, null, 2), 'utf-8');
            console.log(`[MSFW] Auto-saved ${keypoints.length} frames to playback.json`);
        } catch (err) {
            console.error("[MSFW] Failed to write playback.json:", err.message);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

});


app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// --- Capture Provider Loader (main.js) ---
const providers = new Map(); // 'openpose' | 'easymocap' -> provider instance

function registerOpenPoseProvider() {
  // We will call your existing OpenPose path directly (no wrapper object required),
  // but we still register a shim so the dispatcher is uniform.
  providers.set('openpose', {
    kind: 'openpose',
    async processVideo({ filePath, startTime, endTime, webContents }) {
      // call your existing handler code path directly (see section D below)
      return runOpenPoseFlow({ filePath, startTime, endTime, webContents });
    }
  });
}

function registerEasyMocapProvider() {
  // Load the plugin’s provider (the file you added in /plugins/easymocap/easymocapProvider.js)
  const pluginRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'plugins', 'easymocap')
    : path.join(__dirname, 'plugins', 'easymocap');

  const { EasyMocapProvider } = require(path.join(pluginRoot, 'easymocapProvider.js'));
  const em = new EasyMocapProvider(pluginRoot);

  // forward plugin logs to renderer’s console panel
  em.on('log', (l) => {
    const msg = `[EM] ${l.level || 'info'}: ${l.msg || ''}`;
    if (BrowserWindow.getAllWindows()[0]) {
      BrowserWindow.getAllWindows()[0].webContents.send('video-processing-status', { type: 'log', message: msg });
    }
  });

  // when it finishes, you’ll get the manifest here
  em.on('result', ({ jobId, manifest }) => {
    // Save manifest next to output for traceability, and notify UI
    const outFile = path.join(manifest.output, 'manifest_easymocap.json');
    fs.writeFile(outFile, JSON.stringify(manifest, null, 2));
    if (BrowserWindow.getAllWindows()[0]) {
      BrowserWindow.getAllWindows()[0].webContents.send('video-processing-status', { type: 'complete', message: 'EasyMocap complete', manifest });
    }
  });

  providers.set('easymocap', {
    kind: 'easymocap',
    instance: em,
    processVideo: (opts) => em.processVideo(opts)
  });
}

// call both at startup (after app.whenReady)
registerOpenPoseProvider();
registerEasyMocapProvider();

async function runOpenPoseFlow({ filePath, startTime, endTime, webContents }) {
  try {
    webContents.send('video-processing-status', { type: 'start', message: 'Starting video processing...' });

    webContents.send('video-processing-status', { type: 'clipping', message: 'Clipping video...' });
    const { outputPath: clippedVideoOutputPath } = await processVideoForOpenPose({ filePath, startTime, endTime }, (progress) => {
      webContents.send('video-processing-status', { type: 'clipping-progress', message: `Clipping: ${progress.percent.toFixed(1)}%`, progress });
    });

    webContents.send('video-processing-status', { type: 'openpose-start', message: 'Starting OpenPose...' });
    await openPoseWrapper.runOpenPose(clippedVideoOutputPath, { display: 0, renderPose: 0 });

    // clean up temp clip
    try { if (await fileExists(clippedVideoOutputPath)) await fs.unlink(clippedVideoOutputPath); } catch {}

    webContents.send('video-processing-status', { type: 'complete', message: 'Video processing and OpenPose complete!' });
    return { success: true, message: 'Video processed and OpenPose run.' };
  } catch (error) {
    const errorMessage = `Video processing failed: ${error.message}`;
    webContents.send('video-processing-status', { type: 'error', message: errorMessage, error: error.message });
    throw new Error(errorMessage);
  }
}



// --- IPC Handlers ---

// NEW: IPC handlers for path operations
ipcMain.handle('get-path-basename', async (event, filePath) => {
    return path.basename(filePath);
});

ipcMain.handle('get-path-dirname', async (event, filePath) => {
    return path.dirname(filePath);
});

ipcMain.handle('get-path-join', async (event, ...args) => {
    return path.join(...args);
});


ipcMain.handle('export-motion', async (event, config) => {
    const exportDir = path.join(getUserDataPath(), 'output', 'exports');
    await fs.mkdir(exportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(exportDir, `${config.filename}_${timestamp}.${config.format}`);

    let frameData = config.frames;
    if (!Array.isArray(frameData) || frameData.length === 0) {
        try {
            const fallbackPath = path.join(getUserDataPath(), 'playback.json');
            frameData = JSON.parse(await fs.readFile(fallbackPath, 'utf-8'));
            console.warn("[MSFW] Using fallback playback.json for export.");
        } catch (err) {
            console.error("[MSFW] No valid frame data found for export:", err.message);
            return false;
        }
    }

    exportMotionData(frameData, outputPath, config.format);

    if (process.platform === 'win32') {
        exec(`start "" "${exportDir}"`);
    } else if (process.platform === 'darwin') {
        exec(`open "${exportDir}"`);
    } else { // Linux
        exec(`xdg-open "${exportDir}"`);
    }

    return true;
});

ipcMain.handle('load-plugins', async () => {
    // CHANGED: Corrected path for packaged app to explicitly unpack plugins
    const pluginDir = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'plugins') : './plugins'; // <--- CHANGED
    const results = [];

    await fs.mkdir(pluginDir, { recursive: true });
    const pluginFiles = (await fs.readdir(pluginDir)).filter(f => f.endsWith('.js'));

    for (const file of pluginFiles) {
        const pluginPath = path.join(pluginDir, file);
        try {
            const plugin = require(path.resolve(pluginPath));
            if (typeof plugin.onLoad === 'function') plugin.onLoad();
            results.push({ name: plugin.name || file, status: 'Loaded' });
        } catch (e) {
            results.push({ name: file, status: 'Error: ' + e.message });
        }
    }

    return results;
});

ipcMain.handle('load-bounce-config', async () => {
    return loadBounceConfig();
});

ipcMain.handle('start-openpose', async (event, mode) => {
    // This handler is typically for starting OpenPose in webcam mode or similar,
    // which has different setup from video processing.
    console.warn("[Main Process] 'start-openpose' handler invoked. Implement specific webcam/live processing logic here.");
    // Example: (needs a dedicated OpenPoseWrapper instance for live feed if different from video processing)
    // const webcamOpenPose = new OpenPoseWrapper({ /* webcam config */ });
    // await webcamOpenPose.initialize();
    // webcamOpenPose.runOpenPose(0); // 0 often represents default webcam
    return false; // Or return true once implemented
});

ipcMain.handle('save-playback', async (event, data) => {
    const filePath = path.join(getUserDataPath(), 'playback.json');
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log('[MSFW] Playback saved manually.');
        return true;
    } catch (err) {
        console.error('[MSFW] Error saving playback:', err);
        return false;
    }
});

ipcMain.handle('check-file', async (event, filePath) => {
    console.log(`[Main Process - check-file] Checking existence for: ${filePath}`);
    if (!filePath) {
        console.warn('[Main Process - check-file] Warning: filePath is null or empty.');
        return false;
    }
    return await fileExists(filePath);
});

ipcMain.handle('load-pose-sequence', async () => {
    const playbackPath = path.join(getUserDataPath(), 'playback.json');
    try {
        const data = await fs.readFile(playbackPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("[MSFW] Error loading pose sequence:", e.message);
        return [];
    }
});

ipcMain.handle('choose-model-file', async () => {
    const result = await dialog.showOpenDialog({
        title: "Select DAZ Model (FBX)",
        filters: [{ name: 'FBX Files', extensions: ['fbx'] }],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});


ipcMain.handle('save-model-path', async (event, modelPath) => {
    try {
        const configPath = path.join(getUserDataPath(), 'config.json');
        let config = {};

        if (await fileExists(configPath)) {
            const data = await fs.readFile(configPath, 'utf-8');
            config = JSON.parse(data);
        }
        config.savedModelPath = modelPath;

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log('Model path saved asynchronously:', modelPath);
        return { success: true };
    } catch (error) {
        console.error('Failed to save model path:', error);
        throw new Error(`Failed to save model path: ${error.message}`);
    }
});

ipcMain.handle('load-saved-model-path', async (event) => {
    try {
        const configPath = path.join(getUserDataPath(), 'config.json');
        if (await fileExists(configPath)) {
            const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
            return config.savedModelPath || null;
        }
        return null;
    } catch (error) {
        console.error('Failed to load saved model path:', error);
        return null;
    }
});

ipcMain.handle('read-model-file', async (event, filePath) => {
    console.log(`[Main Process - read-model-file] Attempting to read model file: ${filePath}`);
    if (!filePath) {
        console.warn('[Main Process - read-model-file] Warning: filePath is null or empty.');
        return null;
    }
    try {
        const buffer = await fs.readFile(filePath);
        const base64Data = buffer.toString('base64');
        console.log(`[Main Process - read-model-file] Successfully read file: ${filePath}, Base64 length: ${base64Data.length}`);
        return base64Data;
    } catch (error) {
        console.error(`[Main Process - read-model-file] Error reading model file "${filePath}":`, error.message, `(Code: ${error.code})`);
        return null;
    }
});

// Handler to open a native file dialog for video selection
ipcMain.handle('select-video-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        title: "Select Video File",
        filters: [
            { name: 'All Video Files', extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp', 'mpg', 'mpeg'] },
            { name: 'MPEG-4 Video', extensions: ['mp4', 'm4v'] },
            { name: 'QuickTime Movie', extensions: ['mov'] },
            { name: 'WebM Video', extensions: ['webm'] },
            { name: 'AVI Video', extensions: ['avi'] },
            { name: 'Matroska Video', extensions: ['mkv'] },
            { name: 'Flash Video', extensions: ['flv'] },
            { name: 'Windows Media Video', extensions: ['wmv'] },
            { name: 'MPEG Video', extensions: ['mpg', 'mpeg'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

// Handler to get video metadata (duration)
ipcMain.handle('get-video-metadata', async (event, videoPath) => {
    try {
        const metadata = await getVideoMetadata(videoPath); 
        const formatName = metadata.format?.format_name;
        const videoCodecName = metadata.streams?.[0]?.codec_name;
        let playbackMimeType = 'application/octet-stream'; 
        if (formatName === 'mov,mp4,m4a,3gp,3g2,mj2') {
            playbackMimeType = 'video/mp4';
        } else if (formatName === 'mpegts') {
            if (videoCodecName === 'h264' || videoCodecName === 'avc1') {
                playbackMimeType = 'video/mp2t; codecs="avc1"'; 
            } else if (videoCodecName === 'mpeg2video') {
                playbackMimeType = 'video/mp2t; codecs="mpeg-2 video"'; 
            } else {
                playbackMimeType = 'video/mp2t';
            }
        } else if (formatName === 'webm') {
            playbackMimeType = 'video/webm';
        } else if (formatName === 'ogg') {
            playbackMimeType = 'video/ogg';
        }

        return {
            success: true,
            metadata: {
                ...metadata,
                playbackMimeType: playbackMimeType
            }
        };
    } catch (error) {
        console.error('Error in main.js get-video-metadata handler:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('transcode-for-playback', async (event, filePath) => {
    const webContents = event.sender;
    try {
        const tempDir = path.join(os.tmpdir(), 'msfw_temp_playback');
        await fs.mkdir(tempDir, { recursive: true });
        const tempFilePath = path.join(tempDir, `playback_temp_${Date.now()}.mp4`);

        let lastProgress = 0;
        await ffmpegHelper.transcodeVideo(filePath, tempFilePath, (progress) => {
            const currentPercent = progress.percent || 0;
            if (currentPercent - lastProgress >= 1 || currentPercent === 100) { // Update roughly every 1% or at 100%
                webContents.send('transcode-playback-progress', { percent: currentPercent });
                lastProgress = currentPercent;
            }
        });

        // NEW CHECK: Verify file size after transcoding
        const stats = await fs.stat(tempFilePath);
        if (stats.size === 0) {
            console.error(`[Main Process] Transcoded file ${tempFilePath} is empty!`);
            // Clean up the empty file
            await fs.unlink(tempFilePath); 
            throw new Error('Transcoding completed, but the output file is empty.');
        }

        webContents.send('transcode-playback-progress', { percent: 100 }); // Ensure 100% is sent
        console.log(`[Main Process] Transcoding for playback successfully created: ${tempFilePath} (${stats.size} bytes)`);

        return { success: true, tempFilePath };
    } catch (error) {
        console.error('[Main Process] Error during transcode-for-playback:', error);
        webContents.send('transcode-playback-progress', { percent: 0 }); // Reset progress on error
        return { success: false, error: error.message };
    }
});


// Modified process-video handler (with EM robustness)
ipcMain.handle('process-video', async (event, { filePath, startTime, endTime, emOptions }) => {
  const webContents = event.sender;

  const settings = await getSettings();
  const providerKey = settings.captureProvider || 'openpose';

  // Always clip first (keeps UX the same for both engines)
  webContents.send('video-processing-status', { type: 'clipping', message: 'Clipping video...' });
  const { outputPath: clipped } = await processVideoForOpenPose(
    { filePath, startTime, endTime },
    (progress) => webContents.send('video-processing-status', {
      type: 'clipping-progress',
      message: `Clipping: ${progress.percent?.toFixed?.(1) ?? 0}%`,
      progress
    })
  );

  if (providerKey !== 'easymocap') {
    // Fallback to existing OpenPose path
    return await runOpenPoseFlow({ filePath, startTime, endTime, webContents });
  }

  // ---- EasyMocap path below ----
  // Merge persisted settings.easymocap with UI overrides (emOptions)
  const emOpts = Object.assign({}, settings.easymocap || {}, emOptions || {});
  const emPlugin = providers.get('easymocap')?.instance;

  if (!emPlugin) {
    const msg = 'EasyMocap plugin not available (not detected or failed to load).';
    webContents.send('video-processing-status', { type: 'error', message: msg });
    throw new Error(msg);
  }

  // Validate required pieces early for good UX
  if (!emOpts.easymocapRoot) {
    webContents.send('video-processing-status', { type: 'error', message: 'Set EASYMOCAP_ROOT in EasyMocap options.' });
    throw new Error('Missing EASYMOCAP_ROOT');
  }
  if (emOpts.exportBVH !== false && !emOpts.blenderPath) {
    webContents.send('video-processing-status', { type: 'error', message: 'Blender path is required to export BVH.' });
    throw new Error('Missing Blender path');
  }

  // Data layout: monocular vs multiview
  // If the user passed a multiview dataset folder in emOptions.dataRoot, use it.
  // Otherwise, default to the clipped video’s folder for monocular.
  const isMultiview = (emOpts.mode || 'monocular') === 'multiview';
  const dataRoot = (isMultiview && emOpts.dataRoot) ? emOpts.dataRoot : path.dirname(clipped);
  const outputDir = path.join(dataRoot, 'output');
  await fs.mkdir(outputDir, { recursive: true });

  webContents.send('video-processing-status', { type: 'start', message: 'Starting EasyMocap...' });

  // Build and start EM job
  const jobId = emPlugin.processVideo({
    jobId: `em_${Date.now()}`,
    mode: emOpts.mode || 'monocular',
    dataRoot,
    output: outputDir,
    emcCmd: emOpts.emcCmd || 'emc',
    emcArgs: emOpts.emcArgs || '--data config/datasets/svimage.yml --exp config/1v1p/hrnet_pare_finetune.yml --root {data_root}',
    exportBVH: emOpts.exportBVH !== false, // default true
    profile: emOpts.profile || 'genesis8',
    blender: emOpts.blenderPath || '',
    extraEnv: Object.assign({ EASYMOCAP_ROOT: emOpts.easymocapRoot || '' }, emOpts.extraEnv || {}),
    pythonPath: emOpts.pythonPath || '' // requires provider to honor this (see note below)
  });

  // The provider will emit 'result'/'error' which you already forward in registerEasyMocapProvider()
  return { success: true, message: `EasyMocap job started: ${jobId}` };
});




ipcMain.on('show-notification', (event, options) => {
    if (Notification.isSupported()) {
        const notification = new Notification(options);
        notification.show();
    } else {
        console.warn('Electron Notification API is not supported on this system.');
        event.sender.send('app-notification', { title: options.title, body: options.body });
    }
});

ipcMain.handle('read-local-file', async (event, filePath) => {
    try {
        const data = await fs.readFile(filePath);
        // Using slice to get a detached ArrayBuffer, which is safer for renderer process
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength); 
        console.log(`[Main Process - read-local-file] Read ${arrayBuffer.byteLength} bytes from ${filePath}`);
        if (arrayBuffer.byteLength === 0) {
            console.warn(`[Main Process - read-local-file] Warning: File ${filePath} returned an empty buffer.`);
        }
        return arrayBuffer; // Return ArrayBuffer for Blob creation in renderer
    } catch (error) {
        console.error(`[Main Process - read-local-file] Failed to read local file ${filePath}:`, error);
        throw new Error(`Failed to read local file: ${error.message}`);
    }
});


ipcMain.handle('get-capture-provider', async () => {
  const s = await getSettings();
  return s.captureProvider || 'openpose';
});

ipcMain.handle('set-capture-provider', async (event, provider) => {
  const s = await getSettings();
  s.captureProvider = provider; // 'openpose' | 'easymocap'
  await setSettings(s);
  return true;
});

ipcMain.handle('list-capture-providers', async () => {
  const arr = [];
  if (providers.has('openpose')) arr.push({ key: 'openpose', name: 'OpenPose' });
  if (providers.has('easymocap')) {
    // verify the EM bridge exists
    const ok = await providers.get('easymocap').instance.detect();
    if (ok) arr.push({ key: 'easymocap', name: 'EasyMocap' });
  }
  return arr;
});

ipcMain.handle('get-easymocap-options', async () => {
  const s = await getSettings();
  return s.easymocap || {
    mode: 'monocular',
    easymocapRoot: '',
    blenderPath: '',
    profile: 'genesis8',
    emcCmd: 'emc',
    emcArgs: '--data config/datasets/svimage.yml --exp config/1v1p/hrnet_pare_finetune.yml --root {data_root}',
    pythonPath: ''
  };
});

ipcMain.handle('set-easymocap-options', async (_e, opts) => {
  const s = await getSettings();
  s.easymocap = Object.assign({}, s.easymocap || {}, opts);
  await setSettings(s);
  return true;
});


// --- END IPC Handlers ---

