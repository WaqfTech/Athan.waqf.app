// Minaret Acoustic Ripple Rings Layer: concentric sound waves emanating from cities calling Adhan

import * as THREE from 'three';
import { Settlement } from '../population/loader';
import { latLonToVector3 } from '../astronomy/coordinates';
import { EARTH_RADIUS } from './earth';
import { PRAYER_COLORS } from './fronts';
import { ActiveAdhanEvent } from './cities';

const ringVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ringFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float dist = length(p) * 2.0;
    if (dist > 1.0) discard;

    // Concentric acoustic wave ripples expanding outward
    float wave1 = fract(uTime * 0.5);
    float wave2 = fract(uTime * 0.5 + 0.33);
    float wave3 = fract(uTime * 0.5 + 0.66);

    float ring1 = smoothstep(0.06, 0.0, abs(dist - wave1)) * (1.0 - wave1);
    float ring2 = smoothstep(0.06, 0.0, abs(dist - wave2)) * (1.0 - wave2);
    float ring3 = smoothstep(0.06, 0.0, abs(dist - wave3)) * (1.0 - wave3);

    float alpha = clamp(ring1 + ring2 + ring3, 0.0, 1.0);
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(vColor * 1.6, alpha * 0.85);
  }
`;

const MAX_ACTIVE_RINGS = 128;

export interface MinaretRingsLayer {
  group: THREE.Group;
  updateActiveEvents: (events: ActiveAdhanEvent[], settlements: Settlement[]) => void;
  updateTime: (elapsedSeconds: number) => void;
  dispose: () => void;
}

export function createMinaretRingsLayer(): MinaretRingsLayer {
  const group = new THREE.Group();
  group.name = 'minaret-acoustic-rings';

  // Flat quad / plane oriented normal to sphere surface
  const geometry = new THREE.PlaneGeometry(0.7, 0.7);

  const material = new THREE.ShaderMaterial({
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_ACTIVE_RINGS);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ACTIVE_RINGS * 3), 3);
  instancedMesh.count = 0;
  group.add(instancedMesh);

  const dummy = new THREE.Object3D();
  const upVector = new THREE.Vector3(0, 0, 1);
  const colorTemp = new THREE.Color();
  const radius = EARTH_RADIUS * 1.003;

  const updateActiveEvents = (events: ActiveAdhanEvent[], settlements: Settlement[]): void => {
    const activeCount = Math.min(events.length, MAX_ACTIVE_RINGS);
    instancedMesh.count = activeCount;

    for (let i = 0; i < activeCount; i++) {
      const ev = events[i];
      const idx = ev.settlementIndex;
      if (idx < 0 || idx >= settlements.length) continue;

      const s = settlements[idx];
      const [px, py, pz] = latLonToVector3(s.latitude, s.longitude, radius);
      const normal = new THREE.Vector3(px, py, pz).normalize();

      dummy.position.set(px, py, pz);
      dummy.quaternion.setFromUnitVectors(upVector, normal);
      dummy.scale.set(1.0, 1.0, 1.0);
      dummy.updateMatrix();

      instancedMesh.setMatrixAt(i, dummy.matrix);

      const colorHex = PRAYER_COLORS[ev.prayer] || 0xffffff;
      colorTemp.setHex(colorHex);
      instancedMesh.setColorAt(i, colorTemp);
    }

    if (activeCount > 0) {
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    }
  };

  const updateTime = (elapsedSeconds: number): void => {
    material.uniforms.uTime.value = elapsedSeconds;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
    instancedMesh.dispose();
  };

  return {
    group,
    updateActiveEvents,
    updateTime,
    dispose,
  };
}
