const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// Set FFmpeg path using the ffmpeg-static module
ffmpeg.setFfmpegPath(ffmpegPath);

// You can export the ffmpeg instance for use in other modules
module.exports = ffmpeg;
