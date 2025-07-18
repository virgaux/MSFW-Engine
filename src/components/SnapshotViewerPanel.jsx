import React from 'react';

const snapshotContent = require('../../docs/MSFW_Project_Snapshot.md');

function SnapshotViewerPanel() {
  return (
    <div style={{
      background: '#1e1e1e',
      color: '#e0e0e0',
      padding: '1em',
      borderRadius: '10px',
      overflowY: 'scroll',
      maxHeight: '50vh',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap'
    }}>
      <h2>📄 Project Snapshot</h2>
      <pre>{snapshotContent.default || snapshotContent}</pre>
    </div>
  );
}

export default SnapshotViewerPanel;
