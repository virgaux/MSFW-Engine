import React, { useState, useEffect } from 'react';
import MotionDropZone from './components/MotionDropZone';
import MotionViewer from './components/MotionViewer';
import BounceControlPanel from './components/BounceControlPanel';
import ResourceControlPanel from './components/ResourceControlPanel';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import PluginManagerPanel from './components/PluginManagerPanel';
import ExportPanel from './components/ExportPanel';
import { applyBounce, updateSpringConfig } from './helpers/bounceProcessor';

function App() {
    const [motionData, setMotionData] = useState(null);
    const [bounceConfig, setBounceConfig] = useState(null);

    useEffect(() => {
        if (window.api && window.api.poseListener) {
            window.api.poseListener((data) => {
                console.log('New pose data from OpenPose:', data.filename);
                const bounced = applyBounce(data.keypoints);
                setMotionData(bounced);
            });
        }
    }, []);

    return (
        <div style={{ display: 'grid', gap: '1em', padding: '1em' }}>
            <h1 style={{ color: 'white' }}>MSFW Engine Alpha</h1>
            <MotionDropZone onFileDrop={(file) => console.log('Video file dropped:', file)} />
            <MotionViewer data={motionData} />
            <BounceControlPanel onSave={(config) => {
            setBounceConfig(config);
            updateSpringConfig(config); // this updates the physics live
            }} />
            <ExportPanel />
            <ResourceControlPanel />
            <DiagnosticsPanel />
            <PluginManagerPanel />
        </div>
    );
}

export default App;
