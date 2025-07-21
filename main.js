console.log("------------------- Main.js VERSION 5.0 LOADING -------------------");
const { ipcMain, app, BrowserWindow, dialog } = require('electron');
const { runOpenPose } = require('./backend/openposeWrapper');
const { watchKeypoints } = require('./backend/poseDataWatcher');
const { loadBounceConfig } = require('./backend/helpers/bounceTagger');
const { exportMotionData } = require('./backend/exporters/exporter');  // New consolidated exporter

const fs = require('fs/promises'); // Correctly using fs/promises
const path = require('path');

// --- Helper Functions - Defined ONCE at the top level ---
function getUserDataPath() {
    return app.getPath('userData');
}

// Helper function for checking file existence asynchronously
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
const settingsPath = path.join(getUserDataPath(), 'msfw_settings.json'); // Use getUserDataPath here

// Settings helpers - NOW ASYNC
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


function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    const isDev = !app.isPackaged; // true in dev, false when built
    if (isDev) {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, 'build', 'index.html'));
    }
}


app.whenReady().then(() => {
    createWindow();

    // The callback for watchKeypoints must be async if it contains awaits
    watchKeypoints(async (keypoints, filename) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.send('pose-data', { keypoints, filename });
        }

        const playbackPath = path.join(__dirname, 'playback.json');
        try {
            await fs.writeFile(playbackPath, JSON.stringify(keypoints, null, 2), 'utf-8');
            console.log(`[MSFW] Auto-saved ${keypoints.length} frames to playback.json`);
        } catch (err) {
            console.error("[MSFW] Failed to write playback.json:", err.message);
        }
    });

});


app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});


// --- IPC Handlers - Ensure each 'handle' is defined only ONCE ---

ipcMain.handle('export-motion', async (event, config) => {
    const exportDir = path.join(__dirname, 'output', 'exports');
    await fs.mkdir(exportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(exportDir, `${config.filename}_${timestamp}.${config.format}`);

    let frameData = config.frames;
    if (!Array.isArray(frameData) || frameData.length === 0) {
        try {
            const fallbackPath = path.join(__dirname, 'playback.json');
            frameData = JSON.parse(await fs.readFile(fallbackPath, 'utf-8'));
            console.warn("[MSFW] Using fallback playback.json for export.");
        } catch (err) {
            console.error("[MSFW] No valid frame data found for export:", err.message);
            return false;
        }
    }

    exportMotionData(frameData, outputPath, config.format);

    require('child_process').exec(`start "" "${exportDir}"`);

    return true;
});

ipcMain.handle('load-plugins', async () => {
    const pluginDir = './plugins';
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
    const useWebcam = mode === 'webcam';
    runOpenPose(useWebcam);
    return true;
});

ipcMain.handle('save-playback', async (event, data) => {
    const filePath = path.join(__dirname, 'playback.json');
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
    try {
        await fs.access(filePath, fs.constants.F_OK); // Check if file exists
        console.log(`[Main Process - check-file] File exists: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`[Main Process - check-file] File check failed for ${filePath}: ${error.message} (Code: ${error.code})`);
        return false;
    }
});

ipcMain.handle('load-pose-sequence', async () => {
    const playbackPath = path.join(__dirname, 'playback.json');
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


// Save DAZ model path to config.json settings (Using getUserDataPath)
ipcMain.handle('save-model-path', async (event, modelPath) => {
    try {
        const configPath = path.join(getUserDataPath(), 'config.json'); // Correctly calls the helper
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

// Load saved DAZ model path from config.json settings (Using getUserDataPath)
ipcMain.handle('load-saved-model-path', async (event) => {
    try {
        const configPath = path.join(getUserDataPath(), 'config.json'); // Correctly calls the helper
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

ipcMain.handle('process-video', async (event, filePath, progressCallback) => {
    try {
        console.log('Processing video:', filePath);

        const totalFrames = 100;
        for (let i = 0; i <= totalFrames; i++) {
            const progress = (i / totalFrames) * 100;
            if (progressCallback) {
                // In a real scenario, you'd send progress back to renderer here
                // event.sender.send('video-progress', progress);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const frames = Array.from({ length: totalFrames }, (_, index) => ({ frameIndex: index, data: `frame_${index}` }));
        return frames;

    } catch (error) {
        console.error('Error processing video:', error);
        return { error: error.message };
    }
});