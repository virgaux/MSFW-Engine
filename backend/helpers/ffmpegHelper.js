// backend/helpers/ffmpegHelper.js
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');
const { app } = require('electron'); // IMPORTANT: Ensure 'app' is imported from 'electron'

let ffmpegPath;
let ffprobePath;

// Determine paths based on whether the app is packaged (distributed) or in development
if (app.isPackaged) {
    // For a packaged (built) Electron application:
    // Binaries unpacked by electron-builder go into app.asar.unpacked inside process.resourcesPath
    ffmpegPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    // ffprobe-static has its own internal structure for binaries
    ffprobePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static', 'bin', process.platform === 'win32' ? 'win32' : process.platform, process.arch, 'ffprobe.exe');
} else {
    // For development:
    // Try to use ffmpeg-static's auto-detected path first.
    // If it's still undefined (which has been the issue), fall back to a direct node_modules path relative to this file.
    ffmpegPath = ffmpegStatic.path;
    ffprobePath = ffprobeStatic.path;

    if (!ffmpegPath) {
        console.warn('[FFmpeg Helper] ffmpeg-static.path was undefined in development. Falling back to direct node_modules path.');
        // Path relative to backend/helpers/ffmpegHelper.js to node_modules/ffmpeg-static/ffmpeg.exe
        ffmpegPath = path.join(__dirname, '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    }
    if (!ffprobePath) {
        console.warn('[FFmpeg Helper] ffprobe-static.path was undefined in development. Falling back to direct node_modules path.');
        // Path relative to backend/helpers/ffmpegHelper.js to node_modules/ffprobe-static/bin/[platform]/[arch]/ffprobe.exe
        ffprobePath = path.join(__dirname, '..', '..', 'node_modules', 'ffprobe-static', 'bin', process.platform === 'win32' ? 'win32' : process.platform, process.arch, 'ffprobe.exe');
    }
}

// Set the determined paths for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// console.log(`[FFmpeg Helper] FFmpeg path set to: ${ffmpegPath}`);
// console.log(`[FFmpeg Helper] FFprobe path set to: ${ffprobePath}`);
/**
 * Clips a video based on start and end times.
 * @param {string} inputPath - The path to the input video file.
 * @param {number} startTime - The start time in seconds.
 * @param {number} endTime - The end time in seconds.
 * @param {string} outputPath - The desired output path for the clipped video.
 * @param {function} progressCallback - A callback function (progress) => void to report progress.
 * @returns {Promise<string>} A promise that resolves with the outputPath on success.
 */
const clipVideo = (inputPath, startTime, endTime, outputPath, progressCallback) => {
    return new Promise((resolve, reject) => {
        const duration = endTime - startTime;
        if (duration <= 0) {
            return reject(new Error('End time must be greater than start time.'));
        }

        ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(duration)
            .output(outputPath)
            .on('progress', (progress) => {
                if (progressCallback) {
                    progressCallback(progress);
                }
            })
            .on('end', () => {
                console.log('[ffmpegHelper] Video clipped successfully!');
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('[ffmpegHelper] Error clipping video:', err.message);
                console.error('[ffmpegHelper] FFmpeg stdout:', stdout);
                console.error('[ffmpegHelper] FFmpeg stderr:', stderr);
                reject(new Error(`Error clipping video: ${err.message}`));
            })
            .run();
    });
};

/**
 * Transcodes a video to a web-friendly MP4 format for playback.
 * @param {string} inputPath - The path to the input video file.
 * @param {string} outputPath - The desired output path for the transcoded video.
 * @param {function} progressCallback - Optional callback for progress updates.
 * @returns {Promise<string>} A promise that resolves with the outputPath on success.
 */
const transcodeVideo = (inputPath, outputPath, progressCallback) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .format('mp4')
            .output(outputPath)
            .on('progress', (progress) => {
                if (progressCallback) {
                    progressCallback(progress);
                }
            })
            .on('end', () => {
                console.log(`[ffmpegHelper] Transcoding for playback complete: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                console.error(`[ffmpegHelper] Error transcoding ${inputPath} for playback:`, err.message);
                console.error('FFmpeg stdout:', stdout);
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`Transcoding for playback failed: ${err.message}`));
            })
            .run();
    });
};

// Export the specific functions, not the ffmpeg instance
module.exports = { clipVideo, transcodeVideo };