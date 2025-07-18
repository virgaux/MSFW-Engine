import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 🧠 Map OpenPose BODY_25 indexes to DAZ-style bones
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
  // Extended virtual bones
  { name: 'chest', index: 1 },     // inferred from neck/shoulders
  { name: 'abdomen', index: 8 },   // inferred from pelvis/mid-spine
];

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

function MotionViewer({ data }) {
  const mountRef = useRef();
  const jointsRef = useRef({});
  const linesRef = useRef([]);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    mountRef.current.appendChild(renderer.domElement);

    camera.position.z = 500;
    scene.background = new THREE.Color('#111');

    // Joints
    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const jointGeometry = new THREE.SphereGeometry(5, 8, 8);

    for (const joint of DAZ_SKELETON) {
      const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
      scene.add(mesh);
      jointsRef.current[joint.name] = mesh;
    }

    // Bones (lines)
    const boneMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(), new THREE.Vector3()
      ]);
      const line = new THREE.Line(geometry, boneMaterial);
      scene.add(line);
      linesRef.current.push(line);
    }

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!data || !Array.isArray(data)) return;

    // Convert OpenPose BODY_25 to joint positions
    const jointPositions = {};

    for (const bone of DAZ_SKELETON) {
      const idx = bone.index;
      const x = data[idx * 3];
      const y = data[idx * 3 + 1];
      const c = data[idx * 3 + 2];

      if (c > 0.1) {
        jointPositions[bone.name] = new THREE.Vector3(x - 320, -y + 240, 0);
      } else {
        jointPositions[bone.name] = null;
      }
    }

    // Update joints
    for (const [name, pos] of Object.entries(jointPositions)) {
      const joint = jointsRef.current[name];
      if (joint) {
        joint.visible = !!pos;
        if (pos) joint.position.copy(pos);
      }
    }

    // Update bones
    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const [a, b] = DAZ_CONNECTIONS[i];
      const posA = jointPositions[a];
      const posB = jointPositions[b];
      const line = linesRef.current[i];

      if (posA && posB) {
        const positions = line.geometry.attributes.position.array;
        positions[0] = posA.x;
        positions[1] = posA.y;
        positions[2] = posA.z;

        positions[3] = posB.x;
        positions[4] = posB.y;
        positions[5] = posB.z;

        line.geometry.attributes.position.needsUpdate = true;
        line.visible = true;
      } else {
        line.visible = false;
      }
    }
  }, [data]);

  return <div ref={mountRef} />;
}

export default MotionViewer;
