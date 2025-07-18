const { exec } = require("child_process");
const path = require("path");

exports.default = async function (context) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "start-installer.bat");

    exec(`"${scriptPath}"`, { windowsHide: true }, (error, stdout, stderr) => {
      console.log("[MSFW INSTALLER LOG]:", stdout);
      if (error) {
        console.error("[MSFW INSTALLER ERROR]:", stderr);
        return reject(error);
      }
      resolve();
    });
  });
};
