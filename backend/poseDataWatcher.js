// src/backend/poseDataWatcher.js
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../output/keypoints');

function watchKeypoints(onKeypointsParsed) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[Watcher] Watching folder: ${OUTPUT_DIR}`);

  let lastProcessedFile = '';

  fs.watch(OUTPUT_DIR, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.json')) return;

    const filePath = path.join(OUTPUT_DIR, filename);
    if (filePath === lastProcessedFile) return;

    lastProcessedFile = filePath;

    // Delay a bit to make sure file is fully written
    setTimeout(() => {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);

        if (parsed.length > 0 && parsed[0].pose_keypoints_2d) {
          onKeypointsParsed(parsed[0].pose_keypoints_2d, filename);
        }
      } catch (err) {
        console.warn(`[Watcher] Failed to parse ${filename}:`, err.message);
      }
    }, 100);
  });
}

module.exports = { watchKeypoints };
