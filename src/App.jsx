import React, { useState, useEffect } from 'react';
import MotionDropZone from './components/MotionDropZone';
import MotionViewer from './components/MotionViewer';
import BounceControlPanel from './components/BounceControlPanel';
import ResourceControlPanel from './components/ResourceControlPanel';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import PluginManagerPanel from './components/PluginManagerPanel';
import ExportPanel from './components/ExportPanel';
import AnimationControls from './components/AnimationControls';
import SnapshotViewerPanel from './components/SnapshotViewerPanel';

import { applyBounce, updateSpringConfig } from './helpers/bounceProcessor';
import { useAnimationPlayer } from './hooks/useAnimationPlayer';

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

  // Live mode listener
  useEffect(() => {
    if (mode === 'live' && window.api?.poseListener) {
      window.api.poseListener((data) => {
        const bounced = applyBounce(data.keypoints);
        setLiveFrame(bounced);
      });
    }
  }, [mode]);

  const activeFrame = mode === 'playback'
    ? currentFrame ? applyBounce(currentFrame) : null
    : liveFrame;

  return (
    <div style={{ display: 'grid', gap: '1em', padding: '1em' }}>
      <h1 style={{ color: 'white' }}>MSFW Engine Alpha</h1>

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

      <MotionDropZone onFileDrop={(file) => console.log('Video file dropped:', file)} />
      <MotionViewer data={activeFrame} />

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

      <BounceControlPanel
        onSave={(config) => {
          setBounceConfig(config);
          updateSpringConfig(config);
        }}
      />

      <ExportPanel />
      <ResourceControlPanel />
      <DiagnosticsPanel />
      <PluginManagerPanel />
      <SnapshotViewerPanel />
    </div>
  );
}

export default App;
