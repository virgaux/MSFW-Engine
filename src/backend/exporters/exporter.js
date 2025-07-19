const fs = require('fs');
const { GLTFExporter } = require('./assets/three/examples/jsm/exporters/GLTFExporter.js');
const { Scene, Object3D } = require('three');

// Euler Angle Calculation (Using Your Method)
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

// BVH Export Functionality
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
  console.log('BVH export successful:', outputPath);
}

// GLTF Export Functionality (new)
function exportMotionData(frameData, outputPath, format = 'glTF') {
  if (format === 'glTF') {
    // Create a Three.js scene
    const scene = new Scene();
    const skeleton = new Object3D();
    skeleton.name = "Armature";
    scene.add(skeleton);

    // Add each frame as an object in the scene
    frameData.forEach((frame, index) => {
      const object = new Object3D();
      object.name = `Object_${index}`;
      object.position.set(frame.position.x, frame.position.y, frame.position.z);
      skeleton.add(object);
    });

    // Export to GLTF format using GLTFExporter
    const exporter = new GLTFExporter();
    
    // Export as binary (GLB) or JSON (GLTF)
    exporter.parse(scene, function (result) {
      const output = JSON.stringify(result, null, 2);

      // Write the GLTF data to the output file (for GLTF or GLB)
      fs.writeFileSync(outputPath, output);
      console.log('GLTF export successful:', outputPath);
    }, {
      binary: true,  // If true, export as GLB (binary), false for GLTF (JSON)
      forceIndices: true
    });
  } else if (format === 'bvh') {
    // If exporting BVH, use the existing BVH logic
    exportBVHToFile(frameData, outputPath);
  } else {
    console.error('Unsupported export format:', format);
  }
}
module.exports = { exportMotionData, exportBVHToFile };
