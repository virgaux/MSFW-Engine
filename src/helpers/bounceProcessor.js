// This object will be updated by BounceControlPanel
let springConfig = {
  gravity: 2.5,
  stiffness: 0.15,
  damping: 0.9
};

// Apply new config from control panel
export function updateSpringConfig(newConfig) {
  springConfig = {
    ...springConfig,
    ...newConfig
  };
  console.log('[BounceProcessor] Config updated:', springConfig);
}

// Apply bounce simulation
const BOUNCE_JOINTS = {
  leftBreast: 17,
  rightBreast: 16,
  pelvis: 8,
  leftButt: 11,
  rightButt: 14
};

const bounceState = {};

export function applyBounce(keypoints) {
  if (!Array.isArray(keypoints)) return keypoints;
  const updated = [...keypoints];

  for (const [name, i] of Object.entries(BOUNCE_JOINTS)) {
    const idx = i * 3;
    const x = keypoints[idx];
    const y = keypoints[idx + 1];
    const c = keypoints[idx + 2];

    if (c < 0.05) continue;

    const state = bounceState[name] || {
      position: { x, y },
      velocity: { x: 0, y: 0 }
    };

    const dx = x - state.position.x;
    const dy = y - state.position.y;

    state.velocity.x = (state.velocity.x + dx * springConfig.stiffness) * springConfig.damping;
    state.velocity.y = (state.velocity.y + dy * springConfig.stiffness + springConfig.gravity) * springConfig.damping;

    state.position.x += state.velocity.x;
    state.position.y += state.velocity.y;

    updated[idx] = state.position.x;
    updated[idx + 1] = state.position.y;

    bounceState[name] = state;
  }

  return updated;
}
