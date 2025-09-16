#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EasyMocap bridge for MSFW Engine
- Spawns EasyMocap (monocular or multiview)
- Optionally converts SMPL params to BVH using Blender script with Genesis profiles
- Emits a JSON manifest on stdout for the Node provider to consume

USAGE (examples):
  python easymocap_bridge.py \
    --mode monocular \
    --data-root "D:/jobs/job01" \
    --emc-cmd "emc" \
    --emc-args "--data config/datasets/svimage.yml --exp config/1v1p/hrnet_pare_finetune.yml --root {data_root}" \
    --output "D:/jobs/job01/output" \
    --export-bvh \
    --profile genesis8 \
    --blender "C:/Blender/blender.exe"

  python easymocap_bridge.py --dry-run --data-root "D:/jobs/job01"

Exit codes:
  0 success, non-zero on failure.
"""

import argparse, json, os, sys, subprocess, time, glob, re, shutil
from pathlib import Path

def log(msg, level="info"):
    sys.stderr.write(json.dumps({"level": level, "msg": str(msg)}) + "\n")
    sys.stderr.flush()

def run(cmd, cwd=None, env=None):
    log(f"RUN: {cmd}")
    return subprocess.run(cmd, shell=True, cwd=cwd, env=env, capture_output=True, text=True)

def guess_person_dirs(smpl_dir: Path):
    # Typical EM layout: smpl/person_0, person_1 ...
    persons = []
    if smpl_dir.exists():
        for p in sorted(smpl_dir.glob("person_*")):
            if p.is_dir():
                persons.append(p)
    return persons

def build_manifest(root: Path, output_dir: Path):
    smpl_dir = output_dir / "smpl"
    k3d_dir  = output_dir / "k3d"
    bvh_dir  = output_dir / "bvh"

    persons = guess_person_dirs(smpl_dir)
    actors = []
    for idx, pdir in enumerate(persons):
        actor = {
            "id": idx,
            "name": f"person_{idx}",
            "smpl_path": str(pdir),
            "bvh_path": None,
            "keypoints3d_path": str(k3d_dir) if k3d_dir.exists() else None
        }
        # If per-actor BVH exists with standard naming:
        cand = list(bvh_dir.glob(f"person_{idx}*.bvh")) if bvh_dir.exists() else []
        if cand:
            actor["bvh_path"] = str(cand[0])
        actors.append(actor)

    # Try to infer fps & frames (fallbacks)
    fps = 30
    frames = 0
    # Look for any per-frame json in person_0 as hint
    if persons:
        js = list(persons[0].glob("*.json"))
        frames = len(js)

    manifest = {
        "version": "0.1.0",
        "engine": "easymocap",
        "root": str(root),
        "output": str(output_dir),
        "fps": fps,
        "frames": frames,
        "actors": actors
    }
    return manifest

def convert_to_bvh(blender, script_path, smpl_root, out_dir, profile, export_opts_path):
    # Build blender headless call to our wrapper (which forwards to EM's convert2bvh.py)
    # We assume convert2bvh_genesis.py will interpret these args and call the real converter.
    cmd = (
        f"\"{blender}\" -b -P \"{script_path}\" -- "
        f"--smpl \"{smpl_root}\" "
        f"--out \"{out_dir}\" "
        f"--profile {profile} "
        f"--export-opts \"{export_opts_path}\""
    )
    return run(cmd)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["monocular", "multiview"], default="monocular")
    ap.add_argument("--data-root", required=True, help="Path to dataset root (contains images/videos and optionally intri/extri.yml)")
    ap.add_argument("--output", help="Output dir (defaults to <data-root>/output)")
    ap.add_argument("--emc-cmd", default="emc", help="EasyMocap command or path to entry script")
    ap.add_argument("--emc-args", default="", help="Args template for EM. {data_root} and {output} will be formatted.")
    ap.add_argument("--env", help="Extra environment (JSON string) for EM process")
    ap.add_argument("--export-bvh", action="store_true")
    ap.add_argument("--profile", choices=["genesis8", "genesis9"], default="genesis8")
    ap.add_argument("--blender", help="Path to Blender executable (required for BVH export when --export-bvh)")
    ap.add_argument("--post-script", default=str(Path(__file__).parent / "../post/convert2bvh_genesis.py"))
    ap.add_argument("--export-opts", default=str(Path(__file__).parent / "../profiles/export_options.json"))
    ap.add_argument("--dry-run", action="store_true")

    args = ap.parse_args()
    data_root = Path(args.data_root).resolve()
    output_dir = Path(args.output).resolve() if args.output else (data_root / "output")
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        log("Dry run: skipping EM execution", "warn")
        manifest = build_manifest(data_root, output_dir)
        print(json.dumps(manifest))
        return 0

    # Build EM command
    em_args = args.emc_args.format(data_root=str(data_root), output=str(output_dir))
    command = f"{args.emc_cmd} {em_args}".strip()
    env = os.environ.copy()
    if args.env:
        try:
            env.update(json.loads(args.env))
        except Exception as e:
            log(f"Failed to parse --env JSON: {e}", "warn")

    # Run EasyMocap
    t0 = time.time()
    proc = run(command, cwd=str(data_root), env=env)
    log(proc.stdout or "[no stdout]")
    if proc.returncode != 0:
        log(proc.stderr or "[no stderr]", "error")
        print(json.dumps({
            "error": "EasyMocap failed",
            "code": proc.returncode,
            "stderr": proc.stderr
        }))
        return proc.returncode
    log(f"EasyMocap finished in {time.time()-t0:.1f}s")

    # Optional BVH export using Blender wrapper
    if args.export_bvh:
        if not args.blender:
            log("Blender path is required for --export-bvh", "error")
            print(json.dumps({"error": "Missing --blender for BVH export"}))
            return 2
        smpl_root = output_dir / "smpl"
        bvh_out   = output_dir / "bvh"
        bvh_out.mkdir(exist_ok=True, parents=True)
        conv = convert_to_bvh(args.blender, args.post_script, smpl_root, bvh_out, args.profile, args.export_opts)
        log(conv.stdout or "[no stdout from blender]")
        if conv.returncode != 0:
            log(conv.stderr or "[no stderr from blender]", "error")
            print(json.dumps({
                "error": "BVH conversion failed",
                "code": conv.returncode
            }))
            return conv.returncode

    # Emit manifest
    manifest = build_manifest(data_root, output_dir)
    print(json.dumps(manifest))
    return 0

if __name__ == "__main__":
    sys.exit(main())
