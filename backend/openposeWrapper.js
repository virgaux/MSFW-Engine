// backend/helpers/openposeWrapper.js
const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs/promises'); // For path validation and directory creation

class OpenPoseWrapper extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            openposePath: config.openposePath || './openpose_binaries', // Base directory for OpenPose
            outputDir: config.outputDir || './output_keypoints', // Directory for OpenPose JSON output
            // Default OpenPose parameters
            modelPose: 'BODY_25', // 'BODY_25', 'COCO', 'MPI'
            netResolution: '-1x368', // Adjust as needed, e.g., '656x368' or '-1x368'
            display: 0, // 0 for no display, 1 for display
            renderPose: 0, // 0 for no rendering, 1 for rendering (CPU)
            face: false, // Include face keypoints
            hand: false, // Include hand keypoints
            processFps: 0, // 0 for original FPS, specify a number to limit
            // Add more parameters as needed
        };
        this.process = null;
        this.gpuInfo = 'Detecting...'; // Placeholder for GPU detection status
    }

    async initialize() {
        // Ensure output directory exists
        await fs.mkdir(this.config.outputDir, { recursive: true });

        // Basic check for OpenPose executable existence
        const openposeExecutable = process.platform === 'win32' ? 'OpenPoseDemo.exe' : 'openpose';
        const executablePath = path.join(this.config.openposePath, 'bin', openposeExecutable);

        try {
            await fs.access(executablePath, fs.constants.F_OK);
            console.log(`[OpenPoseWrapper] OpenPose executable found at: ${executablePath}`);
        } catch (error) {
            console.error(`[OpenPoseWrapper] OpenPose executable NOT found at: ${executablePath}`);
            throw new Error(`OpenPose executable not found. Please check the path: ${executablePath}`);
        }

        // Dummy run to detect GPU or check for CPU only mode
        // This is a more robust way to check for GPU support than parsing initial logs
        // This part can be resource-intensive, consider making it optional or cached.
        this.emit('progress', { type: 'stdout', data: 'Detecting GPU info...' });
        console.log('[OpenPoseWrapper] Attempting to detect GPU (this may take a moment)...');
        try {
            const gpuDetectArgs = [
                '--num_gpu', '-1', // Try to auto-detect GPUs
                '--no_display',
                '--disable_multi_thread',
                '--logging_level', '255', // Suppress most output
                '--render_pose', '0',
                '--process_real_time', // Process one frame and exit
                '--image_dir', path.join(__dirname, '../../empty_folder_for_gpu_detect'), // Use a dummy empty folder
                // Use a non-existent image directory to make it exit quickly if no GPU is found
            ];
             // Create a dummy empty folder for GPU detection to avoid errors
            await fs.mkdir(path.join(__dirname, '../../empty_folder_for_gpu_detect'), { recursive: true });


            const gpuProcess = spawn(executablePath, gpuDetectArgs, { cwd: this.config.openposePath });
            let gpuOutput = '';
            let gpuError = '';

            gpuProcess.stdout.on('data', (data) => { gpuOutput += data.toString(); });
            gpuProcess.stderr.on('data', (data) => { gpuError += data.toString(); });

            await new Promise((resolve, reject) => {
                gpuProcess.on('close', (code) => {
                    if (code === 0 || code === 1) { // OpenPose often exits with 1 even on successful GPU check if no real input
                        resolve();
                    } else {
                        reject(new Error(`GPU detection failed with code ${code}: ${gpuError}`));
                    }
                });
                gpuProcess.on('error', (err) => reject(err));
            });

            // Analyze output for GPU presence
            if (gpuOutput.includes('Starting OpenPose')) {
                // If OpenPose successfully started (even with dummy input), it means it found some config.
                // Look for CUDA or CPU only messages
                if (gpuOutput.includes('CUDA')) {
                    this.config.gpuMode = true;
                    this.gpuInfo = 'GPU (CUDA) detected.';
                    if (gpuOutput.includes('No GPU found')) {
                        // Sometimes CUDA is mentioned but no actual GPU found later
                         this.config.gpuMode = false;
                         this.gpuInfo = 'CPU only (No CUDA GPU found)';
                         this.config.openposeArgs = ['--cpu_only']; // Force CPU only if no GPU
                    }
                } else if (gpuOutput.includes('CPU only mode') || gpuOutput.includes('No GPU detected')) {
                    this.config.gpuMode = false;
                    this.gpuInfo = 'CPU only (No CUDA GPU found)';
                    this.config.openposeArgs = ['--cpu_only']; // Force CPU only if no GPU
                } else {
                    // Fallback if specific messages aren't caught
                    this.config.gpuMode = true; // Assume GPU if no explicit CPU-only message
                    this.gpuInfo = 'GPU (status unknown, check logs for details)';
                }
            } else if (gpuError.includes('CUDA_ERROR_NO_DEVICE')) {
                this.config.gpuMode = false;
                this.gpuInfo = 'CPU only (CUDA device not found)';
                this.config.openposeArgs = ['--cpu_only']; // Force CPU only if no GPU
            } else {
                this.config.gpuMode = false;
                this.gpuInfo = `CPU only (Unknown GPU detection error: ${gpuError.substring(0, 100)}...)`;
                this.config.openposeArgs = ['--cpu_only']; // Force CPU only if no GPU
            }
            console.log(`[OpenPoseWrapper] GPU detection result: ${this.gpuInfo}`);
            this.emit('progress', { type: 'stdout', data: `GPU detection complete: ${this.gpuInfo}` });

             // Clean up dummy folder
             await fs.rm(path.join(__dirname, '../../empty_folder_for_gpu_detect'), { recursive: true, force: true });

        } catch (err) {
            console.error('[OpenPoseWrapper] Error during GPU detection:', err.message);
            this.config.gpuMode = false;
            this.gpuInfo = `CPU only (Error during detection: ${err.message})`;
            this.config.openposeArgs = ['--cpu_only']; // Force CPU only on error
            this.emit('progress', { type: 'stderr', data: `Error during GPU detection: ${err.message}` });
        }
    }


    async runOpenPose(videoInputPath, options = {}) {
        if (this.process) {
            this.emit('error', new Error('OpenPose is already running. Please wait or stop the current process.'));
            return;
        }

        const args = [
            '--video', videoInputPath,
            '--write_json', this.config.outputDir,
            '--render_pose', options.renderPose !== undefined ? options.renderPose : this.config.renderPose,
            '--display', options.display !== undefined ? options.display : this.config.display,
            '--model_pose', this.config.modelPose,
            '--net_resolution', this.config.netResolution,
            // Add other configurable options here
            ...(this.config.face ? ['--face'] : []),
            ...(this.config.hand ? ['--hand'] : []),
            ...(this.config.processFps > 0 ? ['--process_fps', this.config.processFps] : []),
            ...(this.config.openposeArgs || []), // Add CPU only or other args from initialization
            // Add specific logging level for production to reduce stdout verbosity
            '--logging_level', '3' // 0: All, 1: Trace, 2: Debug, 3: Info, 4: Warn, 5: Error, 6: Fatal, 255: No Logging
        ];

        // Filter out empty strings or undefined values from args array
        const filteredArgs = args.filter(arg => arg !== '' && arg !== undefined);

        const openposeExecutable = process.platform === 'win32' ? 'OpenPoseDemo.exe' : 'openpose';
        const executablePath = path.join(this.config.openposePath, 'bin', openposeExecutable);

        console.log(`[OpenPose] Spawning: ${executablePath} ${filteredArgs.join(' ')}`);

        this.process = spawn(executablePath, filteredArgs, { cwd: this.config.openposePath });

        let totalFrames = 0; // Will be determined from OpenPose output
        let currentFrame = 0;

        this.process.stdout.on('data', (data) => {
            const output = data.toString();
            this.emit('progress', { type: 'stdout', data: output });

            // Example parsing for progress
            const frameMatch = output.match(/Processed (\d+) of (\d+) frames/);
            if (frameMatch) {
                currentFrame = parseInt(frameMatch[1], 10);
                totalFrames = parseInt(frameMatch[2], 10);
                const percent = (currentFrame / totalFrames) * 100;
                this.emit('progress', { type: 'frame-progress', data: { current: currentFrame, total: totalFrames, percent } });
            }
        });

        this.process.stderr.on('data', (data) => {
            const output = data.toString();
            this.emit('progress', { type: 'stderr', data: output });
            console.error(`[OpenPose stderr] ${output}`);
        });

        this.process.on('close', (code) => {
            console.log(`[OpenPose] Process exited with code: ${code}`);
            this.process = null; // Clear the process
            if (code === 0) {
                this.emit('complete', { code });
            } else {
                this.emit('error', new Error(`OpenPose process exited with code ${code}. Check console for details.`));
            }
        });

        this.process.on('error', (err) => {
            console.error('[OpenPose] Failed to start process:', err);
            this.process = null;
            this.emit('error', new Error(`Failed to start OpenPose process: ${err.message}`));
        });
    }

    stop() {
        if (this.process) {
            console.log('[OpenPose] Attempting to stop process...');
            this.process.kill('SIGINT'); // Or 'SIGTERM'
            this.process = null;
        }
    }
}

module.exports = { OpenPoseWrapper };