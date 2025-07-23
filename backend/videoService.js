// backend/videoService.js
const ffmpeg = require('fluent-ffmpeg'); // Import fluent-ffmpeg directly for ffprobe
const path = require('path');
const fs = require('fs/promises'); // For file system operations if needed by this service
const ffmpegHelper = require('./helpers/ffmpegHelper'); // Import ffmpegHelper for other operations

/**
 * Gets video metadata (e.g., duration, format) using ffprobe.
 * This function should reside in videoService.js as it's a direct metadata query.
 * @param {string} videoPath - The path to the video file.
 * @returns {Promise<object>} A promise that resolves with video metadata.
 */
const getVideoMetadata = (videoPath) => {
    return new Promise((resolve, reject) => {
        // Correct way to call ffprobe using the directly imported fluent-ffmpeg
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error(`[videoService] Error getting video metadata for ${videoPath}:`, err.message);
                return reject(new Error(`Failed to get video metadata: ${err.message}`));
            }
            console.log(`[videoService] Video metadata for ${videoPath}:`, metadata.format.duration);
            resolve({
                duration: metadata.format.duration, // Total duration in seconds
                format: metadata.format,
                streams: metadata.streams
            });
        });
    });
};

/**
 * Orchestrates video processing (e.g., clipping for OpenPose).
 * This function will use ffmpegHelper for actual ffmpeg operations.
 * You might have a `processVideo` function in main.js calling this.
 */
const processVideoForOpenPose = async ({ filePath, startTime, endTime }, progressCallback) => {
    try {
        // Example of calling clipVideo from ffmpegHelper
        // You'll need to define an outputPath for the clipped video
        const clippedOutputPath = path.join(path.dirname(filePath), `clipped_${path.basename(filePath)}`);
        
        console.log(`[videoService] Clipping video ${filePath} from ${startTime} to ${endTime}...`);
        // Use ffmpegHelper.clipVideo now
        const resultPath = await ffmpegHelper.clipVideo(filePath, startTime, endTime, clippedOutputPath, progressCallback);
        console.log(`[videoService] Video clipping complete: ${resultPath}`);
        return { success: true, outputPath: resultPath };
    } catch (error) {
        console.error('[videoService] Error processing video for OpenPose:', error);
        throw new Error(`Video processing failed: ${error.message}`);
    }
};

module.exports = {
    getVideoMetadata,
    processVideoForOpenPose // Export the processing function
};