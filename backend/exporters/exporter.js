const { Scene, Object3D } = require('three');
const { GLTFExporter } = require('three-stdlib');
const fs = require('fs');
const path = require('path');

// Constants for BVH export
const JOINTS = [
    "Hips", "Spine", "Chest", "Neck", "Head",
    "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
    "RightShoulder", "RightArm", "RightForeArm", "RightHand",
    "LeftUpLeg", "LeftLeg", "LeftFoot",
    "RightUpLeg", "RightLeg", "RightFoot"
];

function validateFrameData(frameData) {
    if (!Array.isArray(frameData) || frameData.length === 0) {
        throw new Error('Invalid frame data: Must be non-empty array');
    }
    return frameData;
}

function convertToBVH(frameData, fps = 30) {
    try {
        validateFrameData(frameData);
        const frameCount = frameData.length;

        const header = `HIERARCHY
ROOT Hips
{
    OFFSET 0.0 0.0 0.0
    CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
    ${JOINTS
        .filter(j => j !== "Hips")
        .map(joint => generateJointBVH(joint))
        .join("\n")}
}
MOTION
Frames: ${frameCount}
Frame Time: ${(1 / fps).toFixed(6)}
${generateFrameData(frameData)}`;

        return header;
    } catch (error) {
        throw new Error(`BVH conversion failed: ${error.message}`);
    }
}

function generateJointBVH(joint) {
    return `JOINT ${joint}
    {
        OFFSET 0.0 0.0 0.0
        CHANNELS 3 Zrotation Xrotation Yrotation
        End Site {
            OFFSET 0.0 0.0 0.0
        }
    }`;
}

function generateFrameData(frameData) {
    return frameData
        .map(frame => {
            // Ensure frame has required properties
            if (!frame.position || !frame.rotation) {
                throw new Error('Invalid frame data structure');
            }
            return `${frame.position.x} ${frame.position.y} ${frame.position.z} ${frame.rotation.x} ${frame.rotation.y} ${frame.rotation.z}`;
        })
        .join("\n");
}

async function exportMotionData(frameData, outputPath, format = 'glTF') {
    try {
        validateFrameData(frameData);
        
        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (format.toLowerCase() === 'gltf') {
            await exportGLTF(frameData, outputPath);
        } else if (format.toLowerCase() === 'bvh') {
            exportBVHToFile(frameData, outputPath);
        } else {
            throw new Error(`Unsupported format: ${format}`);
        }
        
        console.log(`Export successful: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Export failed: ${error.message}`);
        throw error;
    }
}

function exportBVHToFile(frameData, outputPath, fps = 30) {
    try {
        const bvhData = convertToBVH(frameData, fps);
        fs.writeFileSync(outputPath, bvhData, "utf-8");
    } catch (error) {
        throw new Error(`BVH export failed: ${error.message}`);
    }
}

async function exportGLTF(frameData, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const scene = new Scene();
            const skeleton = new Object3D();
            skeleton.name = "Armature";
            scene.add(skeleton);

            frameData.forEach((frame, index) => {
                const object = new Object3D();
                object.name = `Object_${index}`;
                object.position.set(
                    frame.position.x || 0,
                    frame.position.y || 0,
                    frame.position.z || 0
                );
                skeleton.add(object);
            });

            const exporter = new GLTFExporter();
                exporter.parse(
                    scene,
                    (result) => {
                        if (Buffer.isBuffer(result) || result instanceof ArrayBuffer) {
                            // For .glb binary export
                            fs.writeFileSync(outputPath, Buffer.from(result));
                        } else {
                            // For .gltf JSON export
                            const output = JSON.stringify(result, null, 2);
                            fs.writeFileSync(outputPath, output);
                        }
                        resolve();
                    },
                    (error) => {
                        reject(new Error(`GLTF export failed: ${error}`));
                    },
                    {
                        binary: true, // if you want .glb, keep this true; for .gltf (JSON), set to false
                        forceIndices: true
                    }
                );

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    exportMotionData,
    exportBVHToFile,
    convertToBVH
};