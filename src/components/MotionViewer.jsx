import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

// DAZ model skeleton
const DAZ_SKELETON = [
  { name: 'head', index: 0 },
  { name: 'neck', index: 1 },
  { name: 'leftShoulder', index: 5 },
  { name: 'leftElbow', index: 6 },
  { name: 'leftWrist', index: 7 },
  { name: 'rightShoulder', index: 2 },
  { name: 'rightElbow', index: 3 },
  { name: 'rightWrist', index: 4 },
  { name: 'pelvis', index: 8 },
  { name: 'leftHip', index: 12 },
  { name: 'leftKnee', index: 13 },
  { name: 'leftAnkle', index: 14 },
  { name: 'rightHip', index: 9 },
  { name: 'rightKnee', index: 10 },
  { name: 'rightAnkle', index: 11 },
];

// Bone connections
const DAZ_CONNECTIONS = [
  ['pelvis', 'abdomen'],
  ['abdomen', 'chest'],
  ['chest', 'neck'],
  ['neck', 'head'],
  ['chest', 'leftShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['chest', 'rightShoulder'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['pelvis', 'leftHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['pelvis', 'rightHip'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
];

export default function MotionViewer({ keypoints, modelPath }) {
  const mountRef = useRef();

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    mountRef.current.appendChild(renderer.domElement);

    camera.position.z = 500;
    scene.background = new THREE.Color('#111');

    // Load DAZ FBX model
    const loader = new FBXLoader();
    loader.load(modelPath, (object) => {
      scene.add(object);  // Add the model to the scene
    });

    // Joints
    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const jointGeometry = new THREE.SphereGeometry(5, 8, 8);
    const jointsRef = {};

    // Create meshes for each joint in the skeleton
    for (const joint of DAZ_SKELETON) {
      const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
      scene.add(mesh);
      jointsRef[joint.name] = mesh;
    }

    // Bones (lines)
    const boneMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const linesRef = [];

    // Draw lines for bones between joints
    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geometry, boneMaterial);
      scene.add(line);
      linesRef.push(line);
    }

    // Update the keypoints and the positions of the joints
    useEffect(() => {
      if (!keypoints) return;

      // Map keypoints to joint positions
      for (const joint of DAZ_SKELETON) {
        const jointIndex = joint.index * 3;  // keypoints are in triplets (x, y, confidence)
        const x = keypoints[jointIndex];
        const y = keypoints[jointIndex + 1];
        const z = 0;  // If 3D data is available, use it, else set z to 0

        // Update the position of the joint mesh
        if (jointsRef[joint.name]) {
          jointsRef[joint.name].position.set(x, y, z);
        }
      }

      // Update bone lines
      for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
        const [parent, child] = DAZ_CONNECTIONS[i];
        if (jointsRef[parent] && jointsRef[child]) {
          const geometry = linesRef[i].geometry;
          geometry.setFromPoints([jointsRef[parent].position, jointsRef[child].position]);
        }
      }
    }, [keypoints]);  // Re-run the effect when keypoints change

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      mountRef.current.removeChild(renderer.domElement);
    };
  }, [modelPath, keypoints]);  // Re-run the effect when modelPath or keypoints change

  return <div ref={mountRef} />;
}
