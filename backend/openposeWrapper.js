const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class OpenPoseWrapper extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      openposePath: config.openposePath || path.resolve(__dirname, '../../../bin/openpose-1.7.0-binaries-win64-gpu'),
      outputDir: config.outputDir || path.resolve(__dirname, '../../../output/keypoints'),
      modelPath: config.modelPath || 'BODY_25',
      gpu: config.gpu || 'auto',
      confidence: config.confidence || 0.6,
      maxRetries: config.maxRetries || 3
    };
    
    this.process = null;
    this.initialized = false;
    this.gpuInfo = null;
  }

  async validateInstallation() {
    const exePath = path.join(this.config.openposePath, 'bin', 'OpenPoseDemo.exe');
    const modelPath = path.join(this.config.openposePath, 'models');
    
    if (!fs.existsSync(exePath)) {
      throw new Error(`OpenPose executable not found at: ${exePath}`);
    }

    if (!fs.existsSync(modelPath)) {
      throw new Error(`OpenPose models not found at: ${modelPath}`);
    }
    
    return true;
  }

  async detectGPU() {
    try {
      const nvidia = await this.checkNvidiaGPU();
      if (nvidia) {
        this.gpuInfo = { type: 'NVIDIA', ...nvidia };
        return this.gpuInfo;
      }

      const amd = await this.checkAMDGPU();
      if (amd) {
        this.gpuInfo = { type: 'AMD', ...amd };
        return this.gpuInfo;
      }

      return null;
    } catch (error) {
      console.warn('GPU detection failed:', error);
      return null;
    }
  }

  async checkNvidiaGPU() {
    return new Promise((resolve) => {
      const nvidiaSmi = spawn('nvidia-smi', ['-L']);
      let output = '';

      nvidiaSmi.stdout.on('data', (data) => {
        output += data.toString();
      });

      nvidiaSmi.on('close', (code) => {
        if (code === 0 && output.toLowerCase().includes('gpu')) {
          resolve({ available: true, info: output.trim() });
        } else {
          resolve(null);
        }
      });

      nvidiaSmi.on('error', () => resolve(null));
    });
  }

  async checkAMDGPU() {
    // Simplified AMD detection - could be enhanced
    return new Promise((resolve) => {
      const dxdiag = spawn('dxdiag', ['/t', 'temp_dxdiag.txt']);
      
      dxdiag.on('close', async () => {
        try {
          const data = await fs.promises.readFile('temp_dxdiag.txt', 'utf8');
          const isAMD = data.includes('AMD') || data.includes('Radeon');
          await fs.promises.unlink('temp_dxdiag.txt');
          resolve(isAMD ? { available: true } : null);
        } catch {
          resolve(null);
        }
      });

      dxdiag.on('error', () => resolve(null));
    });
  }

  async initialize() {
    try {
      await this.validateInstallation();
      const gpu = await this.detectGPU();
      
      if (!gpu) {
        console.warn('No GPU detected, falling back to CPU mode');
        this.config.gpu = 'CPU';
      } else {
        this.config.gpu = gpu.type;
      }
      
      this.initialized = true;
      this.emit('initialized', { gpu: this.config.gpu, gpuInfo: this.gpuInfo });
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  buildArguments(inputSource, options = {}) {
    const args = [
      '--model_pose', this.config.modelPath,
      '--video', inputSource,
      '--write_json', this.config.outputDir,
      '--display', options.display ? '1' : '0',
      '--render_pose', options.renderPose ? '1' : '0',
      '--number_people_max', options.maxPeople || '1',
      '--net_resolution', options.netResolution || '320x176'
    ];

    if (this.config.gpu === 'CPU') {
      args.push('--disable_multi_thread');
    }

    return args;
  }

  attachEventHandlers() {
    if (!this.process) return;

    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      this.emit('progress', { type: 'stdout', data: output });
      
      if (output.includes('Processing frame')) {
        const match = output.match(/Processing frame (\d+)/);
        if (match) {
          this.emit('frame', parseInt(match[1]));
        }
      }
    });

    this.process.stderr.on('data', (data) => {
      this.emit('progress', { type: 'stderr', data: data.toString() });
    });

    this.process.on('close', (code) => {
      this.emit('complete', { code });
      this.process = null;
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
      this.cleanup();
    });
  }

  async runOpenPose(inputSource, options = {}) {
    if (!this.initialized) {
      throw new Error('OpenPoseWrapper not initialized');
    }

    try {
      await fs.promises.mkdir(this.config.outputDir, { recursive: true });

      const args = this.buildArguments(inputSource, options);
      const exePath = path.join(this.config.openposePath, 'bin', 'OpenPoseDemo.exe');
      
      this.process = spawn(exePath, args, { cwd: this.config.openposePath });
      this.attachEventHandlers();
      
      return this.process;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  cleanup() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

module.exports = OpenPoseWrapper;