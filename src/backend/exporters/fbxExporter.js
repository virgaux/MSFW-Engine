const fs = require('fs');
const { FBXExporter } = require('three/examples/jsm/exporters/FBXExporter.js');
const { Scene, Object3D, Matrix4 } = require('three');

// Function to export animation data to FBX file
function exportFBXToFile(frameData, outputPath) {
  const scene = new Scene();

  // Create animated skeleton (replace with actual skeleton or mesh data)
  const skeleton = new Object3D();
  skeleton.name = "Armature";
  scene.add(skeleton);

  // Process the frame data to apply transformations (e.g., position, rotation)
  frameData.forEach((frame, index) => {
    const object = new Object3D(); // Create a new object for each frame
    object.name = `Object_${index}`;

    // Apply position, rotation, and other transformations based on frame data
    object.position.set(frame.position.x, frame.position.y, frame.position.z);
    object.rotation.set(frame.rotation.x, frame.rotation.y, frame.rotation.z);
    
    // Add object to the scene
    skeleton.add(object);
  });

  // Initialize the FBX exporter
  const exporter = new FBXExporter();
  const fbxData = exporter.parse(scene);

  // Write the FBX data to the specified output path
  fs.writeFileSync(outputPath, fbxData);
  console.log('FBX Exported successfully to', outputPath);
}

module.exports = { exportFBXToFile };
