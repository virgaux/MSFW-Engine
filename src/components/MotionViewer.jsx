// MotionViewer.jsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// DAZ model skeleton - assuming this maps to your keypoint data
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
  ['pelvis', 'neck'],
  ['neck', 'head'],
  ['neck', 'leftShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['neck', 'rightShoulder'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['pelvis', 'leftHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['pelvis', 'rightHip'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
];

// Define the uniform gray material once
const grayMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc, // A light gray color
    metalness: 0.1,
    roughness: 0.8,
});

// --- REFINED isBodyMesh function ---
// This function attempts to identify main body parts that should generally NOT be toggled off.
// It relies on common naming conventions in DAZ Studio exports.
const isBodyMesh = (meshName) => {
    const lowerName = meshName.toLowerCase();
    // Common body names (Genesis X Female/Male)
    if (lowerName.includes('genesis') && (lowerName.includes('female') || lowerName.includes('male')) && !lowerName.includes('clothing')) {
        return true;
    }
    // Eyelashes, tear lines, and other always-on facial features
    if (lowerName.includes('eyelash') || lowerName.includes('tear') || lowerName.includes('cornea') || lowerName.includes('sclera') || lowerName.includes('pupil') || lowerName.includes('iris')) {
        return true;
    }
    // Specific control meshes that are part of the base figure (e.g., anatomical elements)
    if (lowerName.includes('pussy_controls') || lowerName.includes('shell') || lowerName.includes('genitalia')) { // Added AP_ShellShape based on your previous logs
        return true;
    }
    return false;
};


// Added onClothingMeshesLoaded prop
export default function MotionViewer({ keypoints, modelPath, onError, displayMode, clothingVisibility = {}, onClothingMeshesLoaded }) {
  const mountRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const jointsRef = useRef({});
  const linesRef = useRef([]);
  const fbxModelRef = useRef(null);
  const groundPlaneRef = useRef(null);
  const clothingMeshesRef = useRef({}); // New ref to store clothing meshes by name


  // Function to update model's materials, joint/line visibility, and individual clothing visibility
  const updateModelAppearance = (mode, model, joints, lines, currentClothingVisibility) => {
    if (!model) return;

    model.traverse(function (child) {
      if (child.isMesh) {
        // Apply display mode materials
        if (mode === 'skin') {
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        } else { // 'gray' or 'gray_with_bones'
          child.material = grayMaterial;
        }

        // Apply individual clothing visibility
        // If it's a body mesh, it's always visible (unless specifically chosen to hide it)
        if (isBodyMesh(child.name)) {
          child.visible = true;
        } else {
          // For clothing meshes, check the clothingVisibility map
          // If the name is not in the map, or explicitly false, hide it.
          // Otherwise, show it.
          const isVisible = currentClothingVisibility[child.name] !== false; // Default to true if not specified in map
          child.visible = isVisible;
        }
      }
    });

    const showBones = mode === 'gray_with_bones';
    for (const jointName in joints) {
      if (joints[jointName]) {
        joints[jointName].visible = showBones;
      }
    }
    lines.forEach(line => {
      line.visible = showBones;
    });
  };


  // Main Effect for Scene Setup and FBX Loading
  useEffect(() => {
    // --- Cleanup previous scene and renderer ---
    if (rendererRef.current) {
      if (rendererRef.current._animationId) {
        cancelAnimationFrame(rendererRef.current._animationId);
      }
      if (sceneRef.current) {
        sceneRef.current.traverse(object => {
          if (object.isMesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              object.material?.dispose();
            }
          }
        });
      }
      rendererRef.current.dispose();
      try {
        if (mountRef.current && rendererRef.current.domElement && mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      } catch (e) {
        console.warn("Error removing old renderer DOM element:", e);
      }
    }

    // Reset refs
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    jointsRef.current = {};
    linesRef.current = [];
    fbxModelRef.current = null;
    groundPlaneRef.current = null;
    clothingMeshesRef.current = {}; // Reset clothing meshes ref


    // --- Defensive: Don't initialize if no modelPath or Electron API ---
    if (!modelPath || !window.api || !window.api.readModelFile) {
      console.warn("Model path or Electron API not available. Showing blank canvas.");
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(400, 400);
      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);
      renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
      return;
    }

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080); // Lighter gray background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
    camera.position.set(0, 100, 300); // Tuned for a full body view
    cameraRef.current = camera;

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400); // Set canvas size
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // --- OrbitControls Setup ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.target.set(0, 90, 0); // Target slightly lower for better framing
    controls.update();
    controls.minDistance = 50;
    controls.maxDistance = 600;

    // --- Add Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(200, 300, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -250;
    directionalLight.shadow.camera.right = 250;
    directionalLight.shadow.camera.top = 250;
    directionalLight.shadow.camera.bottom = -250;
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-200, 150, -100);
    scene.add(directionalLight2);

    // --- Add Ground Plane ---
    const planeSize = 1000;
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x707070, side: THREE.DoubleSide });
    const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);
    groundPlaneRef.current = groundPlane;

    // --- FBX Model Loading ---
    (async () => {
      try {
        const base64 = await window.api.readModelFile(modelPath);
        if (base64) {
          const binaryStr = atob(base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);

          const loader = new FBXLoader();
          loader.load(url, (object) => {
            console.log("Loaded FBX Object:", object); // Debugging
            object.scale.set(1, 1, 1); // Set to 1,1,1 as you prefer
            object.position.y = 0;

            const loadedClothingMeshes = {}; // Temp store for actual mesh objects
            const detectedClothingMeshNames = []; // Temp store for names to send to App.jsx

            object.traverse(function (child) {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.originalMaterial = child.material; // Store original material

                // Store reference to clothing meshes
                if (!isBodyMesh(child.name)) {
                  loadedClothingMeshes[child.name] = child;
                  detectedClothingMeshNames.push(child.name);
                }
              }
            });

            scene.add(object);
            fbxModelRef.current = object;
            clothingMeshesRef.current = loadedClothingMeshes; // Store clothing meshes
            URL.revokeObjectURL(url);

            // Inform the parent component (App.jsx) about the detected clothing meshes
            if (onClothingMeshesLoaded) {
                onClothingMeshesLoaded(detectedClothingMeshNames);
            }

            // Apply initial display mode and clothing visibility after model is loaded
            updateModelAppearance(displayMode, fbxModelRef.current, jointsRef.current, linesRef.current, clothingVisibility);

          }, undefined, (err) => {
            console.error("Failed to load FBX model:", err);
            onError?.(new Error(`Failed to load 3D model: ${err.message || 'Unknown error'}`));
          });
        } else {
            console.warn("No base64 data received for model.");
            onError?.(new Error("No model data provided."));
        }
      } catch (err) {
        console.error("Error reading model file from Electron API:", err);
        onError?.(new Error(`Error accessing model file: ${err.message || 'Unknown error'}`));
      }
    })();

    // --- JOINTS (for visualizing keypoints) ---
    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const jointGeometry = new THREE.SphereGeometry(3, 8, 8);
    jointsRef.current = {};
    for (const joint of DAZ_SKELETON) {
      const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
      mesh.visible = false; // Initial visibility will be set by updateModelAppearance
      scene.add(mesh);
      jointsRef.current[joint.name] = mesh;
    }

    // --- BONES (lines connecting joints) ---
    const boneMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    linesRef.current = [];
    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geometry, boneMaterial);
      line.visible = false; // Initial visibility will be set by updateModelAppearance
      scene.add(line);
      linesRef.current.push(line);
    }

    // --- Animation Loop ---
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      renderer._animationId = requestAnimationFrame(animate);
    };
    animate();

    // --- Cleanup function for useEffect ---
    return () => {
      console.log("Cleaning up MotionViewer Three.js resources...");
      if (rendererRef.current && rendererRef.current._animationId) {
        cancelAnimationFrame(rendererRef.current._animationId);
      }
      if (controls) {
        controls.dispose();
      }
      if (rendererRef.current) {
        if (sceneRef.current) {
          sceneRef.current.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(m => m.dispose());
              } else {
                object.material.dispose();
              }
            }
          });
          while (sceneRef.current.children.length > 0) {
            sceneRef.current.remove(sceneRef.current.children[0]);
          }
        }
        rendererRef.current.dispose();
        try {
          if (mountRef.current && rendererRef.current.domElement && mountRef.current.contains(rendererRef.current.domElement)) {
            mountRef.current.removeChild(rendererRef.current.domElement);
          }
        } catch (e) {
          console.warn("Error during DOM element removal in cleanup:", e);
        }
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      jointsRef.current = {};
      linesRef.current = [];
      fbxModelRef.current = null;
      groundPlaneRef.current = null;
      clothingMeshesRef.current = {};
    };
  }, [modelPath, onError, onClothingMeshesLoaded]); // Added onClothingMeshesLoaded to dependency array

  // Effect to react to changes in displayMode or clothingVisibility prop
  useEffect(() => {
    if (fbxModelRef.current && jointsRef.current && linesRef.current) {
      updateModelAppearance(displayMode, fbxModelRef.current, jointsRef.current, linesRef.current, clothingVisibility);
    }
  }, [displayMode, fbxModelRef.current, clothingVisibility]);


  // --- Keypoints update (runs when keypoints prop changes) ---
  useEffect(() => {
    if (!keypoints || !sceneRef.current || Object.keys(jointsRef.current).length === 0) {
      return;
    }

    const joints = jointsRef.current;
    const lines = linesRef.current;
    const showBones = displayMode === 'gray_with_bones'; // Visibility depends on displayMode

    // Keypoint Scaling and Offset
    const keypointScaleX = 0.5;
    const keypointScaleY = 0.5;
    const offsetX = -100;
    const offsetY = 100;
    const offsetZ = 0;

    for (const joint of DAZ_SKELETON) {
      const jointIndex = joint.index * 3;
      const x = keypoints[jointIndex] * keypointScaleX + offsetX;
      const y = -(keypoints[jointIndex + 1] * keypointScaleY) + offsetY;
      const z = keypoints[jointIndex + 2] * keypointScaleX + offsetZ || 0;

      if (joints[joint.name]) {
        joints[joint.name].position.set(x, y, z);
        joints[joint.name].visible = showBones; // Update visibility here
      }
    }

    for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
      const [parentName, childName] = DAZ_CONNECTIONS[i];
      const parentJoint = joints[parentName];
      const childJoint = joints[childName];
      const line = lines[i];

      if (parentJoint && childJoint && line) {
        const positions = new Float32Array([
          parentJoint.position.x, parentJoint.position.y, parentJoint.position.z,
          childJoint.position.x, childJoint.position.y, childJoint.position.z
        ]);
        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        line.geometry.attributes.position.needsUpdate = true;
        line.visible = showBones; // Update visibility here
      } else {
        if (line) line.visible = false;
      }
    }
  }, [keypoints, DAZ_SKELETON, DAZ_CONNECTIONS, displayMode]);


  return (
    <div
      ref={mountRef}
      style={{
        width: '400px', // Adjust as needed, or use '100%' for responsive
        height: '400px', // Adjust as needed, or use '100%' for responsive
        border: '1px solid #333',
        backgroundColor: '#f0f0f0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    />
  );
}