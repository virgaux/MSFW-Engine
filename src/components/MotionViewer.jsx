import React from 'react';

export default function MotionViewer({ data }) {
    return (
        <div style={{ backgroundColor: '#111', color: '#fff', padding: '1em' }}>
            <p>Preview will render here (WebGL/Canvas placeholder)</p>
            <pre>{JSON.stringify(data?.slice(0, 2), null, 2)}</pre>
        </div>
    );
}