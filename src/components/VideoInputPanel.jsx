import React, { useState, useRef, useEffect, useCallback } from 'react';
import { clipVideo } from '../../backend/videoService'; // Import the video clipping function
const { OpenPoseWrapper } = require('../../backend/openposeWrapper'); // Import OpenPoseWrapper

export default function VideoInputPanel({ onVideoLoad, onError, disabled }) {
  const [message, setMessage] = useState('Drag and drop a video file here or click to select');
  const [dragging, setDragging] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoObjectURL, setVideoObjectURL] = useState(null);
  const [videoMetadata, setVideoMetadata] = useState(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Handle video file processing
  const processSelectedFile = useCallback((file) => {
    if (!file.type.startsWith('video/')) {
      setMessage('Please drop a valid video file (e.g., .mp4, .mov, .webm)');
      setVideoFile(null);
      onError?.(new Error('Invalid file type. Please select a video.'));
      return;
    }
    setMessage(`Loading ${file.name}...`);
    setVideoFile(file);  // Trigger metadata loading
  }, [onError]);

  // Handle video drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (disabled) return;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processSelectedFile(file);
  }, [disabled, processSelectedFile]);

  // Handle video metadata (duration, width, height)
  const handleVideoMetadataLoaded = useCallback(() => {
    const duration = videoRef.current?.duration || 0;
    setVideoMetadata({
      duration,
      width: videoRef.current?.videoWidth || 0,
      height: videoRef.current?.videoHeight || 0,
    });
    setEndTime(duration);  // Set the end time to the video's full duration
    setStartTime(0);  // Set the default start time to 0
    onVideoLoad?.({
      file: videoFile,
      url: videoObjectURL,
      meta: { duration, width: videoRef.current?.videoWidth, height: videoRef.current?.videoHeight },
      getTimes: () => ({ startTime: videoRef.current?.currentTime || startTime, endTime: videoRef.current?.duration || endTime })
    });
  }, [videoFile, videoObjectURL, onVideoLoad, startTime, endTime]);

  // Handle clipping logic (using FFmpeg)
  const handleClipVideo = useCallback(() => {
    if (videoFile) {
      const inputPath = URL.createObjectURL(videoFile);
      const outputPath = 'output_clipped_video.mp4'; // Output location
      clipVideo(inputPath, startTime, endTime, outputPath)
        .then((clippedVideoPath) => {
          console.log('Clipped video saved at:', clippedVideoPath);
          // Pass the clipped video to OpenPose for pose detection
          runOpenPose(clippedVideoPath);
        })
        .catch(onError);
    }
  }, [videoFile, startTime, endTime, onError]);

  // Run OpenPose on the clipped video
  const runOpenPose = useCallback((videoPath) => {
    const openPose = new OpenPoseWrapper({
      openposePath: 'path/to/openpose',
      outputDir: 'path/to/output/keypoints', // Directory for JSON outputs
    });

    openPose.on('initialized', ({ gpu, gpuInfo }) => {
      console.log('OpenPose Initialized:', gpu, gpuInfo);
      openPose.runOpenPose(videoPath, {
        display: false, // Do not show the video while processing
        renderPose: false, // Do not render the pose on the video
      });
    });

    openPose.on('progress', ({ type, data }) => {
      console.log(`[OpenPose Progress] ${type}: ${data}`);
    });

    openPose.on('complete', ({ code }) => {
      console.log(`[OpenPose Complete] Process finished with code: ${code}`);
    });

    openPose.on('error', (error) => {
      console.error('OpenPose Error:', error);
    });
  }, []);

  // Handle time input changes
  const handleStartTimeChange = useCallback((e) => {
    const newTime = Math.min(parseFloat(e.target.value), endTime);  // Ensure startTime <= endTime
    setStartTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  }, [endTime]);

  const handleEndTimeChange = useCallback((e) => {
    const newTime = Math.max(startTime, Math.min(parseFloat(e.target.value), videoMetadata?.duration || 0));  // Ensure endTime >= startTime
    setEndTime(newTime);
    if (videoRef.current && videoRef.current.currentTime > newTime) {
      videoRef.current.currentTime = newTime;  // Adjust if current time exceeds endTime
    }
  }, [startTime, videoMetadata?.duration]);

  // Format time for display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.padStart(5, '0')}`;
  };

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#00f' : '#888'}`,
          padding: '2em',
          borderRadius: '10px',
          background: dragging ? '#222' : '#111',
          color: 'white',
          textAlign: 'center',
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <p>{message}</p>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="video/*"
          onChange={(e) => processSelectedFile(e.target.files[0])}
        />
      </div>

      {videoObjectURL && (
        <div>
          <video
            ref={videoRef}
            src={videoObjectURL}
            controls
            onLoadedMetadata={handleVideoMetadataLoaded}
            style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '0 auto' }}
          />
        </div>
      )}

      {videoMetadata && (
        <div>
          {/* Start Time */}
          <div>
            <label>Start Time:</label>
            <input
              type="range"
              min="0"
              max={videoMetadata.duration}
              value={startTime}
              onChange={handleStartTimeChange}
              step="0.01"
              disabled={disabled}
            />
            <input
              type="number"
              value={startTime.toFixed(2)}
              onChange={handleStartTimeChange}
              step="0.01"
              disabled={disabled}
            />
          </div>

          {/* End Time */}
          <div>
            <label>End Time:</label>
            <input
              type="range"
              min="0"
              max={videoMetadata.duration}
              value={endTime}
              onChange={handleEndTimeChange}
              step="0.01"
              disabled={disabled}
            />
            <input
              type="number"
              value={endTime.toFixed(2)}
              onChange={handleEndTimeChange}
              step="0.01"
              disabled={disabled}
            />
          </div>

          <button onClick={handleClipVideo} disabled={disabled}>Clip Video</button>
        </div>
      )}
    </div>
  );
}
