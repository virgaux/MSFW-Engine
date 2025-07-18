import React from 'react';

function AnimationControls({ isPlaying, setIsPlaying, reset, fps, setFps, frameIndex, totalFrames }) {
  return (
    <div style={{ background: '#222', color: 'white', padding: '1em', borderRadius: '10px' }}>
      <h2>Animation Playback</h2>

      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={reset}>Reset</button>

        <label>
          FPS: {fps}
          <input
            type="range"
            min="10"
            max="60"
            step="1"
            value={fps}
            onChange={(e) => setFps(parseInt(e.target.value))}
            style={{ marginLeft: '1em' }}
          />
        </label>

        <div style={{ marginLeft: 'auto' }}>
          Frame {frameIndex + 1} / {totalFrames}
        </div>
      </div>
    </div>
  );
}

export default AnimationControls;
