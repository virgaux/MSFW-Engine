import React, { useState, useRef } from 'react';

export default function MotionDropZone({ onFileDrop, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('Drag and drop a video file here');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const videoRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;  // Prevent drop if processing is in progress
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setMessage('Please drop a valid video file');
        return;
      }
      setMessage('Processing...');
      setStartTime(0); // Reset start time when a new video is dropped
      setEndTime(0); // Reset end time when a new video is dropped
      onFileDrop(file);  // Pass the file to parent
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
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <p>{message}</p>

      {videoRef.current && (
        <div>
          <video
            ref={videoRef}
            controls
            src={URL.createObjectURL(videoRef.current.src)}
            style={{ width: '100%' }}
            onLoadedMetadata={() => {
              setEndTime(videoRef.current.duration); // Set end time to video duration
            }}
          />
          <div>
            <label>Start Time: </label>
            <input
              type="range"
              min="0"
              max={videoRef.current ? videoRef.current.duration : 0}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <input
              type="number"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ width: '50px' }}
            />
            <br />
            <label>End Time: </label>
            <input
              type="range"
              min={startTime}
              max={videoRef.current ? videoRef.current.duration : 0}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <input
              type="number"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ width: '50px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
