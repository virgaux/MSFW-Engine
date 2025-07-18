const SPRING_CONFIG = {
  damping: 0.9,     // How much bounce is reduced over time
  stiffness: 0.15,  // How quickly it returns to rest
  gravity: 2.5,     // Downward force (positive = falling)
};

// List of joint indexes (BODY_25) to apply bounce to
const BOUNCE_JOINTS = {
  leftBreast: 17,     // Use left ear as placeholder (demo only)
  rightBreast: 16,    // Use right ear as placeholder
  midHip: 8,          // Pelvis region
  leftButt: 11,       // Right ankle as proxy
  rightButt: 14       // Left ankle as proxy
};

// Store bounce state per joint
const bounceState = {};

export function applyBounce(keypoints, frameIndex = 0) {
  if (!Array.isArray(keypoints)) return keypoints;

  const updated = [...keypoints];

  for (const [name, i] of Object.entries(BOUNCE_JOINTS)) {
    const idx = i * 3;
    const x = keypoints[idx];
    const y = keypoints[idx + 1];
    const c = keypoints[idx + 2];

    if (c < 0.05) continue; // skip if not detected

    const state = bounceState[name] || {
      position: { x, y },
      velocity: { x: 0, y: 0 }
    };

    // Calculate spring force
    const dx = x - state.position.x;
    const dy = y - state.position.y;

    state.velocity.x = (state.velocity.x + dx * SPRING_CONFIG.stiffness) * SPRING_CONFIG.damping;
    state.velocity.y = (state.velocity.y + dy * SPRING_CONFIG.stiffness + SPRING_CONFIG.gravity) * SPRING_CONFIG.damping;

    state.position.x += state.velocity.x;
    state.position.y += state.velocity.y;

    updated[idx] = state.position.x;
    updated[idx + 1] = state.position.y;

    bounceState[name] = state;
  }

  return updated;
}
