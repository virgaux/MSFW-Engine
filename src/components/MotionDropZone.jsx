import React, { useCallback } from 'react';

export default function MotionDropZone({ onFileDrop }) {
    const handleDrop = useCallback((event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            onFileDrop(file);
        }
    }, [onFileDrop]);

    return (
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
             style={{ border: '2px dashed gray', padding: '2em', textAlign: 'center' }}>
            <p>Drop a motion video (.MP4, .MOV) here</p>
        </div>
    );
}