import React, { useState } from 'react';

// ⚠️ DO NOT import any backend/exporter code here!
// All backend logic must be accessed via window.api (preload IPC).

const presets = {
  Blender: { format: 'bvh', skeleton: 'standard_human' },
  DAZ: { format: 'fbx', skeleton: 'genesis_8' },
  Unity: { format: 'bvh', skeleton: 'humanoid' }
};

export default function ExportPanel({ playbackFrames, onError }) {
  const [selected, setSelected] = useState('Blender');
  const [filename, setFilename] = useState('motion_export');

  const handleExport = async () => {
    try {
      const config = {
        filename,
        ...presets[selected],
        frames: playbackFrames
      };
      const outputPath = `${config.filename}.${config.format}`;

      if (!playbackFrames || playbackFrames.length === 0) {
        alert('No frames to export!');
        return;
      }

      // Call backend export function via IPC bridge
      await window.api.exportMotion(config.frames, outputPath, config.format);

      alert(`Exported ${config.filename}.${config.format} for ${selected}`);
    } catch (err) {
      if (onError) onError(err);
      alert('Export failed: ' + err.message);
    }
  };

  const handleSavePlayback = async () => {
    try {
      await window.api.savePlayback(playbackFrames);
      alert('Playback saved.');
    } catch (err) {
      if (onError) onError(err);
      alert('Failed to save playback: ' + err.message);
    }
  };

  return (
    <div style={{ backgroundColor: '#1a1a1a', color: 'white', padding: '1em' }}>
      <h3>Export Motion Data</h3>
      <label>Filename: </label>
      <input value={filename} onChange={e => setFilename(e.target.value)} /><br/>
      <label>Export Preset: </label>
      <select value={selected} onChange={e => setSelected(e.target.value)}>
        {Object.keys(presets).map(p => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <br/><br/>
      <button onClick={handleExport}>Export</button>
      <button onClick={handleSavePlayback}>
        Save Playback
      </button>
    </div>
  );
}
