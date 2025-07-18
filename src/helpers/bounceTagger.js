const fs = require('fs');
const path = require('path');

function saveBounceConfig(jsonConfig, outputFile = './output/bounce-tags.json') {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, jsonConfig, 'utf-8');
    console.log('Bounce config saved to', outputFile);
}

module.exports = { saveBounceConfig };