// App.jsx
import "./App.css";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import VideoInputPanel from './components/VideoInputPanel';
import MotionViewer from './components/MotionViewer';
import BounceControlPanel from './components/BounceControlPanel';
import ExportPanel from './components/ExportPanel';
import AnimationControls from './components/AnimationControls';

// 🚩 Use frontend (pure) helpers from /src, NOT /backend
import { applyBounce, updateSpringConfig } from './utils/bounceProcessor';
import { useAnimationPlayer } from './hooks/useAnimationPlayer';

const INITIAL_APP_STATE = {
  isLoading: false,
  error: null,
  modelLoaded: false,
  modelPath: ""
};
const INITIAL_PROCESSING_STATE = {
  isProcessing: false,
  progress: 0,
  error: null
};
const INITIAL_VIDEO_STATE = {
  source: null,
  metadata: null,
  url: null,
  processingTimeout: null
};
const PROCESSING_TIMEOUT = 300000; // 5 minutes

function App() {
  const [mode, setMode] = useState('live');
  const [bounceConfig, setBounceConfig] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [fps, setFps] = useState(30);

  const [appState, setAppState] = useState(INITIAL_APP_STATE);
  const [processingState, setProcessingState] = useState(INITIAL_PROCESSING_STATE);
  const [videoState, setVideoState] = useState(INITIAL_VIDEO_STATE);

  const [displayMode, setDisplayMode] = useState('skin');

  // New states for dynamic clothing management
  const [detectedClothingNames, setDetectedClothingNames] = useState([]); // List of clothing names from the loaded FBX
  const [clothingVisibility, setClothingVisibility] = useState({}); // Visibility state for each detected item


  const {
    currentFrame,
    isPlaying,
    setIsPlaying,
    reset,
    frameIndex,
    totalFrames,
    setFrames
  } = useAnimationPlayer(mode === 'playback' ? fps : 0);

  // Callback to receive clothing names from MotionViewer
  const handleClothingMeshesLoaded = useCallback((names) => {
    setDetectedClothingNames(names);
    // Initialize or update visibility for newly detected clothing
    setClothingVisibility(prev => {
      const newVisibility = {};
      names.forEach(name => {
        newVisibility[name] = prev[name] !== false; // Keep previous state if exists, otherwise default to true
      });
      return newVisibility;
    });
  }, []);


  useEffect(() => {
    window.api.loadSavedModelPath?.().then((savedPath) => {
      if (savedPath && savedPath !== appState.modelPath) {
        setAppState((prev) => ({
          ...prev,
          modelPath: savedPath
        }));
      }
    });
  }, []);

  const activeFrame = useMemo(() => {
    return mode === 'playback'
      ? currentFrame ? applyBounce(currentFrame) : null
      : liveFrame;
  }, [mode, currentFrame, liveFrame]);

  const handleError = useCallback((error, timeout = 5000) => {
    console.error('Application error:', error);
    setAppState(prev => ({
      ...prev,
      error: error.message,
      isLoading: false
    }));
    setTimeout(() => {
      setAppState(prev => ({ ...prev, error: null }));
    }, timeout);
  }, []);

  useEffect(() => {
    return () => {
      if (videoState.url) {
        URL.revokeObjectURL(videoState.url);
      }
      if (videoState.processingTimeout) {
        clearTimeout(videoState.processingTimeout);
      }
    };
  }, [videoState.url, videoState.processingTimeout]);

  useEffect(() => {
    if (!appState.modelPath) return;
    const validateModel = async () => {
      try {
        const exists = await window.api.checkFile(appState.modelPath);
        if (!exists) {
          throw new Error(`DAZ model not found at: ${appState.modelPath}`);
        }
        setAppState(prev => ({ ...prev, modelLoaded: true }));
      } catch (err) {
        handleError(err);
      }
    };
    validateModel();
  }, [appState.modelPath, handleError]);

  useEffect(() => {
    let cleanup = null;
    if (mode === 'live' && window.api?.poseListener) {
      cleanup = window.api.poseListener((data) => {
        try {
          const bounced = applyBounce(data.keypoints);
          setLiveFrame(bounced);
        } catch (err) {
          handleError(err);
        }
      });
    }
    return () => cleanup?.();
  }, [mode, handleError]);

  const handleVideoProcess = async (videoFile) => {
    setProcessingState({ isProcessing: true, progress: 0, error: null });
    const timeout = setTimeout(() => {
      handleError(new Error('Video processing timeout. Please try a shorter video.'));
      setProcessingState(prev => ({ ...prev, isProcessing: false }));
    }, PROCESSING_TIMEOUT);
    try {
      if (!videoFile?.type?.startsWith('video/')) {
        throw new Error('Invalid file type. Please upload a video file.');
      }
      window.api.showNotification({
        title: 'Processing Video',
        body: 'Starting motion capture analysis...'
      });
      const frames = await window.api.processVideo(videoFile.path, (progress) => {
        setProcessingState(prev => ({ ...prev, progress }));
      });
      clearTimeout(timeout);
      setFrames(frames);
      setMode('playback');
      setProcessingState(prev => ({ prev, progress: 100, isProcessing: false }));
      window.api.showNotification({
        title: 'Processing Complete',
        body: `Analyzed ${frames.length} frames successfully`
      });
    } catch (err) {
      clearTimeout(timeout);
      handleError(err);
      setProcessingState(prev => ({ ...prev, error: err.message, isProcessing: false }));
    }
  };

  const handleVideoLoad = ({ file, url, meta }) => {
    if (videoState.url) {
      URL.revokeObjectURL(videoState.url);
    }
    setVideoState({
      source: file,
      metadata: meta,
      url: url
    });
    handleVideoProcess(file);
  };

  const handleExport = async () => {
    if (!activeFrame) {
      handleError(new Error('No motion data to export'));
      return;
    }
    if (!appState.modelLoaded) {
      handleError(new Error('DAZ model not loaded'));
      return;
    }
    setAppState(prev => ({ ...prev, isLoading: true }));
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportFormat = 'fbx';
      const outputPath = `./output/motion_${timestamp}.${exportFormat}`;
      await window.api.exportMotion({ frames: activeFrame, filename: `motion_${timestamp}`, format: exportFormat });
      window.api.showNotification({
        title: 'Export Successful',
        body: `Saved to: ${outputPath}`
      });
    } catch (err) {
      handleError(err);
    } finally {
      setAppState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleChooseModel = async () => {
      const filePath = await window.api.chooseModelFile();
      console.log("App.jsx - handleChooseModel: Received filePath from Electron:", filePath); // ADD THIS LINE
      if (filePath) {
          setAppState(prev => ({
              ...prev,
              modelPath: filePath,
              modelLoaded: false
          }));
          window.api.saveModelPath(filePath);
          setDetectedClothingNames([]);
          setClothingVisibility({});
      }
  };

  const handleDisplayModeChange = (event) => {
    setDisplayMode(event.target.value);
  };

  // Handler for individual clothing visibility
  const handleClothingToggle = (meshName) => {
    setClothingVisibility(prev => ({
      ...prev,
      [meshName]: !prev[meshName] // Toggle visibility for this item
    }));
  };

  return (
    <div style={{ display: 'grid', gap: '1em', padding: '1em' }}>
      <h1 style={{ color: 'Black' }}>MSFW Engine Alpha</h1>
      {!appState.modelPath && (
        <div style={{
          color: 'orange',
          padding: '0.5em 1em',
          backgroundColor: 'rgba(255,165,0,0.1)',
          borderRadius: '4px'
        }}>
          Please select a DAZ model FBX file to continue.
        </div>
      )}
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
              : 'Processing...'}
          </div>
        </div>
      )}
      <VideoInputPanel
        onVideoLoad={handleVideoLoad}
        onError={handleError}
        disabled={appState.isLoading || processingState.isProcessing}
      />
      {videoState.metadata && mode === 'playback' && (
        <div style={{
          padding: '1em',
          backgroundColor: '#333',
          borderRadius: '4px',
          color: 'white'
        }}>
          <h4 style={{ margin: '0 0 0.5em 0' }}>Source Video</h4>
          <p>Duration: {videoState.metadata.duration.toFixed(2)}s</p>
          <p>Frames: {totalFrames}</p>
          <p>Resolution: {videoState.metadata.width}x{videoState.metadata.height}</p>
        </div>
      )}
      <div style={{ marginBottom: '1em' }}>
        Animation Mode:
        <label style={{ color: 'black' }}>
          <input
            type="radio"
            value="live"
            checked={mode === 'live'}
            onChange={() => setMode('live')}
            disabled={processingState.isProcessing}
          /> Live Mode
        </label>
        <label style={{ color: 'black', marginLeft: '1em' }}>
          <input
            type="radio"
            value="playback"
            checked={mode === 'playback'}
            onChange={() => setMode('playback')}
            disabled={processingState.isProcessing}
          /> Playback Mode
        </label>
      </div>

      <div style={{ marginBottom: '1em' }}>
        <label htmlFor="displayModeSelect" style={{ color: 'black' }}>Display Mode: </label>
        <select id="displayModeSelect" value={displayMode} onChange={handleDisplayModeChange} style={{ marginLeft: '0.5em' }}>
          <option value="skin">With Skin</option>
          <option value="gray">Gray Color Only</option>
          <option value="gray_with_bones">Gray Color with Bones</option>
        </select>
      </div>

      <button onClick={handleChooseModel} className="button">
        <div className="button-outer">
          <div className="button-inner">
            <span>Choose DAZ Model (.fbx)</span>
          </div>
        </div>
      </button>

      {/* Dynamic Clothing Visibility Controls */}
      {appState.modelLoaded && detectedClothingNames.length > 0 && ( // Only show if model loaded and clothing detected
        <div style={{ border: '1px solid #ccc', padding: '1em', borderRadius: '4px', background: '#f9f9f9' }}>
          <h4 style={{ margin: '0 0 0.5em 0', color: 'black' }}>Clothing Visibility</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {detectedClothingNames.map(meshName => (
              <label key={meshName} style={{ color: 'black', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={clothingVisibility[meshName]}
                  onChange={() => handleClothingToggle(meshName)}
                />
                {/* Friendly name display: remove _numbersShape and add spaces for readability */}
                {meshName.replace(/(_\d+Shape)?$/, '').replace(/([A-Z])/g, ' $1').trim()}
              </label>
            ))}
          </div>
        </div>
      )}

          {/* Render MotionViewer ONLY if modelPath exists */}
            {appState.modelPath && ( // <-- Add this condition
                <MotionViewer
                    keypoints={activeFrame}
                    modelPath={appState.modelPath}
                    onError={handleError}
                    displayMode={displayMode}
                    clothingVisibility={clothingVisibility}
                    onClothingMeshesLoaded={handleClothingMeshesLoaded}
                />
            )}

            {!appState.modelPath && ( // Optionally show a placeholder while modelPath is loading/not chosen
                <div style={{
                    width: '1000px', // Match MotionViewer's width
                    height: '800px', // Match MotionViewer's height
                    border: '1px solid #333',
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: '#666'
                }}>
                    Awaiting DAZ Model Selection...
                </div>
            )}
      {mode === 'playback' && (
        <AnimationControls
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          reset={reset}
          fps={fps}
          setFps={setFps}
          frameIndex={frameIndex}
          totalFrames={totalFrames}
          disabled={!appState.modelLoaded || processingState.isProcessing}
        />
      )}
      <BounceControlPanel
        onSave={(config) => {
          setBounceConfig(config);
          updateSpringConfig(config);
        }}
        disabled={!activeFrame || processingState.isProcessing}
      />
      <ExportPanel
        playbackFrames={activeFrame}
        onExport={handleExport}
        disabled={!activeFrame || appState.isLoading || processingState.isProcessing}
        onError={handleError}
      />
    </div>
  );
}

export default App;