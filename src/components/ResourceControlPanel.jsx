import React, { useState } from 'react';

export default function ResourceControlPanel() {
    const [ram, setRam] = useState(4);
    const [gpu, setGpu] = useState('Auto');
    const [threads, setThreads] = useState(4);

    return (
        <div style={{ backgroundColor: '#202020', color: '#fff', padding: '1em' }}>
            <h3>Manual Resource Control</h3>
            <div>
                <label>Max RAM (GB): </label>
                <input type="number" value={ram} onChange={e => setRam(e.target.value)} />
            </div>
            <div>
                <label>GPU Mode: </label>
                <select value={gpu} onChange={e => setGpu(e.target.value)}>
                    <option>Auto</option>
                    <option>Prioritize NVIDIA</option>
                    <option>Prioritize AMD</option>
                </select>
            </div>
            <div>
                <label>CPU Threads: </label>
                <input type="number" value={threads} onChange={e => setThreads(e.target.value)} />
            </div>
        </div>
    );
}