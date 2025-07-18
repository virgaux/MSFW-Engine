# 📦 MSFW Engine Project Snapshot — July 2025

## 🔰 Project Title
**MSFW Engine (Motion Sync Flow Workshop Engine)**  
> A noob-friendly, offline desktop app for full-body motion animation using OpenPose, designed for DAZ Studio, Unreal, and Blender pipelines. Supports physics-based bounce, multi-frame playback, and plugin extensibility.

---

## 🚀 Phase 1: Core Modules

| Module                           | Status        | Notes                                                  |
|----------------------------------|---------------|--------------------------------------------------------|
| Electron + GUI Shell             | ✅ Complete    | Modular panel-based React layout                       |
| OpenPose Live Integration        | ✅ Complete    | Real-time IPC via `poseListener`                       |
| Bounce Physics Engine            | ✅ Complete    | Per-zone sliders, presets, save/load, toggles          |
| Playback Animation System        | ✅ Complete    | JSON frame sequence with FPS control                   |
| Unified Mode Toggle              | ✅ Complete    | Toggle between Live and Playback modes                 |
| Plugin System                    | ✅ Ready       | Loads `.js` plugin files with optional `onLoad()` hook |
| Export Panel (UI only)           | ✅ Present     | Core UX shell, export logic pending                    |
| Diagnostics + Resource Panels    | ✅ Present     | Modular stubs for diagnostics & system usage           |
| Offline Installer (PowerShell)   | ✅ Working     | Bundled silent install using Node, Git, Electron       |

---

## 🧠 Phase 2: Planned Features

| Feature                            | Status       | Description                                    |
|-----------------------------------|--------------|------------------------------------------------|
| Gravity Zones + Chain Physics     | 🟡 In Progress | Targeted effects for hair, piercings, tails    |
| Multi-Frame Export (BVH/FBX)       | 🔄 Planned     | Retargeted export for DAZ/Unreal               |
| Timeline Scrubber + Seek UI       | 🔄 Planned     | Frame seek + drag support                      |
| AI Pose Prediction (ONNX)         | 🔄 Scaffolding | For smoothing or filling missing keyframes     |
| 360° Orbit Camera / Viewport      | 🟡 40%         | Perspective camera support                     |
| Webcam Mocap + Scene Recording    | 🔄 R&D         | MediaPipe / OpenCV-based skeleton tracking     |
| Installer Cleanup / Uninstaller   | 🔄 Blueprinted | Planned for full v1.x release                  |

---

## 🧩 Directory Overview

├── main.js / preload.js → Electron + IPC shell
├── public/index.html → React container
├── src/
│ ├── App.jsx → Main wrapper
│ ├── components/ → All panels (viewer, bounce, plugin, etc.)
│ ├── hooks/useAnimationPlayer.js → JSON playback engine
│ ├── helpers/ → bounceProcessor, poseSequenceLoader
│ ├── backend/ → poseDataWatcher.js
├── plugins/ → Custom plugin loader (onLoad support)
├── output/ → OpenPose JSON + bounce config
├── docs/ → Snapshot, dev notes, changelogs


---

## ✅ Current Snapshot Version:  
**MSFW Engine v0.9.0-alpha** — Fully operational core engine with bounce physics and multi-frame viewer, ready for export and extended viewport tooling.

---

