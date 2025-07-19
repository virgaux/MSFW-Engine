import React, { useState } from 'react';
import { processMotionData } from '../helpers/motionProcessor';

export default function MotionDropZone({ onFileProcessed }) {
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('Drag and drop motion files here');

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setMessage('Processing...');
      processMotionData(file)
        .then(data => {
          setMessage('File processed successfully!');
          onFileProcessed(data);
        })
        .catch(error => {
          setMessage('Error processing file');
        });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
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
      }}
    >
      <p>{message}</p>
    </div>
  );
}
