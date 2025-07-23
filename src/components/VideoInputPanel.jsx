// In src/components/VideoInputPanel.jsx

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faPlay, faPause, faCrop } from '@fortawesome/free-solid-svg-icons';
import './VideoInputPanel.css'; 

const VideoInputPanel = () => {
    const [videoPath, setVideoPath] = useState(''); // Original video path (for processing)
    const [videoPathForPlayback, setVideoPathForPlayback] = useState(''); // NEW: Path to transcoded video for playback
    const [videoObjectURL, setVideoObjectURL] = useState(''); 
    const [videoDuration, setVideoDuration] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef(null); 

    const [statusMessage, setStatusMessage] = useState('Ready to select a video.');
    const [openPoseStatus, setOpenPoseStatus] = useState({}); 
    const [videoProcessingProgress, setVideoProcessingProgress] = useState(0); 
    const [transcodeProgress, setTranscodeProgress] = useState(0); // NEW: For playback transcoding progress

    // NEW: State to store the video basename
    const [videoBasename, setVideoBasename] = useState('');

    // Use useRef for mutable value that doesn't trigger re-renders, for the object URL cleanup
    const currentVideoObjectURLRef = useRef(''); 

    // Effect to fetch and set the video basename
    useEffect(() => {
        const updateBasename = async () => {
            if (videoPath && window.api?.getPathBasename) {
                try {
                    const name = await window.api.getPathBasename(videoPath);
                    setVideoBasename(name);
                } catch (error) {
                    console.error('Error fetching basename:', error);
                    setVideoBasename('Error getting name');
                }
            } else {
                setVideoBasename('');
            }
        };
        updateBasename();
    }, [videoPath]); // Rerun when videoPath changes

    useEffect(() => {
        // Set up IPC listeners
        const unsubscribeVideoStatus = window.api.onVideoProcessingStatus((status) => {
            console.log('Video Processing Status:', status);
            setStatusMessage(status.message);
            if (status.type === 'clipping-progress') {
                setVideoProcessingProgress(status.progress.percent || 0);
            }
            if (status.type === 'error') {
                alert(`Video Processing Error: ${status.message}`);
                setVideoProcessingProgress(0);
            }
        });

        const unsubscribeOpenPoseStatus = window.api.onOpenposeStatus((status) => {
            console.log('OpenPose Status:', status);
            setOpenPoseStatus(status);
            if (status.type === 'initializing') {
                setStatusMessage('Initializing OpenPose...');
            } else if (status.type === 'initialized') {
                setStatusMessage(`OpenPose Initialized. GPU: ${status.data.gpu ? 'Detected' : 'Not Detected (CPU only)'}`);
            } else if (status.type === 'progress' && status.data.type === 'frame-progress') {
                setStatusMessage(`OpenPose Processing: Frame ${status.data.current}/${status.data.total} (${status.data.percent.toFixed(1)}%)`);
                setVideoProcessingProgress(status.data.percent || 0);
            } else if (status.type === 'complete') {
                setStatusMessage('OpenPose Processing Complete!');
                setVideoProcessingProgress(100);
            } else if (status.type === 'error') {
                setStatusMessage(`OpenPose Error: ${status.data}`);
                alert(`OpenPose Error: ${status.data}`);
                setVideoProcessingProgress(0);
            }
        });

        // NEW: Listener for playback transcoding progress
        const unsubscribeTranscodeProgress = window.api.onTranscodePlaybackProgress((progress) => {
            setTranscodeProgress(progress.percent || 0);
            setStatusMessage(`Preparing video for playback: ${progress.percent.toFixed(1)}%`);
        });


        return () => {
            unsubscribeVideoStatus();
            unsubscribeOpenPoseStatus();
            unsubscribeTranscodeProgress(); // Cleanup new listener
        };
    }, []);

    // UPDATED: Effect to create and revoke Object URL for video playback
    useEffect(() => {
        const createAndSetObjectURL = async () => {
            if (videoPathForPlayback) { // Use videoPathForPlayback here
                // Revoke old URL before creating a new one if it exists
                if (currentVideoObjectURLRef.current) {
                    URL.revokeObjectURL(currentVideoObjectURLRef.current);
                    currentVideoObjectURLRef.current = '';
                }

                try {
                    // Call the main process to read the transcoded file's content
                    const fileBuffer = await window.api.readLocalFile(videoPathForPlayback);
                    
                    // Now we know it's an MP4, so we can hardcode the MIME type
                    const blob = new Blob([fileBuffer], { type: 'video/mp4' }); 
                    
                    currentVideoObjectURLRef.current = URL.createObjectURL(blob);
                    setVideoObjectURL(currentVideoObjectURLRef.current);
                    setTranscodeProgress(0); // Reset progress after successful load
                } catch (error) {
                    console.error('Error creating video object URL from transcoded file:', error);
                    setVideoObjectURL(''); // Clear URL on error
                    currentVideoObjectURLRef.current = ''; // Clear ref on error
                    setStatusMessage(`Error loading transcoded video for playback: ${error.message}. Please select another file.`);
                    setTranscodeProgress(0); // Reset progress on error
                }
            } else {
                // If videoPathForPlayback is cleared, revoke any existing object URL
                if (currentVideoObjectURLRef.current) {
                    URL.revokeObjectURL(currentVideoObjectURLRef.current);
                    currentVideoObjectURLRef.current = '';
                }
                setVideoObjectURL('');
            }
        };

        createAndSetObjectURL();

        return () => {
            // Clean up the object URL when the component unmounts or dependencies change
            if (currentVideoObjectURLRef.current) {
                URL.revokeObjectURL(currentVideoObjectURLRef.current);
                currentVideoObjectURLRef.current = '';
            }
        };
    }, [videoPathForPlayback]); // IMPORTANT: Depend on videoPathForPlayback now!


    const handleFileSelect = async () => {
        try {
            const filePath = await window.api.selectVideoFile();
            if (filePath) {
                setVideoPath(filePath); // Store the original path
                setStatusMessage(`Selected video: ${videoBasename || filePath}`); // Use videoBasename

                // Get video metadata (duration)
                const result = await window.api.getVideoMetadata(filePath);
                if (result.success) {
                    setVideoDuration(result.metadata.duration);
                    setStartTime(0);
                    setEndTime(result.metadata.duration); // Default to full duration

                    setStatusMessage('Video selected. Preparing for playback preview (transcoding)...');
                    setTranscodeProgress(0); // Reset transcode progress

                    // NEW: Call the IPC handler to transcode the video for playback
                    const transcodeResult = await window.api.transcodeForPlayback(filePath);
                    if (transcodeResult.success) {
                        setVideoPathForPlayback(transcodeResult.tempFilePath); // Set the path to the transcoded file
                        // The `useEffect` above will now trigger to load this new path
                        setStatusMessage(`Video loaded. Duration: ${formatTime(result.metadata.duration)}. Playback ready.`);
                    } else {
                        setStatusMessage(`Error preparing video for playback: ${transcodeResult.error}`);
                        alert(`Error preparing video for playback: ${transcodeResult.error}`);
                        setVideoPath(''); // Clear original path on error
                        setVideoPathForPlayback(''); // Clear playback path on error
                    }
                } else {
                    setStatusMessage(`Error getting video duration: ${result.error}`);
                    alert(`Error getting video duration: ${result.error}`);
                    setVideoPath(''); // Clear video path on error
                    setVideoPathForPlayback(''); // Clear playback path on error
                }
            } else {
                setStatusMessage('File selection cancelled.');
            }
        } catch (error) {
            console.error('Error selecting video file:', error);
            setVideoPath(''); // Clear path on error
            setVideoPathForPlayback(''); // Clear playback path on error
            setVideoObjectURL(''); // Clear URL on error
            setVideoDuration(0);
            setStartTime(0);
            setEndTime(0);
            setStatusMessage(`Error getting file path: ${error.message}`);
        }
    };

    // NOTE: handleProcessVideo should still use the ORIGINAL videoPath
    const handleProcessVideo = async () => {
        if (!videoPath) { // Use the original videoPath here
            alert('Please select a video first.');
            return;
        }
        if (endTime <= startTime) {
            alert('End time must be greater than start time.');
            return;
        }

        try {
            setStatusMessage('Initiating video processing...');
            setVideoProcessingProgress(0);
            setIsPlaying(false); // Pause video during processing
            if (videoRef.current) {
                videoRef.current.pause();
            }
            // Pass the ORIGINAL videoPath for processing
            await window.api.processVideo({ filePath: videoPath, startTime, endTime });
            // Status messages will be updated via IPC listeners
        } catch (error) {
            console.error('Error processing video:', error);
            setStatusMessage(`Processing failed: ${error.message}`);
            alert(`Video processing failed: ${error.message}`);
        }
    };

    // Video player controls
    const togglePlayPause = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(error => {
                console.error('Error playing video:', error);
                setStatusMessage(`Playback error: ${error.message}. Try another video or check format.`);
            });
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleSeek = (e) => {
        if (videoRef.current) {
            videoRef.current.currentTime = parseFloat(e.target.value);
            setCurrentTime(parseFloat(e.target.value));
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            // If duration was already set by ffprobe, use it. Otherwise, use video element's.
            if (videoDuration === 0 || Math.abs(videoDuration - videoRef.current.duration) > 0.1) {
                setVideoDuration(videoRef.current.duration);
                setEndTime(videoRef.current.duration);
            }
            setCurrentTime(0); 
        }
    };

    // Helper functions (formatTime, timeToSeconds, secondsToHMS) remain the same
    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return "00:00";
        const totalSeconds = Math.floor(seconds); 
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    const timeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        let seconds = 0;
        if (parts.length === 3) { 
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 1) {
            seconds = parts[0];
        }
        return isNaN(seconds) ? 0 : seconds;
    };

    const secondsToHMS = (totalSeconds) => {
        if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        
        if (hours > 0) {
            return [hours, minutes, seconds]
                .map(v => String(v).padStart(2, '0'))
                .join(":");
        } else {
            return [minutes, seconds]
                .map(v => String(v).padStart(2, '0'))
                .join(":");
        }
    };


    const handleStartTimeChange = (e) => {
        let val = timeToSeconds(e.target.value);
        if (val < 0) val = 0;
        if (val > videoDuration) val = videoDuration; 
        if (val > endTime) val = endTime; 
        setStartTime(val);
        if (videoRef.current) videoRef.current.currentTime = val; 
    };

    const handleEndTimeChange = (e) => {
        let val = timeToSeconds(e.target.value);
        if (val < 0) val = 0;
        if (val > videoDuration) val = videoDuration; 
        if (val < startTime) val = startTime; 
        setEndTime(val);
        if (videoRef.current) videoRef.current.currentTime = val; 
    };


    return (
        <div className="video-input-panel">
            <h2>Video Input & Processing</h2>

            <div className="file-selection">
                <button onClick={handleFileSelect}>
                    <FontAwesomeIcon icon={faVideo} /> Select Video
                </button>
                {/* Display videoBasename here */}
                {videoPath && <span className="selected-path">Selected: {videoBasename || videoPath}</span>}
            </div>

            {videoObjectURL && (
                <div className="video-player-container">
                    <video
                        ref={videoRef}
                        src={videoObjectURL} 
                        controls={false} 
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        onError={(e) => { 
                            console.error('Video element error:', e.target.error);
                            setStatusMessage(`Video playback error: ${e.target.error?.message || 'Unknown error'}. Check console for details.`);
                        }}
                        className="video-player"
                    ></video>
                    <div className="custom-controls">
                        <button onClick={togglePlayPause}>
                            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                        </button>
                        <input
                            type="range"
                            min="0"
                            max={videoDuration}
                            step="0.01"
                            value={currentTime}
                            onChange={handleSeek}
                            className="playback-slider"
                        />
                        <span className="time-display">
                            {formatTime(currentTime)} / {formatTime(videoDuration)}
                        </span>
                    </div>

                    <div className="timeframe-selection">
                        <div className="time-input-group">
                            <label>Start Time:</label>
                            <input
                                type="text"
                                value={secondsToHMS(startTime)}
                                onChange={handleStartTimeChange}
                                placeholder="HH:MM:SS or MM:SS"
                            />
                            <button onClick={() => { 
                                const newStartTime = Math.floor(currentTime);
                                setStartTime(newStartTime); 
                                if (videoRef.current) videoRef.current.currentTime = newStartTime; 
                            }}>
                                Set Current <FontAwesomeIcon icon={faPlay} />
                            </button>
                        </div>
                        <div className="time-input-group">
                            <label>End Time:</label>
                            <input
                                type="text"
                                value={secondsToHMS(endTime)}
                                onChange={handleEndTimeChange}
                                placeholder="HH:MM:SS or MM:SS"
                            />
                            <button onClick={() => { 
                                const newEndTime = Math.floor(currentTime);
                                setEndTime(newEndTime); 
                                if (videoRef.current) videoRef.current.currentTime = newEndTime; 
                            }}>
                                Set Current <FontAwesomeIcon icon={faPlay} />
                            </button>
                        </div>
                        <p>Selected Range: {formatTime(startTime)} - {formatTime(endTime)} ({formatTime(endTime - startTime)})</p>
                    </div>
                </div>
            )}

            <div className="processing-section">
                <button
                    onClick={handleProcessVideo}
                    disabled={!videoPath}
                    className="process-button"
                >
                    <FontAwesomeIcon icon={faCrop} /> Process Video (OpenPose)
                </button>
                
                {/* Display transcoding progress if active */}
                {transcodeProgress > 0 && transcodeProgress < 100 && (
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${transcodeProgress}%`, backgroundColor: '#4CAF50' }}></div>
                        <p>Transcoding for Playback: {transcodeProgress.toFixed(1)}%</p>
                    </div>
                )}

                {videoProcessingProgress > 0 && videoProcessingProgress <= 100 && (
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${videoProcessingProgress}%` }}></div>
                    </div>
                )}
                <p className="status-message">Status: {statusMessage}</p>
                {openPoseStatus.type === 'progress' && openPoseStatus.data.type !== 'frame-progress' && (
                    <pre className="openpose-raw-output">{openPoseStatus.data.data}</pre>
                )}
            </div>
        </div>
    );
};

export default VideoInputPanel;