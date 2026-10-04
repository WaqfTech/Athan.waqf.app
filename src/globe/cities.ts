// GPU-accelerated settlement point cloud and pulsing adhan visualizer

import * as THREE from 'three';
import { Settlement } from '../population/loader';
import { latLonToVector3 } from '../astronomy/coordinates';
import { EARTH_RADIUS } from './earth';
import { PRAYER_COLORS, PrayerFrontKey } from './fronts';

const vertexShader = /* glsl */ `
  attribute float aBrightness;
  attribute float aState;
  attribute vec3 aPrayerColor;
  attribute float aPulse;

  uniform float uTime;

  varying float vBrightness;
  varying float vState;
  varying vec3 vColor;

  void main() {
    vBrightness = aBrightness;
    vState = aState;
    vColor = mix(vec3(0.7, 0.8, 0.95), aPrayerColor, aState);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float baseSize = 2.5 + aBrightness * 3.5;
    if (aState > 0.5) {
      // Pulse size oscillation for cities actively calling adhan
      baseSize = baseSize * 2.2 + sin(uTime * 5.0 + aPulse * 6.28) * 2.0;
    }

    // Distance attenuation with clamp boundaries
    float size = baseSize * (16.0 / -mvPosition.z);
    gl_PointSize = clamp(size, 1.5, 32.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying float vState;
  varying vec3 vColor;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.05, dist);

    if (vState > 0.5) {
      // Vivid glowing halo for active adhan
      vec3 core = vColor * 1.5;
      gl_FragColor = vec4(core, alpha * 0.95);
    } else {
      gl_FragColor = vec4(vColor, alpha * 0.65 * vBrightness);
    }
  }
`;

export interface ActiveAdhanEvent {
  settlementIndex: number;
  prayer: PrayerFrontKey;
  progress: number; // 0.0 to 1.0 across adhan duration
}

export interface SettlementPointCloud {
  group: THREE.Group;
  points: THREE.Points;
  updateActiveEvents: (events: ActiveAdhanEvent[]) => void;
  updateTime: (elapsedSeconds: number) => void;
  dispose: () => void;
}

export function createSettlementPointCloud(settlements: Settlement[]): SettlementPointCloud {
  const group = new THREE.Group();
  group.name = 'settlements-cloud';

  const count = settlements.length;
  const positions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  const states = new Float32Array(count);
  const prayerColors = new Float32Array(count * 3);
  const pulses = new Float32Array(count);

  const radius = EARTH_RADIUS * 1.002;

  for (let i = 0; i < count; i++) {
    const s = settlements[i];
    const [x, y, z] = latLonToVector3(s.latitude, s.longitude, radius);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Logarithmic population brightness normalized in [0.2, 1.0]
    const pop = Math.max(1000, s.population);
    const logPop = Math.log10(pop); // [3, 7.5]
    brightness[i] = Math.min(1.0, Math.max(0.2, (logPop - 3.0) / 4.5));

    states[i] = 0.0;
    prayerColors[i * 3] = 0.7;
    prayerColors[i * 3 + 1] = 0.8;
    prayerColors[i * 3 + 2] = 0.95;
    pulses[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('aState', new THREE.BufferAttribute(states, 1));
  geometry.setAttribute('aPrayerColor', new THREE.BufferAttribute(prayerColors, 3));
  geometry.setAttribute('aPulse', new THREE.BufferAttribute(pulses, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  group.add(points);

  const updateActiveEvents = (events: ActiveAdhanEvent[]): void => {
    // Reset all states
    states.fill(0.0);

    for (const ev of events) {
      const idx = ev.settlementIndex;
      if (idx >= 0 && idx < count) {
        states[idx] = 1.0;
        pulses[idx] = ev.progress;

        const colorHex = PRAYER_COLORS[ev.prayer] || 0xffffff;
        const r = ((colorHex >> 16) & 255) / 255;
        const g = ((colorHex >> 8) & 255) / 255;
        const b = (colorHex & 255) / 255;

        prayerColors[idx * 3] = r;
        prayerColors[idx * 3 + 1] = g;
        prayerColors[idx * 3 + 2] = b;
      }
    }

    geometry.attributes.aState.needsUpdate = true;
    geometry.attributes.aPrayerColor.needsUpdate = true;
    geometry.attributes.aPulse.needsUpdate = true;
  };

  const updateTime = (elapsedSeconds: number): void => {
    material.uniforms.uTime.value = elapsedSeconds;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return {
    group,
    points,
    updateActiveEvents,
    updateTime,
    dispose,
  };
}
