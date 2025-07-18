import React, { useEffect, useState } from 'react';

export default function PluginManagerPanel() {
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    window.api.loadPlugins().then(setPlugins);
  }, []);

  return (
    <div style={{ backgroundColor: '#181818', color: 'white', padding: '1em' }}>
      <h3>Loaded Plugins</h3>
      <ul>
        {plugins.map((p, i) => (
          <li key={i}><strong>{p.name}</strong>: {p.status}</li>
        ))}
      </ul>
    </div>
  );
}