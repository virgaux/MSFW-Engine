import React, { useState, useEffect } from 'react';
import MotionDropZone from './MotionDropZone';
import MotionViewer from './MotionViewer';
import BounceControlPanel from './BounceControlPanel';
import ExportPanel from './ExportPanel';
import AnimationControls from './AnimationControls';
import { applyBounce, updateSpringConfig } from '../../backend/helpers/bounceProcessor';
import { useAnimationPlayer } from '../../backend/hooks/useAnimationPlayer';
import { exportMotionData } from '../../backend/exporters/exporter'; // Consolidated exporter

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
    modelPath: "path/to/your/daz_model.fbx"
  });

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

  // Model validation
  useEffect(() => {
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
  }, [appState.modelPath]);

  // Live mode pose listener
  useEffect(() => {
    if (mode === 'live' && window.api?.poseListener) {
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
    setProcessingState({ isProcessing: true, progress: 0, error: null });
    try {
      if (!videoFile?.type?.startsWith('video/')) {
        throw new Error('Invalid file type. Please upload a video file.');
      }

      const frames = await window.api.processVideo(videoFile.path, (progress) => {
        setProcessingState(prev => ({ ...prev, progress }));
      });

      setFrames(frames);
      setMode('playback');
      setProcessingState(prev => ({ ...prev, progress: 100 }));

    } catch (err) {
      handleError(err);
      setProcessingState(prev => ({ 
        ...prev, 
        error: err.message,
        isProcessing: false 
      }));
    }
  };

  // Determine active frame
  const activeFrame = mode === 'playback'
    ? currentFrame ? applyBounce(currentFrame) : null
    : liveFrame;

  // Export handler
  const handleExport = async () => {
    if (!activeFrame) {
      handleError(new Error('No motion data to export'));
      return;
    }

    setAppState(prev => ({ ...prev, isLoading: true }));
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportFormat = 'fbx';
      const outputPath = `./output/motion_${timestamp}.${exportFormat}`;
      
      await exportMotionData(activeFrame, outputPath, exportFormat);
      
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
              : 'Processing...'}
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div style={{ marginBottom: '1em' }}>
        <label style={{ color: 'white' }}>
          <input
            type="radio"
            value="live"
            checked={mode === 'live'}
            onChange={() => setMode('live')}
          /> Live Mode
        </label>
        <label style={{ color: 'white', marginLeft: '1em' }}>
          <input
            type="radio"
            value="playback"
            checked={mode === 'playback'}
            onChange={() => setMode('playback')}
          /> Playback Mode
        </label>
      </div>

      <MotionDropZone 
        onFileDrop={handleVideoProcess}
        disabled={appState.isLoading || processingState.isProcessing}
      />
      
      <MotionViewer 
        keypoints={activeFrame} 
        modelPath={appState.modelPath}
        onError={handleError}
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
        playbackFrames={activeFrame}
        onExport={handleExport}
        disabled={!activeFrame || appState.isLoading}
        onError={handleError}
      />
    </div>
  );
}

export default App;