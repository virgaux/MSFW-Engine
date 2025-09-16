# Invoked by Blender: blender -b -P this_script.py -- <args>
# This wrapper:
#  - reads a Genesis profile (axis, scale, rest-pose offset)
#  - forwards to EasyMocap's convert2bvh.py with those options
#  - ensures per-actor output: person_0.bvh, person_1.bvh, ...

import sys, os, json, argparse, subprocess, pathlib

def run(cmd, cwd=None):
    print(f"[convert2bvh_genesis] RUN: {cmd}")
    return subprocess.run(cmd, shell=True, cwd=cwd)

def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--smpl", required=True, help="Path to EM output/smpl directory (contains person_*/)")
    ap.add_argument("--out", required=True, help="Directory to write BVH files")
    ap.add_argument("--profile", choices=["genesis8", "genesis9"], default="genesis8")
    ap.add_argument("--export-opts", required=True, help="Path to export_options.json")
    args = ap.parse_args(argv)

    smpl_root = pathlib.Path(args.smpl).resolve()
    out_dir   = pathlib.Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load options (axis correction, scale, a-pose offset)
    with open(args.export_opts, "r", encoding="utf-8") as f:
        opts = json.load(f)
    prof = opts.get(args.profile, {})
    axis = prof.get("axis", "Zforward_Yup")
    scale = float(prof.get("scale_cm", 100.0))  # meters->cm
    apose_deg = prof.get("apose_offset_deg", {"shoulder_out": 8.0})

    # Path to EasyMocap's converter (user must have EM repo installed/available)
    # You can set EASYMOCAP_ROOT env to point to the repo root.
    em_root = os.environ.get("EASYMOCAP_ROOT")
    if not em_root:
        print("[convert2bvh_genesis] ERROR: EASYMOCAP_ROOT env not set", file=sys.stderr)
        return 2
    conv_py = os.path.join(em_root, "scripts", "postprocess", "convert2bvh.py")
    if not os.path.exists(conv_py):
        print(f"[convert2bvh_genesis] ERROR: converter not found at {conv_py}", file=sys.stderr)
        return 3

    # Build person list
    persons = sorted([p for p in smpl_root.glob("person_*") if p.is_dir()])

    # Call the converter per person, applying our options (as CLI flags recognized by EM's script).
    # NOTE: The exact flags may vary by EM version; these are typical patterns.
    retcode = 0
    for p in persons:
        out_bvh = out_dir / f"{p.name}.bvh"
        # Construct a generic call; you can extend with hands/face flags if your EM build supports them.
        cmd = (
            f"python \"{conv_py}\" "
            f"--gender AUTO "
            f"--poses \"{str(p)}\" "
            f"--output \"{str(out_bvh)}\" "
            f"--axis {axis} "
            f"--scale {scale} "
            f"--apose-shoulder-out {apose_deg.get('shoulder_out', 8.0)}"
        )
        r = run(cmd, cwd=em_root)
        if r.returncode != 0:
            retcode = r.returncode
            print(f"[convert2bvh_genesis] WARN: person {p.name} failed conversion (rc={r.returncode})", file=sys.stderr)
    return retcode

if __name__ == "__main__":
    # Blender passes our args after '--'
    if "--" in sys.argv:
        idx = sys.argv.index("--")
        sys.exit(main(sys.argv[idx+1:]))
    else:
        sys.exit(main([]))
