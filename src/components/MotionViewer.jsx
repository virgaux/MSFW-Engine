import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

export default function MotionViewer({ keypoints }) {
  const mountRef = useRef();

  useEffect(() => {
    if (!keypoints) return;

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
    const jointsRef = {};

    for (const joint of DAZ_SKELETON) {
      const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
      scene.add(mesh);
      jointsRef[joint.name] = mesh;
    }

    // Bones (lines)
    const boneMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const linesRef = [];

    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geometry, boneMaterial);
      scene.add(line);
      linesRef.push(line);
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
  }, [keypoints]);

  return <div ref={mountRef} />;
}
