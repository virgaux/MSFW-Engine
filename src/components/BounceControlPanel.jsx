import React, { useState } from 'react';

const defaultZones = [
    { id: 'breast_L', label: 'Left Breast', gravity: 'realistic' },
    { id: 'breast_R', label: 'Right Breast', gravity: 'realistic' },
    { id: 'butt', label: 'Buttocks', gravity: 'realistic' },
    { id: 'piercing', label: 'Piercing', gravity: 'zero-G' }
];

export default function BounceControlPanel({ onSave }) {
    const [zones, setZones] = useState(defaultZones);

    const updateGravity = (id, gravity) => {
        setZones(prev => prev.map(z =>
            z.id === id ? { ...z, gravity } : z
        ));
    };

    const saveConfig = () => {
        const config = JSON.stringify(zones, null, 2);
        onSave(config);
    };

    return (
        <div style={{ padding: '1em', backgroundColor: '#222', color: '#fff' }}>
            <h3>Bounce & Gravity Control</h3>
            <ul>
                {zones.map(zone => (
                    <li key={zone.id}>
                        <strong>{zone.label}</strong>:
                        <select value={zone.gravity}
                            onChange={e => updateGravity(zone.id, e.target.value)}>
                            <option value="realistic">Realistic</option>
                            <option value="anime">Anime</option>
                            <option value="zero-G">Zero-G</option>
                        </select>
                    </li>
                ))}
            </ul>
            <button onClick={saveConfig}>Save Bounce Config</button>
        </div>
    );
}