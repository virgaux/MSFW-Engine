import React, { useState, useEffect } from 'react';
import { saveBounceConfig } from '../helpers/bounceTagger';

const PRESETS = {
  Realistic: {
    zones: {
      breast: { gravity: 2.5, stiffness: 0.12, damping: 0.85 },
      butt: { gravity: 2.2, stiffness: 0.1, damping: 0.88 },
      pelvis: { gravity: 2.0, stiffness: 0.2, damping: 0.8 }
    }
  },
  Anime: {
    zones: {
      breast: { gravity: 3.5, stiffness: 0.08, damping: 0.75 },
      butt: { gravity: 3.0, stiffness: 0.07, damping: 0.72 },
      pelvis: { gravity: 2.8, stiffness: 0.1, damping: 0.78 }
    }
  },
  ZeroG: {
    zones: {
      breast: { gravity: 0.1, stiffness: 0.05, damping: 0.92 },
      butt: { gravity: 0.1, stiffness: 0.05, damping: 0.92 },
      pelvis: { gravity: 0.1, stiffness: 0.05, damping: 0.92 }
    }
  }
};

function BounceControlPanel({ onSave }) {
  const [bounceConfig, setBounceConfig] = useState({
    zones: {
      breast: { gravity: 2.5, stiffness: 0.15, damping: 0.9 },
      butt: { gravity: 2.5, stiffness: 0.15, damping: 0.9 },
      pelvis: { gravity: 2.5, stiffness: 0.15, damping: 0.9 }
    },
    enabledZones: {
      breast: true,
      butt: true,
      pelvis: true
    }
  });

  useEffect(() => {
    if (window.api?.loadBounceConfig) {
      window.api.loadBounceConfig().then(config => {
        if (config) setBounceConfig(config);
      });
    }
  }, []);

  const handleZoneChange = (zone, field, value) => {
    setBounceConfig(prev => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zone]: {
          ...prev.zones[zone],
          [field]: parseFloat(value)
        }
      }
    }));
  };

  const handlePreset = (presetName) => {
    const preset = PRESETS[presetName];
    setBounceConfig(prev => ({
      ...prev,
      zones: preset.zones
    }));
  };

  const handleSave = () => {
    const json = JSON.stringify(bounceConfig, null, 2);
    saveBounceConfig(json);
    onSave && onSave(bounceConfig);
  };

  const toggleZone = (zone) => {
    setBounceConfig(prev => ({
      ...prev,
      enabledZones: {
        ...prev.enabledZones,
        [zone]: !prev.enabledZones[zone]
      }
    }));
  };

  return (
    <div style={{ background: '#222', color: 'white', padding: '1em', borderRadius: '10px' }}>
      <h2>Bounce Settings</h2>

      {['breast', 'butt', 'pelvis'].map(zone => (
        <div key={zone} style={{ marginBottom: '1em' }}>
          <h3>
            <label>
              <input
                type="checkbox"
                checked={bounceConfig.enabledZones[zone]}
                onChange={() => toggleZone(zone)}
              />{' '}
              {zone.charAt(0).toUpperCase() + zone.slice(1)}
            </label>
          </h3>

          <label>Gravity: {bounceConfig.zones[zone].gravity}</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={bounceConfig.zones[zone].gravity}
            onChange={e => handleZoneChange(zone, 'gravity', e.target.value)}
          />

          <label>Stiffness: {bounceConfig.zones[zone].stiffness}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={bounceConfig.zones[zone].stiffness}
            onChange={e => handleZoneChange(zone, 'stiffness', e.target.value)}
          />

          <label>Damping: {bounceConfig.zones[zone].damping}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={bounceConfig.zones[zone].damping}
            onChange={e => handleZoneChange(zone, 'damping', e.target.value)}
          />
        </div>
      ))}

      <div style={{ marginTop: '1em' }}>
        <button onClick={() => handlePreset('Realistic')}>Realistic</button>
        <button onClick={() => handlePreset('Anime')}>Anime</button>
        <button onClick={() => handlePreset('ZeroG')}>Zero-G</button>
        <button onClick={handleSave} style={{ float: 'right' }}>Save Config</button>
      </div>
    </div>
  );
}

export default BounceControlPanel;
