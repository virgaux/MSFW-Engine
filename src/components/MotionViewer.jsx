// MotionViewer.jsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// No need for explicit SkeletonHelper import if you're not using THREE.SkeletonHelper

const height = 800; // Set a fixed height for the viewer
const width = 1000; // Set a fixed width for the viewer

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
const isBodyMesh = (meshName) => {
    const lowerName = meshName.toLowerCase();
    if (lowerName.includes('genesis') && (lowerName.includes('female') || lowerName.includes('male')) && !lowerName.includes('clothing')) {
        return true;
    }
    if (lowerName.includes('eyelash') || lowerName.includes('tear') || lowerName.includes('cornea') || lowerName.includes('sclera') || lowerName.includes('pupil') || lowerName.includes('iris')) {
        return true;
    }
    if (lowerName.includes('pussy_controls') || lowerName.includes('shell') || lowerName.includes('genitalia')) {
        return true;
    }
    return false;
};

// Added onClothingMeshesLoaded prop
export default function MotionViewer({ keypoints, modelPath, onError, displayMode, clothingVisibility = {}, onClothingMeshesLoaded }) {
    console.log("MotionViewer: Current displayMode =", displayMode);
    console.log("MotionViewer: Keypoints received (length) =", keypoints?.length);

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
        console.log("updateModelAppearance: Called with mode =", mode);
        const showBones = mode === 'gray_with_bones'; // Define showBones here
        console.log("updateModelAppearance: showBones calculated as =", showBones);
        if (!model) {
            console.log("updateModelAppearance: Model is not yet loaded, skipping appearance update.");
            return;
        }

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
                if (isBodyMesh(child.name)) {
                    child.visible = true;
                } else {
                    const isVisible = currentClothingVisibility[child.name] !== false;
                    child.visible = isVisible;
                }
            }
        });

        for (const jointName in joints) {
            if (joints[jointName]) {
                joints[jointName].visible = showBones;
                // console.log(`Joint ${jointName} visibility set to: ${joints[jointName].visible}`); // Uncomment for detailed joint visibility logs
            }
        }
        lines.forEach(line => {
            line.visible = showBones;
            // console.log(`Line visibility set to: ${line.visible}`); // Uncomment for detailed line visibility logs
        });

        // Force a render after updating visibility/materials
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            console.log("updateModelAppearance: Forcing scene render.");
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    };

    // Main Effect for Scene Setup and FBX Loading
    useEffect(() => {
        // --- Cleanup previous scene and renderer ---
        if (rendererRef.current) {
            console.log("Cleanup: Disposing of previous renderer and resources.");
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
        clothingMeshesRef.current = {};

        // --- Defensive: Don't initialize if no modelPath or Electron API ---
        if (!modelPath || !window.api || !window.api.readModelFile) {
            console.warn("MotionViewer: Model path or Electron API not available. Showing blank canvas.");
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(width, height);
            rendererRef.current = renderer;
            if (mountRef.current) {
                mountRef.current.appendChild(renderer.domElement);
            }
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
        renderer.setSize(width, height); // Set canvas size
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;
        if (mountRef.current) {
            mountRef.current.appendChild(renderer.domElement);
        } else {
            console.error("Mount reference is null during renderer appendChild.");
            return; // Prevent further execution if mountRef is not ready
        }


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

        // --- JOINTS (for visualizing keypoints) ---
        // Increased radius for better visibility during debug
        const jointGeometry = new THREE.SphereGeometry(5, 16, 16); // Increased size and segments
        // Added depthTest: false for joints and lines
        const jointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, depthTest: false }); // Cyan color, renders on top
        jointsRef.current = {};
        for (const joint of DAZ_SKELETON) {
            const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
            mesh.visible = false; // Initial visibility set to false, will be managed by updateModelAppearance
            scene.add(mesh);
            jointsRef.current[joint.name] = mesh;
        }
        console.log("MotionViewer: jointsRef.current count =", Object.keys(jointsRef.current).length);


        // --- BONES (lines connecting joints) ---
        const boneMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 5, depthTest: false }); // Red color, thicker line, renders on top
        linesRef.current = [];
        for (let i = 0; i < DAZ_CONNECTIONS.length; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
            const line = new THREE.Line(geometry, boneMaterial);
            line.visible = false; // Initial visibility set to false, will be managed by updateModelAppearance
            scene.add(line);
            linesRef.current.push(line);
        }
        console.log("MotionViewer: linesRef.current count =", linesRef.current.length);


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
                    // Inside the main useEffect, specifically within the `loader.load` success callback:
                    loader.load(url, (object) => {
                        console.log("Loaded FBX Object:", object);
                        object.scale.set(1, 1, 1);
                        object.position.y = 0;

                        const loadedClothingMeshes = {};
                        const detectedClothingMeshNames = [];

                        object.traverse(function (child) {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                child.userData.originalMaterial = child.material;

                                if (!isBodyMesh(child.name)) {
                                    loadedClothingMeshes[child.name] = child;
                                    detectedClothingMeshNames.push(child.name);
                                }
                            }
                        });

                        scene.add(object);
                        fbxModelRef.current = object; // THIS IS WHERE FBX MODEL REF IS SET
                        clothingMeshesRef.current = loadedClothingMeshes;
                        URL.revokeObjectURL(url);

                        if (onClothingMeshesLoaded) {
                            onClothingMeshesLoaded(detectedClothingMeshNames);
                        }

                        // --- IMPORTANT LOGS HERE ---
                        console.log("FBX Load Success: fbxModelRef.current is now set:", !!fbxModelRef.current);
                        console.log("FBX Load Success: jointsRef.current count (before update call) =", Object.keys(jointsRef.current).length);
                        console.log("FBX Load Success: linesRef.current count (before update call) =", linesRef.current.length);

                        // Apply initial display mode and clothing visibility after model is loaded
                        updateModelAppearance(displayMode, fbxModelRef.current, jointsRef.current, linesRef.current, clothingVisibility);
                        console.log("Main useEffect: Called updateModelAppearance immediately after FBX load completion.");

                    }, undefined, (err) => {
                        console.error("Failed to load FBX model:", err);
                        onError?.(new Error(`Failed to load 3D model: ${err.message || 'Unknown error'}`));
                    });
                } else {
                    console.warn("MotionViewer: No base64 data received for model.");
                    onError?.(new Error("No model data provided."));
                }
            } catch (err) {
                console.error("MotionViewer: Error reading model file from Electron API:", err);
                onError?.(new Error(`Error accessing model file: ${err.message || 'Unknown error'}`));
            }
        })();

        // --- Animation Loop ---
        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            rendererRef.current._animationId = requestAnimationFrame(animate);
        };
        animate();

        // --- Cleanup function for useEffect ---
        return () => {
            console.log("Cleanup: Cleaning up MotionViewer Three.js resources...");
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
                    // Remove all children from the scene explicitly
                    while (sceneRef.current.children.length > 0) {
                        const object = sceneRef.current.children[0];
                        sceneRef.current.remove(object);
                        // Dispose of materials and geometries if they are not already disposed by traverse
                        if (object.geometry) object.geometry.dispose();
                        if (object.material) {
                            if (Array.isArray(object.material)) {
                                object.material.forEach(m => m.dispose());
                            } else {
                                object.material.dispose();
                            }
                        }
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
            // Clear all refs manually for robustness
            rendererRef.current = null;
            sceneRef.current = null;
            cameraRef.current = null;
            jointsRef.current = {};
            linesRef.current = [];
            fbxModelRef.current = null;
            groundPlaneRef.current = null;
            clothingMeshesRef.current = {};
        };
    }, [modelPath, onError, onClothingMeshesLoaded]); // Removed displayMode from deps of this specific useEffect to avoid re-running setup on mode change.

    // Effect to react to changes in displayMode or clothingVisibility prop
    // This effect should be responsible for updating appearance based on these props
    useEffect(() => {
        if (fbxModelRef.current && Object.keys(jointsRef.current).length > 0 && linesRef.current.length > 0) {
            console.log("Display/Clothing useEffect: Calling updateModelAppearance due to prop change.");
            updateModelAppearance(displayMode, fbxModelRef.current, jointsRef.current, linesRef.current, clothingVisibility);
        } else {
            console.log("Display/Clothing useEffect: Not ready to call updateModelAppearance yet (model/joints/lines not fully initialized).");
            console.log("   fbxModelRef.current:", !!fbxModelRef.current);
            console.log("   jointsRef.current.length:", Object.keys(jointsRef.current).length);
            console.log("   linesRef.current.length:", linesRef.current.length);
        }
    }, [displayMode, clothingVisibility, fbxModelRef.current, jointsRef.current, linesRef.current]);


    // --- Keypoints update (runs when keypoints prop changes) ---
    useEffect(() => {
        if (!keypoints || !sceneRef.current || Object.keys(jointsRef.current).length === 0) {
            console.log("Keypoints useEffect: Skipping update. Keypoints:", keypoints?.length, "Scene:", !!sceneRef.current, "Joints:", Object.keys(jointsRef.current).length);
            return;
        }
        console.log("Keypoints useEffect: Updating joint and line positions. First keypoint:", keypoints[0]);

        const joints = jointsRef.current;
        const lines = linesRef.current;
        // The visibility of joints and lines is now solely managed by updateModelAppearance
        // We only need to set positions here.

        // Keypoint Scaling and Offset
        // These values are highly dependent on your keypoint data's coordinate system
        // and the scale of your DAZ model. You might need to adjust these significantly.
        const keypointScaleX = 0.5;
        const keypointScaleY = 0.5;
        const offsetX = -100; // Adjust to center or position relative to your model
        const offsetY = 100; // Adjust for vertical alignment
        const offsetZ = 0; // Adjust for depth alignment

        for (const joint of DAZ_SKELETON) {
            const jointIndex = joint.index * 3;
            // Ensure keypoints array is long enough to prevent errors
            if (keypoints.length >= jointIndex + 3) {
                const x = keypoints[jointIndex] * keypointScaleX + offsetX;
                const y = -(keypoints[jointIndex + 1] * keypointScaleY) + offsetY; // Y-axis inversion is common
                const z = keypoints[jointIndex + 2] * keypointScaleX + offsetZ; // Assuming Z also scales with X

                if (joints[joint.name]) {
                    joints[joint.name].position.set(x, y, z);
                    // console.log(`Joint ${joint.name} position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`); // Uncomment for detailed position logs
                }
            } else {
                console.warn(`Keypoints data incomplete for joint ${joint.name} at index ${jointIndex}.`);
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
            } else {
                if (line) line.visible = false; // Hide if connection points are missing
            }
        }
        // No explicit renderer.render call here; the animation loop will handle it
    }, [keypoints, DAZ_SKELETON, DAZ_CONNECTIONS, jointsRef, linesRef]);


    return (
        <div
            ref={mountRef}
            style={{
                width: `${width}px`,
                height: `${height}px`,
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