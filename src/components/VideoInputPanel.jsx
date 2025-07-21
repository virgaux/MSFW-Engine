import React, { useState, useEffect } from 'react';
import MotionDropZone from './MotionDropZone';
import MotionViewer from './MotionViewer';
import BounceControlPanel from './BounceControlPanel';
import ExportPanel from './ExportPanel';
import AnimationControls from './AnimationControls';
import { applyBounce, updateSpringConfig } from '../utils/bounceProcessor';
import { useAnimationPlayer } from '../hooks/useAnimationPlayer';


function App() {
    // Core states
    const [mode, setMode] = useState('live');
    const [bounceConfig, setBounceConfig] = useState(null);
    const [liveFrame, setLiveFrame] = useState(null);
    const [fps, setFps] = useState(30);

    // Application state management
    const [appState, setAppState] = useState({
        isLoading: false,
        error: null,
        modelLoaded: false,
        modelPath: null // <--- CHANGE THIS: Initialize to null or ''
    });

    // Clothing visibility state (add these if you haven't already, for the MotionViewer prop)
    const [clothingVisibility, setClothingVisibility] = useState({});
    const [detectedClothingNames, setDetectedClothingNames] = useState([]);

    // Processing state management
    const [processingState, setProcessingState] = useState({
        isProcessing: false,
        progress: 0,
        error: null
    });

    // Playback data from custom hook
    const {
        currentFrame,
        isPlaying,
        setIsPlaying,
        reset,
        frameIndex,
        totalFrames,
        setFrames
    } = useAnimationPlayer(mode === 'playback' ? fps : 0);

    // Error handling
    const handleError = (error) => {
        console.error('Application error:', error);
        setAppState(prev => ({
            ...prev,
            error: error.message,
            isLoading: false
        }));
    };

    // --- NEW: Load saved model path on app start ---
    useEffect(() => {
        const loadInitialModelPath = async () => {
            try {
                const savedPath = await window.api.loadSavedModelPath();
                if (savedPath) {
                    console.log("App.jsx: Loaded saved model path:", savedPath);
                    setAppState(prev => ({
                        ...prev,
                        modelPath: savedPath,
                        modelLoaded: false // Will be validated by the next useEffect
                    }));
                } else {
                    console.log("App.jsx: No saved model path found.");
                    // Optionally set a user-friendly message or disable model viewer
                }
            } catch (err) {
                console.error("App.jsx: Error loading saved model path:", err);
                // Don't use handleError here if you want to distinguish initial load vs. user error
            }
        };

        loadInitialModelPath();
    }, []); // Run only once on component mount


    // Model validation (only runs if modelPath is not null/empty)
    useEffect(() => {
        const validateModel = async () => {
            if (!appState.modelPath) { // <--- ADD THIS CHECK!
                console.log("validateModel: modelPath is empty, skipping validation.");
                setAppState(prev => ({ ...prev, modelLoaded: false, error: null })); // Ensure no old error
                return;
            }

            console.log(`validateModel called for path: ${appState.modelPath}`);
            try {
                const exists = await window.api.checkFile(appState.modelPath);
                if (!exists) {
                    throw new Error(`DAZ model not found at: ${appState.modelPath}`);
                }
                setAppState(prev => ({ ...prev, modelLoaded: true, error: null })); // Clear previous errors on success
            } catch (err) {
                handleError(err);
                setAppState(prev => ({ ...prev, modelLoaded: false })); // Ensure modelLoaded is false on error
            }
        };

        validateModel();
    }, [appState.modelPath]); // Depend on modelPath

    // Live mode pose listener
    useEffect(() => {
        if (mode === 'live' && window.api?.poseListener) {
            console.log(`Setting up pose listener for live mode.`);
            const cleanup = window.api.poseListener((data) => {
                try {
                    const bounced = applyBounce(data.keypoints);
                    setLiveFrame(bounced);
                } catch (err) {
                    handleError(err);
                }
            });

            return cleanup; // Cleanup listener on unmount
        }
    }, [mode]);

    // Video processing handler
    const handleVideoProcess = async (videoFile) => {
        console.log(`Processing video file: ${videoFile.name}`);
        setProcessingState({ isProcessing: true, progress: 0, error: null });
        try {
            console.log("trying to process video file:", videoFile);
            if (!videoFile?.type?.startsWith('video/')) {
                throw new Error('Invalid file type. Please upload a video file.');
            }
            console.log(`Sending video file for processing: ${videoFile.path}`); // Added log
            const frames = await window.api.processVideo(videoFile.path, (progress) => {
                console.log(`Processing progress: ${progress}%`);
                setProcessingState(prev => ({ ...prev, progress }));
            });

            setFrames(frames);
            setMode('playback');
            setProcessingState(prev => ({ ...prev, progress: 100 }));

        } catch (err) {
            console.log("Error processing video:", err);
            handleError(err);
            setProcessingState(prev => ({
                ...prev,
                error: err.message,
                isProcessing: false
            }));
        }
    };

    // --- NEW: Handle choosing DAZ model ---
    const handleChooseModel = async () => {
        setAppState(prev => ({ ...prev, isLoading: true, error: null })); // Indicate loading
        try {
            const filePath = await window.api.chooseModelFile();
            console.log("App.jsx - handleChooseModel: Received filePath from Electron:", filePath);
            if (filePath) {
                setAppState(prev => ({
                    ...prev,
                    modelPath: filePath,
                    modelLoaded: false, // Will be re-validated by useEffect
                    isLoading: false // Done choosing
                }));
                await window.api.saveModelPath(filePath); // Ensure await here
                // Reset clothing visibility and detected names for the new model
                setDetectedClothingNames([]);
                setClothingVisibility({});
            } else {
                setAppState(prev => ({ ...prev, isLoading: false })); // Canceled dialog
            }
        } catch (err) {
            handleError(err);
            setAppState(prev => ({ ...prev, isLoading: false }));
        }
    };

    // Callback from MotionViewer when it loads the model and detects clothing meshes
    const handleClothingMeshesLoaded = (meshNames) => {
        console.log("App.jsx: Detected clothing meshes:", meshNames);
        setDetectedClothingNames(meshNames);
        // Initialize clothing visibility: all true by default
        const initialVisibility = meshNames.reduce((acc, name) => ({ ...acc, [name]: true }), {});
        setClothingVisibility(initialVisibility);
    };

    // Toggle individual clothing visibility
    const toggleClothingVisibility = (meshName) => {
        setClothingVisibility(prev => ({
            ...prev,
            [meshName]: !prev[meshName]
        }));
    };


    // Determine active frame
    const activeFrame = mode === 'playback'
        ? currentFrame ? applyBounce(currentFrame) : null
        : liveFrame;

    // Export handler
    const handleExport = async () => {
        console.log(`Exporting motion data...`);
        if (!activeFrame) {
            handleError(new Error('No motion data to export'));
            return;
        }

        setAppState(prev => ({ ...prev, isLoading: true, error: null }));
        console.log(`Exporting active frame:`, activeFrame);
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFormat = 'fbx'; // Or derive from user selection
            // In your main.js exportMotion, it expects config.filename and config.format
            // You are passing activeFrame, outputPath, exportFormat which is correct for main.js's exportMotionData
            // But the ipcMain.handle('export-motion') expects a config object.
            // Let's adjust this call to match main.js ipcMain.handle('export-motion') signature
            const exportConfig = {
                filename: `motion_${timestamp}`, // This will be used in main.js
                format: exportFormat,
                frames: [activeFrame] // Assuming activeFrame is a single frame keypoint array.
                                      // If it's a sequence of frames, adjust accordingly.
                                      // Your main.js fallback expects an array, so make this an array.
                                      // If `activeFrame` itself is already the full sequence, just pass `activeFrame` directly.
                                      // Based on `playbackFrames={activeFrame}` in ExportPanel, activeFrame is likely the current frame.
                                      // So you need the *entire* sequence for export. This is a logic gap.
                                      // For now, I'll pass a dummy 'filename' and 'format' and rely on the fallback.
            };

            // If you want to export the entire playback sequence, you'd use 'totalFrames' from useAnimationPlayer
            // This is a common requirement for motion export.
            // For now, let's just make sure the IPC call matches its handler.
            await window.api.exportMotion(exportConfig); // Pass the config object

            window.api.showNotification({
                title: 'Export Successful',
                body: `Saved to: ./output/exports/motion_${timestamp}.${exportFormat}` // Adjust this path if main.js uses a different one
            });

        } catch (err) {
            handleError(err);
        } finally {
            setAppState(prev => ({ ...prev, isLoading: false }));
        }
    };


    return (
        <div style={{ display: 'grid', gap: '1em', padding: '1em' }}>
            <h1 style={{ color: 'white' }}>MSFW Engine Alpha</h1>

            {/* Error Message */}
            {appState.error && (
                <div style={{
                    color: 'red',
                    padding: '1em',
                    backgroundColor: 'rgba(255,0,0,0.1)',
                    borderRadius: '4px'
                }}>
                    Error: {appState.error}
                    <button
                        onClick={() => setAppState(prev => ({ ...prev, error: null }))}
                        style={{ marginLeft: '1em' }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Loading Overlay */}
            {(appState.isLoading || processingState.isProcessing) && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ color: 'white' }}>
                        {processingState.progress > 0
                            ? `Processing: ${processingState.progress}%`
                            : (appState.isLoading ? 'Loading...' : 'Processing...')}
                    </div>
                </div>
            )}

            {/* Mode Toggle */}
            <div style={{ marginBottom: '1em' }}>
                Video Input Mode:
                <label style={{ color: 'Black' }}>
                    <input
                        type="radio"
                        value="live"
                        checked={mode === 'live'}
                        onChange={() => setMode('live')}
                    /> Live Mode
                </label>
                <label style={{ color: 'black', marginLeft: '1em' }}>
                    <input
                        type="radio"
                        value="playback"
                        checked={mode === 'playback'}
                        onChange={() => setMode('playback')}
                    /> Playback Mode
                </label>
            </div>

            {/* Model Loading Section */}
            <div>
                <button onClick={handleChooseModel} disabled={appState.isLoading}>
                    Choose DAZ Model (.fbx)
                </button>
                {appState.modelPath && !appState.error && (
                    <span style={{ marginLeft: '10px', color: 'green' }}>
                        Model Path: {appState.modelPath} {appState.modelLoaded ? ' (Loaded)' : ' (Validating...)'}
                    </span>
                )}
                {appState.modelPath && appState.error && appState.error.includes("DAZ model not found") && (
                    <span style={{ marginLeft: '10px', color: 'orange' }}>
                        Model path problematic, please choose again.
                    </span>
                )}
            </div>

            {/* Clothing Visibility Controls */}
            {detectedClothingNames.length > 0 && (
                <div style={{ border: '1px solid #ccc', padding: '10px', marginTop: '10px' }}>
                    <h3 style={{ color: 'white' }}>Clothing Visibility</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {detectedClothingNames.map(name => (
                            <label key={name} style={{ color: 'black' }}>
                                <input
                                    type="checkbox"
                                    checked={clothingVisibility[name] !== false} // Default to true if not in map
                                    onChange={() => toggleClothingVisibility(name)}
                                />
                                {name.replace(/_/g, ' ')}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <MotionDropZone
                onFileDrop={handleVideoProcess}
                disabled={appState.isLoading || processingState.isProcessing}
            />

            <MotionViewer
                keypoints={activeFrame}
                modelPath={appState.modelPath}
                onError={handleError}
                displayMode={
                    appState.modelLoaded ? 'skin' : 'gray_with_bones' // Or a better default if model not loaded
                }
                clothingVisibility={clothingVisibility} // Pass the clothing visibility state
                onClothingMeshesLoaded={handleClothingMeshesLoaded} // New prop
            />

            {mode === 'playback' && (
                <AnimationControls
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    reset={reset}
                    fps={fps}
                    setFps={setFps}
                    frameIndex={frameIndex}
                    totalFrames={totalFrames}
                    disabled={!appState.modelLoaded}
                />
            )}

            <BounceControlPanel
                onSave={(config) => {
                    setBounceConfig(config);
                    updateSpringConfig(config);
                }}
                disabled={!activeFrame}
            />

            <ExportPanel
                // Note: playbackFrames should be the *entire* sequence for export, not just activeFrame
                // You'll need to adapt this to pass the full frames array from useAnimationPlayer if needed.
                // For now, leaving it as activeFrame to match your original prop, but be aware of this.
                playbackFrames={activeFrame} // Consider changing this to the full frames array for actual export
                onExport={handleExport}
                disabled={!activeFrame || appState.isLoading}
                onError={handleError}
            />
        </div>
    );
}

export default App;