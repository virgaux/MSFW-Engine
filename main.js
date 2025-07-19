
const { app, BrowserWindow } = require('electron');
const { runOpenPose } = require('./src/backend/openposeWrapper');
const { watchKeypoints } = require('./src/backend/poseDataWatcher');
const { loadBounceConfig } = require('./src/helpers/bounceTagger');
const { exportMotionData } = require('./src/backend/exporters/exporter');  // New consolidated exporter


const { ipcMain } = require('electron');
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

  win.loadURL('http://localhost:3000');
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
