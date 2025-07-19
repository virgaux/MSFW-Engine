import React, { useState, useEffect } from 'react';
import MotionDropZone from './components/MotionDropZone';
import MotionViewer from './components/MotionViewer';
import BounceControlPanel from './components/BounceControlPanel';
import ExportPanel from './components/ExportPanel';
import AnimationControls from './components/AnimationControls';
import { applyBounce, updateSpringConfig } from './helpers/bounceProcessor';
import { useAnimationPlayer } from './hooks/useAnimationPlayer';
import { exportMotionData } from './exporter';  // Import the combined export function

function App() {
  const [mode, setMode] = useState('live'); // "live" or "playback"
  const [bounceConfig, setBounceConfig] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [fps, setFps] = useState(30);

  // Playback mode data
  const {
    currentFrame,
    isPlaying,
    setIsPlaying,
    reset,
    frameIndex,
    totalFrames
  } = useAnimationPlayer(mode === 'playback' ? fps : 0);

  // Live mode listener (when in "live" mode)
  useEffect(() => {
    if (mode === 'live' && window.api?.poseListener) {
      window.api.poseListener((data) => {
        const bounced = applyBounce(data.keypoints); // Apply bounce to keypoints
        setLiveFrame(bounced); // Set live frame data
      });
    }
  }, [mode]);

  // Determine which frame to use based on mode
  const activeFrame = mode === 'playback'
    ? currentFrame ? applyBounce(currentFrame) : null
    : liveFrame;

  // Export logic (handles both FBX and BVH exports)
  const handleExport = () => {
    const exportFormat = 'fbx';  // Dynamically set to 'fbx' or 'bvh'
    const outputPath = `./output/${exportFormat}_${new Date().toISOString()}.${exportFormat}`; // Dynamic output path
    exportMotionData(activeFrame, outputPath, exportFormat); // Call the new combined export function
  };

  return (
    <div style={{ display: 'grid', gap: '1em', padding: '1em' }}>
      <h1 style={{ color: 'white' }}>MSFW Engine Alpha</h1>

      {/* Mode Toggle (Live/Playback) */}
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

      {/* Motion Data File Drop */}
      <MotionDropZone onFileDrop={(file) => console.log('Video file dropped:', file)} />
      
      {/* MotionViewer Component (Displays the motion based on the current keypoints) */}
      <MotionViewer keypoints={activeFrame} modelPath="path/to/your/daz_model.fbx" /> {/* Pass keypoints and model path */}

      {/* Playback controls */}
      {mode === 'playback' && (
        <AnimationControls
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          reset={reset}
          fps={fps}
          setFps={setFps}
          frameIndex={frameIndex}
          totalFrames={totalFrames}
        />
      )}

      {/* Bounce Control Panel */}
      <BounceControlPanel
        onSave={(config) => {
          setBounceConfig(config);
          updateSpringConfig(config);
        }}
      />

      {/* Export Button */}
      <button onClick={handleExport}>Export Motion Data</button>

      {/* Export Panel */}
      <ExportPanel playbackFrames={activeFrame} />
    </div>
  );
}

export default App;
