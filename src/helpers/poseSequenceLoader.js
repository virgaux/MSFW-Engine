const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../output/keypoints');

function getFrameFilesSorted() {
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(name => name.endsWith('.json'))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const bNum = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return aNum - bNum;
    });

  return files;
}

function loadPoseSequence() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];

  const frameFiles = getFrameFilesSorted();
  const sequence = [];

  for (const file of frameFiles) {
    const fullPath = path.join(OUTPUT_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed[0]?.pose_keypoints_2d) {
        sequence.push({
          frame: file,
          keypoints: parsed[0].pose_keypoints_2d
        });
      }
    } catch (err) {
      console.warn(`[poseSequenceLoader] Failed to load ${file}:`, err.message);
    }
  }

  return sequence;
}

module.exports = {
  loadPoseSequence
};
