const { ipcMain, app, BrowserWindow,dialog } = require('electron');
const { runOpenPose } = require('./backend/openposeWrapper');
const { watchKeypoints } = require('./backend/poseDataWatcher');
const { loadBounceConfig } = require('./backend/helpers/bounceTagger');
const { exportMotionData } = require('./backend/exporters/exporter');  // New consolidated exporter

const fs = require('fs');
const path = require('path');


function createWindow () {
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

// Detect if we're in development (npm start) or production (installer/offline)

const settingsPath = path.join(app.getPath('userData'), 'msfw_settings.json');

// Settings helpers
function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch (e) {
    return {};
  }
}
function setSettings(newSettings) {
  fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
}

app.whenReady().then(() => {
  createWindow();

  watchKeypoints((keypoints, filename) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('pose-data', { keypoints, filename });
    }

    // ✅ Save frame data to fallback file
    const playbackPath = path.join(__dirname, 'playback.json');
    try {
      fs.writeFileSync(playbackPath, JSON.stringify(keypoints, null, 2), 'utf-8');
      console.log(`[MSFW] Auto-saved ${keypoints.length} frames to playback.json`);
    } catch (err) {
      console.error("[MSFW] Failed to write playback.json:", err.message);
    }
  });

});


app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});


ipcMain.handle('export-motion', async (event, config) => {
  const exportDir = path.join(__dirname, 'output', 'exports');
  fs.mkdirSync(exportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(exportDir, `${config.filename}_${timestamp}.${config.format}`);

  // ✅ Fallback loader
  let frameData = config.frames;
  if (!Array.isArray(frameData) || frameData.length === 0) {
    try {
      const fallbackPath = path.join(__dirname, 'playback.json');
      frameData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      console.warn("[MSFW] Using fallback playback.json for export.");
    } catch (err) {
      console.error("[MSFW] No valid frame data found for export.");
      return false;
    }
  }

  // ✅ Use the new consolidated exporter function
  exportMotionData(frameData, outputPath, config.format);

  // ✅ Optional: Open output folder after export
  require('child_process').exec(`start "" "${exportDir}"`);

  return true;
});

ipcMain.handle('load-plugins', async () => {
  const pluginDir = './plugins';
  const results = [];

  fs.mkdirSync(pluginDir, { recursive: true });
  const pluginFiles = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));

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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[MSFW] Playback saved manually.');
    return true;
  } catch (err) {
    console.error('[MSFW] Error saving playback:', err);
    return false;
  }
});

ipcMain.handle('check-file', async (event, filePath) => {
  // You can use fs.existsSync or similar
  const fs = require('fs');
  return fs.existsSync(filePath);
});

ipcMain.handle('load-pose-sequence', async () => {
  const fs = require('fs');
  const path = require('path');
  const playbackPath = path.join(__dirname, 'playback.json');
  try {
    const data = fs.readFileSync(playbackPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
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

// Save DAZ model path to settings
ipcMain.handle('save-model-path', async (event, filePath) => {
  const settings = getSettings();
  settings.modelPath = filePath;
  setSettings(settings);
  return true;
});

// Load saved DAZ model path
ipcMain.handle('load-saved-model-path', async () => {
  const settings = getSettings();
  return settings.modelPath || null;
});

ipcMain.handle('read-model-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  } catch (e) {
    return null;
  }
});