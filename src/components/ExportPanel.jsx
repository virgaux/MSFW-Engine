import React, { useState } from 'react';
const { exportFBXToFile } = require('./fbxExporter');  // Import the FBX export function

const presets = {
  Blender: { format: 'bvh', skeleton: 'standard_human' },
  DAZ: { format: 'fbx', skeleton: 'genesis_8' },
  Unity: { format: 'bvh', skeleton: 'humanoid' }
};

export default function ExportPanel({ playbackFrames }) {
  const [selected, setSelected] = useState('Blender');
  const [filename, setFilename] = useState('motion_export');

  const handleExport = () => {
    const config = {
      filename,
      ...presets[selected],
      frames: playbackFrames  // Pass the playback frames to the export function
    };

    if (config.format === 'fbx') {
      // Trigger the FBX export for DAZ preset
      const outputPath = `${config.filename}.fbx`;
      exportFBXToFile(config.frames, outputPath);  // Pass frames and output file path
      alert(`Exported ${config.filename}.fbx for ${selected}`);
    } else {
      // Handle other formats like BVH if needed
      alert(`Exported ${config.filename}.${config.format} for ${selected}`);
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
      <button onClick={() => window.api.savePlayback(playbackFrames)}>
        Save Playback
      </button>
    </div>
  );
}
