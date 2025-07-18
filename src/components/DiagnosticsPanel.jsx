import React, { useEffect, useState } from 'react';

export default function DiagnosticsPanel() {
    const [stats, setStats] = useState({ ram: 0, cpu: 0, gpu: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            window.api.getDiagnostics().then(setStats);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ backgroundColor: '#111', color: '#0f0', padding: '1em' }}>
            <h3>Runtime Diagnostics</h3>
            <p>CPU Usage: {stats.cpu}%</p>
            <p>RAM Usage: {stats.ram} MB</p>
            <p>GPU Usage: {stats.gpu}%</p>
        </div>
    );
}