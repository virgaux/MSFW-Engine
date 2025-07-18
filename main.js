
const { app, BrowserWindow } = require('electron');
const { runOpenPose } = require('./src/backend/openposeWrapper');
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

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});


const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

ipcMain.handle('export-motion', async (event, config) => {
  const exportDir = './output/exports';
  fs.mkdirSync(exportDir, { recursive: true });
  const filename = path.join(exportDir, `${config.filename}.${config.format}`);
  const template = `# Export preset: ${config.skeleton}\n# Simulated ${config.format} data`;

  fs.writeFileSync(filename, template, 'utf-8');
  return true;
});

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

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

const { runOpenPose } = require('./src/backend/openposeWrapper');

ipcMain.handle('start-openpose', async (event, mode) => {
  const useWebcam = mode === 'webcam';
  runOpenPose(useWebcam);
  return true;
});
