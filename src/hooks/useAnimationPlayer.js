import { useEffect, useRef, useState } from 'react';
const { loadPoseSequence } = require('../helpers/poseSequenceLoader');

export function useAnimationPlayer(fps = 30) {
  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef(null);

  // Load all frames once
  useEffect(() => {
    const data = loadPoseSequence();
    setFrames(data);
    setCurrentFrame(data[0]?.keypoints || null);
  }, []);

  // Play animation loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    intervalRef.current = setInterval(() => {
      setFrameIndex(prev => {
        const next = (prev + 1) % frames.length;
        setCurrentFrame(frames[next]?.keypoints || null);
        return next;
      });
    }, 1000 / fps);

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, fps, frames]);

  const reset = () => {
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    setFrameIndex(0);
    setCurrentFrame(frames[0]?.keypoints || null);
  };

  return {
    currentFrame,
    isPlaying,
    setIsPlaying,
    reset,
    frameIndex,
    fps,
    totalFrames: frames.length
  };
}
