const ffmpeg = require('./helpers/ffmpegHelper'); // Import the FFmpeg configuration

// Function to clip the video based on start and end time
const clipVideo = (inputPath, startTime, endTime, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime) // Set the start time for the clip
      .setDuration(endTime - startTime) // Set the duration of the clip
      .output(outputPath) // Define where to save the clipped video
      .on('end', () => {
        console.log('Video clipped successfully!');
        resolve(outputPath); // Resolve with the output path
      })
      .on('error', (err) => {
        console.error('Error clipping video:', err);
        reject(err); // Reject if there's an error
      })
      .run(); // Run the FFmpeg process
  });
};

module.exports = { clipVideo };
