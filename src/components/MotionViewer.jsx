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
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const jointsRef = useRef({});
  const linesRef = useRef([]);

  // Scene setup (runs once on mount or modelPath change)
  useEffect(() => {
    // Clean up before recreating
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }

    // SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 500;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 🚩 NEW: Load the model from base64 if path is set
    if (modelPath) {
      const base64 = window.api.readModelFile(modelPath);
      if (base64) {
        // Convert base64 to binary
        const binaryStr = atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

        // Make a Blob and Object URL for the FBXLoader
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const loader = new FBXLoader();
        loader.load(url, (object) => {
          scene.add(object);
          URL.revokeObjectURL(url); // clean up after load
        }, undefined, (err) => {
          console.error("Failed to load FBX model:", err);
        });
      }
    }

    // JOINTS
    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const jointGeometry = new THREE.SphereGeometry(5, 8, 8);
    jointsRef.current = {};
    for (const joint of DAZ_SKELETON) {
      const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
      scene.add(mesh);
      jointsRef.current[joint.name] = mesh;
    }

    // BONES (lines)
    const boneMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    linesRef.current = [];
    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geometry, boneMaterial);
      scene.add(line);
      linesRef.current.push(line);
    }

    // Animate
    const animate = () => {
        renderer.render(scene, camera);
        renderer._animationId = requestAnimationFrame(animate);
      };
      animate();
      return () => {
        try {
          if (rendererRef.current && rendererRef.current._animationId) {
            cancelAnimationFrame(rendererRef.current._animationId);
          }
          if (rendererRef.current && rendererRef.current.dispose) {
            rendererRef.current.dispose();
          }
          // Defensive: Only remove if it is actually a child!
          if (
            mountRef.current &&
            rendererRef.current &&
            rendererRef.current.domElement &&
            rendererRef.current.domElement.parentNode === mountRef.current
          ) {
            mountRef.current.removeChild(rendererRef.current.domElement);
          }
          // Clean up refs so next effect has a clean slate
          rendererRef.current = null;
          sceneRef.current = null;
          cameraRef.current = null;
          jointsRef.current = {};
          linesRef.current = [];
        } catch (err) {
          // ignore, for dev safety
        }
      };



    }, [modelPath]);

  // Keypoints update
  useEffect(() => {
    if (!keypoints) return;
    const joints = jointsRef.current;
    const lines = linesRef.current;

    // Map keypoints to joint positions
    for (const joint of DAZ_SKELETON) {
      const jointIndex = joint.index * 3;
      const x = keypoints[jointIndex];
      const y = keypoints[jointIndex + 1];
      const z = 0;
      if (joints[joint.name]) {
        joints[joint.name].position.set(x, y, z);
      }
    }
    // Update bone lines
    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const [parent, child] = DAZ_CONNECTIONS[i];
      if (joints[parent] && joints[child]) {
        const geometry = lines[i].geometry;
        geometry.setFromPoints([joints[parent].position, joints[child].position]);
      }
    }
  }, [keypoints]); // Only when keypoints change

  

  return <div ref={mountRef} />;
}
