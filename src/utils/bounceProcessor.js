let springConfig = {
  zones: {
    breast: { gravity: 2.5, stiffness: 0.15, damping: 0.9 },
    butt: { gravity: 2.2, stiffness: 0.12, damping: 0.85 },
    pelvis: { gravity: 2.0, stiffness: 0.2, damping: 0.8 }
  },
  enabledZones: {
    breast: true,
    butt: true,
    pelvis: true
  }
};

export function updateSpringConfig(newConfig) {
  springConfig = {
    ...springConfig,
    ...newConfig,
    zones: {
      ...springConfig.zones,
      ...(newConfig.zones || {})
    },
    enabledZones: {
      ...springConfig.enabledZones,
      ...(newConfig.enabledZones || {})
    }
  };
  console.log('[BounceProcessor] Config updated:', springConfig);
}

const ZONE_TO_INDEX = {
  breast: [16, 17],
  pelvis: [8],
  butt: [11, 14]
};

const bounceState = {};

export function applyBounce(keypoints) {
  if (!Array.isArray(keypoints)) return keypoints;
  const updated = [...keypoints];

  for (const [zone, indexes] of Object.entries(ZONE_TO_INDEX)) {
    if (!springConfig.enabledZones[zone]) continue;
    const { gravity, stiffness, damping } = springConfig.zones[zone];

    for (const i of indexes) {
      const idx = i * 3;
      const x = keypoints[idx];
      const y = keypoints[idx + 1];
      const c = keypoints[idx + 2];

      if (c < 0.05) continue;

      const key = `${zone}_${i}`;
      const state = bounceState[key] || {
        position: { x, y },
        velocity: { x: 0, y: 0 }
      };

      const dx = x - state.position.x;
      const dy = y - state.position.y;

      state.velocity.x = (state.velocity.x + dx * stiffness) * damping;
      state.velocity.y = (state.velocity.y + dy * stiffness + gravity) * damping;

      state.position.x += state.velocity.x;
      state.position.y += state.velocity.y;

      updated[idx] = state.position.x;
      updated[idx + 1] = state.position.y;

      bounceState[key] = state;
    }
  }

  return updated;
}
