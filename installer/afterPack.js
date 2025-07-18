const { exec } = require('child_process');
const path = require('path');

module.exports = async function(context) {
  const batPath = path.join(__dirname, 'start-installer.bat');

  return new Promise((resolve, reject) => {
    exec(`"${batPath}"`, { shell: true }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[afterPack ERROR]: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.warn(`[afterPack STDERR]: ${stderr}`);
      }
      console.log(`[afterPack STDOUT]: ${stdout}`);
      resolve();
    });
  });
};
