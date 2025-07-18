const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../../output/bounce-tags.json');

function saveBounceConfig(jsonConfig, outputFile = CONFIG_PATH) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, jsonConfig, 'utf-8');
  console.log('✅ Bounce config saved to', outputFile);
}

function loadBounceConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Failed to load bounce config:', err.message);
    return null;
  }
}

module.exports = {
  saveBounceConfig,
  loadBounceConfig
};
