import React, { useState, useEffect } from 'react';
import { saveBounceConfig } from '../helpers/bounceTagger';

const PRESETS = {
  Realistic: { gravity: 2.5, stiffness: 0.12, damping: 0.85 },
  Anime: { gravity: 3.5, stiffness: 0.08, damping: 0.75 },
  ZeroG: { gravity: 0.1, stiffness: 0.05, damping: 0.92 }
};

function BounceControlPanel({ onSave }) {
    const [gravity, setGravity] = useState(2.5);
    const [stiffness, setStiffness] = useState(0.15);
    const [damping, setDamping] = useState(0.9);
    const [bounceConfig, setBounceConfig] = useState({
    enabledZones: {
        breast: true,
        butt: true,
        pelvis: true
    }
    });


  // Load saved config if available
  useEffect(() => {
    if (window.api?.loadBounceConfig) {
      window.api.loadBounceConfig().then(config => {
        if (config) {
          setGravity(config.gravity);
          setStiffness(config.stiffness);
          setDamping(config.damping);
        }
      });
    }
  }, []);

  const handlePreset = (preset) => {
    const settings = PRESETS[preset];
    setGravity(settings.gravity);
    setStiffness(settings.stiffness);
    setDamping(settings.damping);
  };

  const handleSave = () => {
    const config = { gravity, stiffness, damping };
    const json = JSON.stringify(config, null, 2);
    saveBounceConfig(json); // writes to disk
    onSave && onSave({
        gravity,
        stiffness,
        damping,
        enabledZones: bounceConfig?.enabledZones || {}
    });

  };

  return (
    <div style={{ background: '#222', color: 'white', padding: '1em', borderRadius: '10px' }}>
      <h2>Bounce Settings</h2>

      <label>Gravity: {gravity}</label>
      <input type="range" min="0" max="10" step="0.1" value={gravity} onChange={e => setGravity(parseFloat(e.target.value))} />

      <label>Stiffness: {stiffness}</label>
      <input type="range" min="0" max="1" step="0.01" value={stiffness} onChange={e => setStiffness(parseFloat(e.target.value))} />

      <label>Damping: {damping}</label>
      <input type="range" min="0" max="1" step="0.01" value={damping} onChange={e => setDamping(parseFloat(e.target.value))} />

      <div style={{ marginTop: '1em' }}>
        <button onClick={() => handlePreset('Realistic')}>Realistic</button>
        <button onClick={() => handlePreset('Anime')}>Anime</button>
        <button onClick={() => handlePreset('ZeroG')}>Zero-G</button>
        <button onClick={handleSave} style={{ float: 'right' }}>Save Config</button>
      </div>
      <h3>Active Zones</h3>
        <label>
        <input
            type="checkbox"
            checked={bounceConfig?.enabledZones?.breast ?? true}
            onChange={e =>
            setBounceConfig(prev => ({
                ...prev,
                enabledZones: {
                ...prev.enabledZones,
                breast: e.target.checked
                }
            }))
            }
        />
        Breast
        </label>

        <label>
        <input
            type="checkbox"
            checked={bounceConfig?.enabledZones?.butt ?? true}
            onChange={e =>
            setBounceConfig(prev => ({
                ...prev,
                enabledZones: {
                ...prev.enabledZones,
                butt: e.target.checked
                }
            }))
            }
        />
        Butt
        </label>

        <label>
        <input
            type="checkbox"
            checked={bounceConfig?.enabledZones?.pelvis ?? true}
            onChange={e =>
            setBounceConfig(prev => ({
                ...prev,
                enabledZones: {
                ...prev.enabledZones,
                pelvis: e.target.checked
                }
            }))
            }
        />
        Pelvis
        </label>

    </div>
  );
}

export default BounceControlPanel;
