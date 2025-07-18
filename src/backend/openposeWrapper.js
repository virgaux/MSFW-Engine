const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const OPENPOSE_DIR = path.resolve(__dirname, '../../bin/openpose-1.7.0-binaries-win64-gpu');
const OUTPUT_DIR = path.resolve(__dirname, '../../output/keypoints');
const VIDEO_INPUT = path.resolve(__dirname, '../../input/video.mp4'); // Or null for webcam

function runOpenPose(useWebcam = false) {
  const args = [
    '--model_pose', 'BODY_25',
    '--write_json', OUTPUT_DIR,
    '--display', '0',
    '--render_pose', '0'
  ];

  if (useWebcam) {
    args.push('--camera', '0'); // webcam
  } else {
    args.push('--video', VIDEO_INPUT);
  }

  // Path to the OpenPose executable
  const exePath = path.join(OPENPOSE_DIR, 'bin', 'OpenPoseDemo.exe');

  console.log(`[OpenPose] Launching: ${exePath}`);
  const subprocess = spawn(exePath, args, { cwd: OPENPOSE_DIR });

  subprocess.stdout.on('data', (data) => {
    console.log(`[OpenPose] ${data}`);
  });

  subprocess.stderr.on('data', (data) => {
    console.error(`[OpenPose ERROR] ${data}`);
  });

  subprocess.on('close', (code) => {
    console.log(`[OpenPose] Process exited with code ${code}`);
  });

  return subprocess;
}

module.exports = { runOpenPose };
