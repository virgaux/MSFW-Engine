import React, { useState } from 'react';

const presets = {
  Blender: { format: 'bvh', skeleton: 'standard_human' },
  DAZ: { format: 'fbx', skeleton: 'genesis_8' },
  Unity: { format: 'bvh', skeleton: 'humanoid' }
};

export default function ExportPanel({ playbackFrames }) { // ✅ accept prop
  const [selected, setSelected] = useState('Blender');
  const [filename, setFilename] = useState('motion_export');

  const handleExport = () => {
    const config = {
      filename,
      ...presets[selected],
      frames: playbackFrames  // ✅ now valid
    };
    window.api.exportMotion(config).then(() =>
      alert(`Exported ${config.filename}.${config.format} for ${selected}`)
    );
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
