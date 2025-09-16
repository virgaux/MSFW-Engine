import React, { useEffect, useState } from "react";

export default function EngineToggle({ onChange }) {
  const [engine, setEngine] = useState("openpose");
  const [providers, setProviders] = useState([]);
  const [em, setEm] = useState({
    mode: "monocular",
    easymocapRoot: "",
    blenderPath: "",
    profile: "genesis8",
    emcCmd: "emc",
    emcArgs: "--data config/datasets/svimage.yml --exp config/1v1p/hrnet_pare_finetune.yml --root {data_root}",
    pythonPath: "" // optional; if you wired this in the provider
  });

  // load current provider & available providers
  useEffect(() => {
    (async () => {
      try {
        const current = await window.api.getCaptureProvider();
        setEngine(current || "openpose");
        const list = await window.api.listCaptureProviders();
        setProviders(list || []);
      } catch (e) {
        console.warn("Provider init failed:", e);
      }
    })();
  }, []);

  // bubble EM options up to parent whenever they change
  useEffect(() => {
    if (onChange) onChange(em);
  }, [em, onChange]);

  const switchEngine = async (value) => {
    setEngine(value);
    try { await window.api.setCaptureProvider(value); } catch (e) {}
  };

  const hasEasyMocap = providers.some(p => p.key === "easymocap");

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontWeight: 600 }}>Engine</label>
      <select value={engine} onChange={(e) => switchEngine(e.target.value)}>
        <option value="openpose">OpenPose</option>
        <option value="easymocap" disabled={!hasEasyMocap}>
          EasyMocap{!hasEasyMocap ? " (not detected)" : ""}
        </option>
      </select>

      {engine === "easymocap" && (
        <div style={{ padding: 8, border: "1px solid #444", borderRadius: 6 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>EasyMocap Options</label>

            <div>
              <div>Mode</div>
              <select
                value={em.mode}
                onChange={(e) => setEm({ ...em, mode: e.target.value })}
              >
                <option value="monocular">Monocular (single video)</option>
                <option value="multiview">Multi-view</option>
              </select>
            </div>

            <div>
              <div>EASYMOCAP_ROOT</div>
              <input
                value={em.easymocapRoot}
                onChange={(e) => setEm({ ...em, easymocapRoot: e.target.value })}
                placeholder="D:\tools\easymocap"
              />
            </div>

            <div>
              <div>Blender Path</div>
              <input
                value={em.blenderPath}
                onChange={(e) => setEm({ ...em, blenderPath: e.target.value })}
                placeholder="C:\Blender\blender.exe"
              />
            </div>

            <div>
              <div>Profile</div>
              <select
                value={em.profile}
                onChange={(e) => setEm({ ...em, profile: e.target.value })}
              >
                <option value="genesis8">Genesis 8/8.1</option>
                <option value="genesis9">Genesis 9</option>
              </select>
            </div>

            <details>
              <summary>Advanced</summary>
              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                <div>
                  <div>EM Command</div>
                  <input
                    value={em.emcCmd}
                    onChange={(e) => setEm({ ...em, emcCmd: e.target.value })}
                  />
                </div>
                <div>
                  <div>EM Args</div>
                  <input
                    value={em.emcArgs}
                    onChange={(e) => setEm({ ...em, emcArgs: e.target.value })}
                  />
                </div>
                <div>
                  <div>Python Path (conda) — optional</div>
                  <input
                    value={em.pythonPath}
                    onChange={(e) => setEm({ ...em, pythonPath: e.target.value })}
                    placeholder="C:\Miniconda3\envs\msfw-easymocap\python.exe"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
