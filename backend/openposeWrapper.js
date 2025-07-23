// backend/helpers/openposeWrapper.js
const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs/promises');

class OpenPoseWrapper extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // These properties will now be provided from main.js during instantiation
            openposeBasePath: config.openposeBasePath || './openpose', 
            userDataPath: config.userDataPath,         // path from app.getPath('userData')
            
            // Use the provided userDataPath for the default output directory
            outputDir: config.outputDir || path.join(config.userDataPath, 'openpose_output'),
            
            // Default OpenPose parameters
            modelPose: 'BODY_25',
            netResolution: '-1x368', // Adjust as needed, e.g., '656x368' or '-1x368'
            display: 0, // 0 for no display, 1 for display
            renderPose: 0, // 0 for no rendering, 1 for rendering (CPU)
            face: false, // Include face keypoints
            hand: false, // Include hand keypoints
            processFps: 0, // 0 for original FPS, specify a number to limit
            openposeArgs: [], // To store CPU only or other arguments determined during initialization
        };
        this.process = null;
        this.gpuInfo = 'Detecting...';
        this.status = 'initializing'; // Status for the wrapper's own state
    }

    async initialize() {
        if (this.status === 'initialized') {
            console.log('[OpenPoseWrapper] Already initialized.');
            return;
        }

        this.emit('progress', { type: 'stdout', data: 'Initializing OpenPose wrapper and detecting GPU...' });

        // Use the baseOpenPosePath passed from main.js
        const baseOpenPoseDir = this.config.openposeBasePath;

        // Construct full paths to executable and models folder
        this.config.openposeExecutablePath = path.join(baseOpenPoseDir, 'bin', process.platform === 'win32' ? 'OpenPoseDemo.exe' : 'openpose');
        this.config.openposeModelsPath = path.join(baseOpenPoseDir, 'models');

        // Ensure output directory for keypoints exists
        await fs.mkdir(this.config.outputDir, { recursive: true });

        // --- Check for OpenPose executable existence using fs.stat ---
        try {
            const stats = await fs.stat(this.config.openposeExecutablePath);
            if (!stats.isFile()) {
                throw new Error(`Path exists but is not a file: ${this.config.openposeExecutablePath}`);
            }
            console.log(`[OpenPoseWrapper] OpenPose executable found at: ${this.config.openposeExecutablePath}`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`[OpenPoseWrapper] OpenPose executable NOT found (ENOENT error) at: ${this.config.openposeExecutablePath}`);
            } else {
                console.error(`[OpenPoseWrapper] Error checking OpenPose executable at ${this.config.openposeExecutablePath}:`, error);
                // Log the specific error code and message for better debugging
                console.error(`[OpenPoseWrapper] Error Code: ${error.code || 'N/A'}`);
                console.error(`[OpenPoseWrapper] Error Message: ${error.message}`);
            }
            throw new Error(`OpenPose executable not found or inaccessible. Please check the path: ${this.config.openposeExecutablePath} (Error: ${error.message})`);
        }

        // --- Check for models folder existence using fs.stat ---
        try {
            const stats = await fs.stat(this.config.openposeModelsPath);
            if (!stats.isDirectory()) {
                throw new Error(`Models path exists but is not a directory: ${this.config.openposeModelsPath}`);
            }
            console.log(`[OpenPoseWrapper] OpenPose models folder found at: ${this.config.openposeModelsPath}`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`[OpenPoseWrapper] OpenPose models folder NOT found (ENOENT error) at: ${this.config.openposeModelsPath}`);
            } else {
                console.error(`[OpenPoseWrapper] Error checking OpenPose models folder at ${this.config.openposeModelsPath}:`, error);
                console.error(`[OpenPoseWrapper] Error Code: ${error.code || 'N/A'}`);
                console.error(`[OpenPoseWrapper] Error Message: ${error.message}`);
            }
            throw new Error(`OpenPose models folder not found or inaccessible. Please ensure models are downloaded to: ${this.config.openposeModelsPath} (Error: ${error.message})`);
        }

        // --- GPU Detection Logic (your existing code, it should now work with proper paths) ---
        this.emit('progress', { type: 'stdout', data: 'Attempting to detect GPU...' });
        console.log('[OpenPoseWrapper] Attempting to detect GPU (this may take a moment)...');
        try {
            const dummyDir = path.join(this.config.userDataPath, 'msfw_openpose_dummy_dir'); // Use passed userDataPath
            await fs.mkdir(dummyDir, { recursive: true });

            const gpuDetectArgs = [
                '--num_gpu', '-1', // Try to auto-detect GPUs
                '--no_display',
                '--disable_multi_thread',
                '--logging_level', '255', // Suppress most output
                '--render_pose', '0',
                '--process_real_time', // Process one frame and exit
                '--image_dir', dummyDir, // Use a dummy empty folder
                '--model_folder', this.config.openposeModelsPath // Ensure models path is provided for dummy run
            ];

            const gpuProcess = spawn(this.config.openposeExecutablePath, gpuDetectArgs, { cwd: baseOpenPoseDir });
            let gpuOutput = '';
            let gpuError = '';

            gpuProcess.stdout.on('data', (data) => { gpuOutput += data.toString(); });
            gpuProcess.stderr.on('data', (data) => { gpuError += data.toString(); });

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    gpuProcess.kill('SIGKILL'); // Force kill if it hangs
                    reject(new Error('GPU detection timed out. Forcing CPU mode.'));
                }, 15000); // 15 seconds timeout for GPU detection

                gpuProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 0 || code === 1) { // OpenPose often exits with 1 even on successful GPU check if no real input
                        resolve();
                    } else {
                        reject(new Error(`GPU detection failed with code ${code}: ${gpuError}`));
                    }
                });
                gpuProcess.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

            if (gpuOutput.includes('Starting OpenPose')) {
                if (gpuOutput.includes('CUDA')) {
                    this.config.gpuMode = true;
                    this.gpuInfo = 'GPU (CUDA) detected.';
                    if (gpuOutput.includes('No GPU found')) {
                        this.config.gpuMode = false;
                        this.gpuInfo = 'CPU only (No CUDA GPU found)';
                        this.config.openposeArgs = ['--cpu_only'];
                    }
                } else if (gpuOutput.includes('CPU only mode') || gpuOutput.includes('No GPU detected')) {
                    this.config.gpuMode = false;
                    this.gpuInfo = 'CPU only (No CUDA GPU found)';
                    this.config.openposeArgs = ['--cpu_only'];
                } else {
                    this.config.gpuMode = true;
                    this.gpuInfo = 'GPU (status unknown, check logs for details)';
                }
            } else if (gpuError.includes('CUDA_ERROR_NO_DEVICE')) {
                this.config.gpuMode = false;
                this.gpuInfo = 'CPU only (CUDA device not found)';
                this.config.openposeArgs = ['--cpu_only'];
            } else {
                this.config.gpuMode = false;
                this.gpuInfo = `CPU only (Unknown GPU detection error: ${gpuError.substring(0, Math.min(gpuError.length, 100))}...)`;
                this.config.openposeArgs = ['--cpu_only'];
            }
            console.log(`[OpenPoseWrapper] GPU detection result: ${this.gpuInfo}`);
            this.emit('progress', { type: 'stdout', data: `GPU detection complete: ${this.gpuInfo}` });

            await fs.rm(dummyDir, { recursive: true, force: true });

        } catch (err) {
            console.error('[OpenPoseWrapper] Error during GPU detection:', err.message);
            this.config.gpuMode = false;
            this.gpuInfo = `CPU only (Error during detection: ${err.message})`;
            this.config.openposeArgs = ['--cpu_only'];
            this.emit('progress', { type: 'stderr', data: `Error during GPU detection: ${err.message}` });
        }
        this.status = 'initialized';
    }

    async runOpenPose(videoInputPath, options = {}) {
        if (this.process) {
            this.emit('error', new Error('OpenPose is already running. Please wait or stop the current process.'));
            return { success: false, message: 'OpenPose is already running.' };
        }
        if (this.status !== 'initialized') {
             this.emit('error', new Error('OpenPose wrapper not initialized. Call .initialize() first.'));
             return { success: false, message: 'OpenPose wrapper not initialized.' };
        }

        this.emit('start', 'Starting OpenPose processing...');

        const args = [
            '--video', videoInputPath,
            '--write_json', this.config.outputDir,
            '--render_pose', options.renderPose !== undefined ? options.renderPose : this.config.renderPose,
            '--display', options.display !== undefined ? options.display : this.config.display,
            '--model_pose', this.config.modelPose,
            '--net_resolution', this.config.netResolution,
            ...(this.config.face ? ['--face'] : []),
            ...(this.config.hand ? ['--hand'] : []),
            ...(this.config.processFps > 0 ? ['--process_fps', this.config.processFps] : []),
            ...(this.config.openposeArgs || []), // Add CPU only or other args from initialization
            '--logging_level', '3', // Reduce verbosity for normal operation
            '--model_folder', this.config.openposeModelsPath // IMPORTANT: Pass models folder for actual run
        ];

        // Filter out any undefined or empty string arguments
        const filteredArgs = args.filter(arg => arg !== '' && arg !== undefined);

        console.log(`[OpenPose] Spawning: "${this.config.openposeExecutablePath}" ${filteredArgs.join(' ')}`);

        // Determine the current working directory for the OpenPose process
        // This should be the base 'openpose' folder (e.g., MSFW_Engine_Clean/openpose)
        const baseOpenPoseCwd = path.dirname(path.dirname(this.config.openposeExecutablePath)); // Go up two levels from executable path (bin/OpenPoseDemo.exe)

        this.process = spawn(this.config.openposeExecutablePath, filteredArgs, { cwd: baseOpenPoseCwd });

        // Wrap the event listeners in a Promise to signal completion/error back to the caller
        return new Promise((resolve, reject) => {
            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                this.emit('progress', { type: 'stdout', data: output });

                // Example parsing for frame progress
                const frameMatch = output.match(/Processed (\d+) of (\d+) frames/);
                if (frameMatch) {
                    const currentFrame = parseInt(frameMatch[1], 10);
                    const totalFrames = parseInt(frameMatch[2], 10);
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
                this.process = null; // Clear the process reference
                if (code === 0) {
                    this.emit('complete', { code });
                    resolve({ success: true, message: 'OpenPose processing complete.' });
                } else {
                    const errorMessage = `OpenPose process exited with code ${code}. Check console for details.`;
                    this.emit('error', new Error(errorMessage));
                    reject(new Error(errorMessage));
                }
            });

            this.process.on('error', (err) => {
                console.error('[OpenPose] Failed to start process:', err);
                this.process = null;
                const errorMessage = `Failed to start OpenPose process: ${err.message}`;
                this.emit('error', new Error(errorMessage));
                reject(new Error(errorMessage));
            });
        });
    }

    stop() {
        if (this.process) {
            console.log('[OpenPose] Attempting to stop process...');
            this.process.kill('SIGINT'); // Send interrupt signal (Ctrl+C)
            this.process = null;
            this.emit('cancelled', 'OpenPose processing cancelled.');
        }
    }
}

module.exports = { OpenPoseWrapper };