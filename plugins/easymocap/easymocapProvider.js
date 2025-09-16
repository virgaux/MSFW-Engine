// EasyMocap Capture Provider for MSFW Engine
// Exposes a small API the core app can call:
//  - detect()
//  - processVideo(jobOptions)
//  - cancel(jobId)

const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const path = require("path");
const fs = require("fs");
const pyExe = (opts && opts.pythonPath) ? opts.pythonPath : (process.platform === 'win32' ? 'python' : 'python3');
const child = spawn(pyExe, [bridgePath, ...args], { cwd: this.pluginRoot, env: pyEnv, stdio: ['ignore','pipe','pipe'] });

class EasyMocapProvider extends EventEmitter {
  constructor(pluginRoot) {
    super();
    this.pluginRoot = pluginRoot || __dirname;
    this.active = new Map(); // jobId -> child
  }

  getMeta() {
    const pluginJson = path.resolve(this.pluginRoot, "plugin.json");
    const meta = JSON.parse(fs.readFileSync(pluginJson, "utf-8"));
    return meta;
  }

  async detect() {
    // Shallow check: does bridge exist?
    try {
      const meta = this.getMeta();
      const bridge = path.resolve(this.pluginRoot, meta.bridge);
      return fs.existsSync(bridge);
    } catch (_) {
      return false;
    }
  }

  /**
   * Process a capture job
   * @param {Object} opts
   *  - jobId: string
   *  - mode: "monocular" | "multiview"
   *  - dataRoot: string (folder with videos/images and optional intri/extri.yml)
   *  - output: string (optional; defaults to <dataRoot>/output)
   *  - emcCmd: string ("emc" or path to entry)
   *  - emcArgs: string (templated with {data_root} and {output})
   *  - exportBVH: boolean
   *  - profile: "genesis8" | "genesis9"
   *  - blender: string (path to blender.exe when exportBVH)
   *  - extraEnv: object (env vars for EM)
   */
  processVideo(opts) {
    const jobId = opts.jobId || `em_${Date.now()}`;
    const meta = this.getMeta();
    const bridgePath = path.resolve(this.pluginRoot, meta.bridge);
    const postScript = path.resolve(this.pluginRoot, meta.post.convert2bvh);
    const exportOpts = path.resolve(this.pluginRoot, meta.profiles.exportOptions);

    const args = [
      `--mode`, opts.mode || "monocular",
      `--data-root`, opts.dataRoot
    ];

    if (opts.output) { args.push("--output", opts.output); }
    if (opts.emcCmd) { args.push("--emc-cmd", opts.emcCmd); }
    if (opts.emcArgs) { args.push("--emc-args", opts.emcArgs); }
    if (opts.extraEnv) { args.push("--env", JSON.stringify(opts.extraEnv)); }
    if (opts.exportBVH) {
      args.push("--export-bvh");
      args.push("--profile", opts.profile || "genesis8");
      args.push("--blender", opts.blender || "");
      args.push("--post-script", postScript);
      args.push("--export-opts", exportOpts);
    }

    const pyEnv = Object.assign({}, process.env);
    // Allow caller to set CONDA env activation beforehand if needed.
    const child = spawn(process.platform === "win32" ? "python" : "python3", [bridgePath, ...args], {
      cwd: this.pluginRoot,
      env: pyEnv,
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.active.set(jobId, child);
    this.emit("status", { jobId, state: "started" });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => { stdout += buf.toString(); });
    child.stderr.on("data", (buf) => {
      // Bridge sends structured logs as JSON lines; forward them if possible
      const line = buf.toString().trim();
      for (const raw of line.split(/\r?\n/)) {
        try {
          const o = JSON.parse(raw);
          if (o && o.msg) this.emit("log", { jobId, ...o });
        } catch {
          this.emit("log", { jobId, level: "info", msg: raw });
        }
      }
    });

    child.on("close", (code) => {
      this.active.delete(jobId);
      if (code !== 0) {
        // Try to parse error payload from stdout
        let payload = {};
        try { payload = JSON.parse(stdout); } catch {}
        this.emit("error", { jobId, code, payload, stderr });
        return;
      }
      let manifest = null;
      try { manifest = JSON.parse(stdout); } catch (e) {
        this.emit("error", { jobId, code: -1, payload: { msg: "Invalid JSON manifest" } });
        return;
      }
      // Emit a normalized event that the core app already uses (pose-data / manifest)
      this.emit("result", { jobId, manifest });
      this.emit("status", { jobId, state: "finished" });
    });

    return jobId;
  }

  cancel(jobId) {
    const child = this.active.get(jobId);
    if (child) {
      child.kill("SIGTERM");
      this.active.delete(jobId);
      this.emit("status", { jobId, state: "canceled" });
      return true;
    }
    return false;
  }
}

module.exports = { EasyMocapProvider };
