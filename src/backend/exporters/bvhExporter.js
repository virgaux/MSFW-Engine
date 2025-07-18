// /src/backend/exporters/bvhExporter.js
const fs = require("fs");

function computeEulerFromDelta(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];

  // Simplified angle estimation
  const Z = Math.atan2(dy, dx) * (180 / Math.PI);
  const X = Math.atan2(dz, dy) * (180 / Math.PI);
  const Y = Math.atan2(dx, dz) * (180 / Math.PI);

  return [Z.toFixed(2), X.toFixed(2), Y.toFixed(2)];
}


function convertToBVH(frameData, fps = 30) {
  const joints = Object.keys(frameData[0]); // e.g., { jointName: [x, y, z], ... }
  const frameCount = frameData.length;
  const jointMap = {
  Hips: null,
  Spine: 'Hips',
  Chest: 'Spine',
  Neck: 'Chest',
  Head: 'Neck',
  LeftShoulder: 'Chest',
  LeftElbow: 'LeftShoulder',
  LeftWrist: 'LeftElbow',
  RightShoulder: 'Chest',
  RightElbow: 'RightShoulder',
  RightWrist: 'RightElbow',
  LeftHip: 'Hips',
  LeftKnee: 'LeftHip',
  LeftAnkle: 'LeftKnee',
  RightHip: 'Hips',
  RightKnee: 'RightHip',
  RightAnkle: 'RightKnee'
};


  const header = `HIERARCHY
ROOT Hips
{
  OFFSET 0.0 0.0 0.0
  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
${joints
  .filter(j => j !== "Hips")
  .map(
    (joint) => `  JOINT ${joint}
  {
    OFFSET 0.0 0.0 0.0
    CHANNELS 3 Zrotation Xrotation Yrotation
    End Site {
      OFFSET 0.0 0.0 0.0
    }
  }`
  )
  .join("\n")}
}
MOTION
Frames: ${frameCount}
Frame Time: ${(1 / fps).toFixed(6)}
${frameData
  .map((frame) => {
    const root = frame["Hips"] || [0, 0, 0];
    const rotations = joints.map(j => {
      const parent = jointMap[j];
      if (!parent || !frame[parent] || !frame[j]) return "0 0 0";

      const euler = computeEulerFromDelta(frame[parent], frame[j]);
      return euler.join(" ");
    }).join(" ");
    return `${root.join(" ")} ${rotations}`;
  })
  .join("\n")}
`;

  return header;
}

function exportBVHToFile(frameData, outputPath, fps = 30) {
  const bvhData = convertToBVH(frameData, fps);
  fs.writeFileSync(outputPath, bvhData, "utf-8");
}

module.exports = { exportBVHToFile };
