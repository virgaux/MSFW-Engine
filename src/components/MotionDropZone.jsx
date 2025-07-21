import React, { useState } from 'react';

export default function MotionDropZone({ onFileDrop, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('Drag and drop a video file here');

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;  // Prevent drop if processing is in progress
    const file = e.dataTransfer.files[0];
    if (file) {
      // Only proceed if it's a video file
      if (!file.type.startsWith('video/')) {
        setMessage('Please drop a valid video file');
        return;
      }
      setMessage('Processing...');
      // Hand off the file to the parent for processing
      onFileDrop(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = () => {
    if (!disabled) setDragging(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: '2px dashed #00f',
        padding: '2em',
        borderRadius: '10px',
        background: dragging ? '#222' : '#111',
        color: 'white',
        textAlign: 'center',
        opacity: disabled ? 0.5 : 1  // Visually indicate if dropping is disabled
      }}
    >
      <p>{message}</p>
    </div>
  );
}
