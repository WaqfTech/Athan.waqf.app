// GPU-accelerated settlement point cloud and 3D glowing adhan light pillars

import * as THREE from 'three';
import { Settlement } from '../population/loader';
import { latLonToVector3 } from '../astronomy/coordinates';
import { EARTH_RADIUS } from './earth';
import { PRAYER_COLORS, PrayerFrontKey } from './fronts';

const pointsVertexShader = /* glsl */ `
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

const pointsFragmentShader = /* glsl */ `
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
      vec3 core = vColor * 1.25;
      gl_FragColor = vec4(core, alpha * 0.95);
    } else {
      gl_FragColor = vec4(vColor, alpha * 0.65 * vBrightness);
    }
  }
`;

const pillarVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const pillarFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    // Vertical beam gradient: bright base tapering to a luminous pinnacle
    float beam = pow(vUv.y, 0.65);
    float pulse = 0.85 + 0.15 * sin(uTime * 4.0);
    vec3 color = vColor * (1.1 + beam * 0.35) * pulse;
    float alpha = (0.35 + beam * 0.65) * 0.9;
    gl_FragColor = vec4(color, alpha);
  }
`;

const beaconFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;

  void main() {
    float pulse = 0.85 + 0.25 * sin(uTime * 6.0);
    gl_FragColor = vec4(vColor * 1.35 * pulse, 0.95);
  }
`;

export interface ActiveAdhanEvent {
  settlementIndex: number;
  prayer: PrayerFrontKey;
  progress: number; // 0.0 to 1.0 across adhan duration
  eventId?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface SettlementPointCloud {
  group: THREE.Group;
  points: THREE.Points;
  pillarsMesh: THREE.InstancedMesh;
  beaconsMesh: THREE.InstancedMesh;
  updateActiveEvents: (events: ActiveAdhanEvent[]) => void;
  updateTime: (elapsedSeconds: number) => void;
  dispose: () => void;
}

const MAX_ACTIVE_PILLARS = 256;

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

  // Base point cloud
  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointsGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  pointsGeometry.setAttribute('aState', new THREE.BufferAttribute(states, 1));
  pointsGeometry.setAttribute('aPrayerColor', new THREE.BufferAttribute(prayerColors, 3));
  pointsGeometry.setAttribute('aPulse', new THREE.BufferAttribute(pulses, 1));

  const pointsMaterial = new THREE.ShaderMaterial({
    vertexShader: pointsVertexShader,
    fragmentShader: pointsFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(pointsGeometry, pointsMaterial);
  group.add(points);

  // 3D Light Pillars InstancedMesh
  const cylinderGeo = new THREE.CylinderGeometry(0.012, 0.024, 1.0, 8);
  cylinderGeo.translate(0, 0.5, 0); // Translate base to Y=0 so scaling extends outwards

  const pillarMaterial = new THREE.ShaderMaterial({
    vertexShader: pillarVertexShader,
    fragmentShader: pillarFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const pillarsMesh = new THREE.InstancedMesh(cylinderGeo, pillarMaterial, MAX_ACTIVE_PILLARS);
  pillarsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pillarsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ACTIVE_PILLARS * 3), 3);
  pillarsMesh.count = 0;
  group.add(pillarsMesh);

  // Glowing beacon orbs at the summit of each pillar
  const beaconGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const beaconMaterial = new THREE.ShaderMaterial({
    vertexShader: pillarVertexShader,
    fragmentShader: beaconFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const beaconsMesh = new THREE.InstancedMesh(beaconGeo, beaconMaterial, MAX_ACTIVE_PILLARS);
  beaconsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beaconsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ACTIVE_PILLARS * 3), 3);
  beaconsMesh.count = 0;
  group.add(beaconsMesh);

  const dummyPillar = new THREE.Object3D();
  const dummyBeacon = new THREE.Object3D();
  const upVector = new THREE.Vector3(0, 1, 0);
  const colorTemp = new THREE.Color();

  let activeEventsCache: ActiveAdhanEvent[] = [];

  const updateActiveEvents = (events: ActiveAdhanEvent[]): void => {
    activeEventsCache = events;
    // Reset all point cloud states
    states.fill(0.0);

    const activeCount = Math.min(events.length, MAX_ACTIVE_PILLARS);
    pillarsMesh.count = activeCount;
    beaconsMesh.count = activeCount;

    for (let i = 0; i < activeCount; i++) {
      const ev = events[i];
      const idx = ev.settlementIndex;
      if (idx < 0 || idx >= count) continue;

      const s = settlements[idx];
      states[idx] = 1.0;
      pulses[idx] = ev.progress;

      const colorHex = PRAYER_COLORS[ev.prayer] || 0xffffff;
      colorTemp.setHex(colorHex);

      const r = colorTemp.r;
      const g = colorTemp.g;
      const b = colorTemp.b;

      prayerColors[idx * 3] = r;
      prayerColors[idx * 3 + 1] = g;
      prayerColors[idx * 3 + 2] = b;

      // Position along Earth surface
      const [px, py, pz] = latLonToVector3(s.latitude, s.longitude, radius);
      const normal = new THREE.Vector3(px, py, pz).normalize();

      // Logarithmic population height scaling
      const pop = Math.max(1000, s.population);
      const logPop = Math.log10(pop);
      const popFactor = Math.min(1.0, Math.max(0.2, (logPop - 3.0) / 4.5));
      const baseHeight = 0.2 + popFactor * 0.45;

      // Configure pillar transform
      dummyPillar.position.set(px, py, pz);
      dummyPillar.quaternion.setFromUnitVectors(upVector, normal);
      dummyPillar.scale.set(1.0, baseHeight, 1.0);
      dummyPillar.updateMatrix();
      pillarsMesh.setMatrixAt(i, dummyPillar.matrix);
      pillarsMesh.setColorAt(i, colorTemp);

      // Configure beacon orb transform at top of pillar
      const beaconPos = new THREE.Vector3(px, py, pz).addScaledVector(normal, baseHeight);
      dummyBeacon.position.copy(beaconPos);
      dummyBeacon.scale.set(1.0, 1.0, 1.0);
      dummyBeacon.updateMatrix();
      beaconsMesh.setMatrixAt(i, dummyBeacon.matrix);
      beaconsMesh.setColorAt(i, colorTemp);
    }

    // For any remaining events that exceed MAX_ACTIVE_PILLARS, keep them in point cloud
    for (let i = activeCount; i < events.length; i++) {
      const ev = events[i];
      const idx = ev.settlementIndex;
      if (idx >= 0 && idx < count) {
        states[idx] = 1.0;
        pulses[idx] = ev.progress;
        const colorHex = PRAYER_COLORS[ev.prayer] || 0xffffff;
        colorTemp.setHex(colorHex);
        prayerColors[idx * 3] = colorTemp.r;
        prayerColors[idx * 3 + 1] = colorTemp.g;
        prayerColors[idx * 3 + 2] = colorTemp.b;
      }
    }

    pointsGeometry.attributes.aState.needsUpdate = true;
    pointsGeometry.attributes.aPrayerColor.needsUpdate = true;
    pointsGeometry.attributes.aPulse.needsUpdate = true;

    if (activeCount > 0) {
      pillarsMesh.instanceMatrix.needsUpdate = true;
      if (pillarsMesh.instanceColor) pillarsMesh.instanceColor.needsUpdate = true;
      beaconsMesh.instanceMatrix.needsUpdate = true;
      if (beaconsMesh.instanceColor) beaconsMesh.instanceColor.needsUpdate = true;
    }
  };

  const updateTime = (elapsedSeconds: number): void => {
    pointsMaterial.uniforms.uTime.value = elapsedSeconds;
    pillarMaterial.uniforms.uTime.value = elapsedSeconds;
    beaconMaterial.uniforms.uTime.value = elapsedSeconds;

    // Subtle rhythmic height breath on active pillars
    const activeCount = Math.min(activeEventsCache.length, MAX_ACTIVE_PILLARS);
    if (activeCount > 0) {
      for (let i = 0; i < activeCount; i++) {
        const ev = activeEventsCache[i];
        const idx = ev.settlementIndex;
        if (idx < 0 || idx >= count) continue;

        const s = settlements[idx];
        const [px, py, pz] = latLonToVector3(s.latitude, s.longitude, radius);
        const normal = new THREE.Vector3(px, py, pz).normalize();

        const pop = Math.max(1000, s.population);
        const logPop = Math.log10(pop);
        const popFactor = Math.min(1.0, Math.max(0.2, (logPop - 3.0) / 4.5));
        const pulse = 1.0 + 0.12 * Math.sin(elapsedSeconds * 4.0 + ev.progress * 6.28);
        const baseHeight = (0.2 + popFactor * 0.45) * pulse;

        dummyPillar.position.set(px, py, pz);
        dummyPillar.quaternion.setFromUnitVectors(upVector, normal);
        dummyPillar.scale.set(1.0, baseHeight, 1.0);
        dummyPillar.updateMatrix();
        pillarsMesh.setMatrixAt(i, dummyPillar.matrix);

        const beaconPos = new THREE.Vector3(px, py, pz).addScaledVector(normal, baseHeight);
        dummyBeacon.position.copy(beaconPos);
        dummyBeacon.scale.set(1.0, 1.0, 1.0);
        dummyBeacon.updateMatrix();
        beaconsMesh.setMatrixAt(i, dummyBeacon.matrix);
      }
      pillarsMesh.instanceMatrix.needsUpdate = true;
      beaconsMesh.instanceMatrix.needsUpdate = true;
    }
  };

  const dispose = (): void => {
    pointsGeometry.dispose();
    pointsMaterial.dispose();
    cylinderGeo.dispose();
    pillarMaterial.dispose();
    beaconGeo.dispose();
    beaconMaterial.dispose();
    pillarsMesh.dispose();
    beaconsMesh.dispose();
  };

  return {
    group,
    points,
    pillarsMesh,
    beaconsMesh,
    updateActiveEvents,
    updateTime,
    dispose,
  };
}
