// main.js
console.log("------------------- Main.js VERSION 5.1 LOADING -------------------");

const { ipcMain, app, BrowserWindow, dialog, Notification, protocol } = require('electron');
const { watchKeypoints } = require('./backend/poseDataWatcher');
const { loadBounceConfig } = require('./backend/helpers/bounceTagger');
const { exportMotionData } = require('./backend/exporters/exporter');

// CORRECTED IMPORTS:
// videoService exports getVideoMetadata and processVideoForOpenPose
const { getVideoMetadata, processVideoForOpenPose } = require('./backend/videoService'); 
// ffmpegHelper exports clipVideo and transcodeVideo
const ffmpegHelper = require('./backend/helpers/ffmpegHelper'); 


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

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true
        }
    });
    const isDev = !app.isPackaged;
    if (isDev) {
        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'build', 'index.html'));
    }
}


app.whenReady().then(async () => { // Made this async to await directory creation
    createWindow();

    // Ensure the temporary directory for playback transcoding exists
    await fs.mkdir(tempVideoDir, { recursive: true });
    console.log(`[Main Process] Playback temp directory created at: ${tempVideoDir}`);

    // Register a custom protocol for local file access if webSecurity: false is not desired
    // This example uses file:// directly for simplicity, but if you need a more robust
    // solution for serving local files securely, you'd use something like:
    /*
    protocol.handle('app-video', (request) => {
        const filePath = decodeURIComponent(request.url.replace(/^app-video:\/\//, ''));
        return net.fetch(pathToFileURL(filePath).toString());
    });
    */

    // The callback for watchKeypoints must be async if it contains awaits
    // This watches the output directory for OpenPose and sends data to the renderer
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


// --- IPC Handlers ---

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
    const pluginDir = app.isPackaged ? path.join(process.resourcesPath, 'plugins') : './plugins';
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
        const metadata = await getVideoMetadata(videoPath); // Use imported getVideoMetadata
        // The playbackMimeType logic here is less critical now, as we'll transcode for playback.
        // However, it's good to keep if you ever want to attempt native playback for other formats.
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

ipcMain.handle('transcode-for-playback', async (event, originalVideoPath) => {
    const outputFileName = `playback_temp_${Date.now()}.mp4`;
    const outputPath = path.join(tempVideoDir, outputFileName); // tempVideoDir is now defined

    try {
        // Call the transcoding function from ffmpegHelper
        await ffmpegHelper.transcodeVideo(originalVideoPath, outputPath, (progress) => {
            // Optional: send progress back to renderer for UI updates
            event.sender.send('transcode-playback-progress', { percent: progress.percent });
        });
        return { success: true, tempFilePath: outputPath };
    } catch (error) {
        console.error('Error transcoding for playback:', error);
        return { success: false, error: error.message };
    }
});


// Modified process-video handler to integrate clipping and OpenPose
ipcMain.handle('process-video', async (event, { filePath, startTime, endTime }) => {
    const webContents = event.sender; // Get reference to the sending renderer

    try {
        console.log(`[Main Process] Starting video processing for: ${filePath}`);
        webContents.send('video-processing-status', { type: 'start', message: 'Starting video processing...' });

        // 1. Orchestrate video clipping via videoService.processVideoForOpenPose
        webContents.send('video-processing-status', { type: 'clipping', message: 'Clipping video...' });
        console.log(`[Main Process] Calling videoService.processVideoForOpenPose for clipping.`);
        
        // This will now clip the video and return the path to the clipped file
        const { outputPath: clippedVideoOutputPath } = await processVideoForOpenPose({ filePath, startTime, endTime }, (progress) => {
            webContents.send('video-processing-status', { type: 'clipping-progress', message: `Clipping: ${progress.percent.toFixed(1)}%`, progress });
        });
        
        console.log(`[Main Process] Video clipped to: ${clippedVideoOutputPath}`);
        webContents.send('video-processing-status', { type: 'clipped', message: 'Video clipped successfully!' });

        // 2. Run OpenPose on the clipped video
        webContents.send('video-processing-status', { type: 'openpose-start', message: 'Starting OpenPose...' });
        
        // Determine the OpenPose binary path robustly for both development and packaged app
        // The `openpose_binaries` directory should contain `bin`, `models`, etc.
        const openposeBaseDir = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'openpose_binaries') // This is the base directory passed to OpenPoseWrapper
            : path.join(__dirname, 'openpose_binaries'); // Assuming openpose_binaries is at the same level as main.js

        const openPose = new OpenPoseWrapper({
            openposePath: openposeBaseDir, // Pass the base directory
            outputDir: path.join(getUserDataPath(), 'openpose_output_keypoints'), // Output keypoints to user data dir
        });

        // --- IMPORTANT: Initialize OpenPoseWrapper here ---
        webContents.send('openpose-status', { type: 'initializing', message: 'Initializing OpenPose...' });
        await openPose.initialize(); // Call initialize method
        webContents.send('openpose-status', { type: 'initialized', data: { gpu: openPose.config.gpuMode, gpuInfo: openPose.gpuInfo } });

        // Set up listeners for OpenPose events and forward them to the renderer
        openPose.on('progress', ({ type, data }) => {
            webContents.send('openpose-status', { type: 'progress', data });
        });
        openPose.on('complete', ({ code }) => {
            webContents.send('openpose-status', { type: 'complete', data: { code } });
        });
        openPose.on('error', (error) => {
            webContents.send('openpose-status', { type: 'error', data: error.message || 'Unknown OpenPose Error' });
            console.error('[Main Process] OpenPose Error:', error);
        });

        console.log(`[Main Process] Calling OpenPose on: ${clippedVideoOutputPath}`);
        await openPose.runOpenPose(clippedVideoOutputPath, {
            display: false,
            renderPose: false,
            // Additional OpenPose options if needed
        });

        // 3. Clean up temporary clipped video
        try {
            // Note: processVideoForOpenPose in videoService.js creates the clipped file.
            // It's main.js's responsibility to clean it up after OpenPose uses it.
            await fs.unlink(clippedVideoOutputPath);
            console.log(`[Main Process] Cleaned up temporary clipped video: ${clippedVideoOutputPath}`);
        } catch (cleanupError) {
            console.warn(`[Main Process] Failed to clean up temporary clipped video: ${cleanupError.message}`);
        }

        webContents.send('video-processing-status', { type: 'complete', message: 'Video processing and OpenPose complete!' });
        console.log('[Main Process] Video processing and OpenPose completed successfully.');
        return { success: true, message: 'Video processed and OpenPose run.' };

    } catch (error) {
        const errorMessage = `Video processing failed: ${error.message}`;
        console.error('[Main Process] Video processing error:', error);
        webContents.send('video-processing-status', { type: 'error', message: errorMessage, error: error.message });
        throw new Error(errorMessage);
    }
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
        return data.buffer; // Return ArrayBuffer for Blob creation in renderer
    } catch (error) {
        console.error('Failed to read local file:', error);
        throw new Error('Failed to read local file: ' + error.message);
    }
});