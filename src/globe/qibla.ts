// 3D Parabolic Qibla Arcs to Mecca with animated light pulses

import * as THREE from 'three';
import { latLonToVector3 } from '../astronomy/coordinates';
import { EARTH_RADIUS } from './earth';
import { PRAYER_COLORS, PrayerFrontKey } from './fronts';
import { ActiveAdhanEvent } from './cities';
import { Settlement } from '../population/loader';

export const MECCA_LAT = 21.4225;
export const MECCA_LON = 39.8262;

const arcVertexShader = /* glsl */ `
  attribute float aProgress;
  varying float vProgress;

  void main() {
    vProgress = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const arcFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying float vProgress;

  void main() {
    // Traveling light dashes flowing from city toward Mecca
    float dash = fract(vProgress * 6.0 - uTime * 2.0);
    float pulse = smoothstep(0.0, 0.4, dash) * smoothstep(1.0, 0.6, dash);
    vec3 col = mix(uColor, vec3(1.0, 1.0, 0.9), pulse * 0.75);
    float alpha = clamp(0.3 + pulse * 0.7, 0.0, 1.0);
    gl_FragColor = vec4(col * 1.4, alpha);
  }
`;

const SAMPLES_PER_ARC = 64;
const MAX_ACTIVE_ARCS = 8;

export interface QiblaArcsLayer {
  group: THREE.Group;
  setInspectedCity: (lat: number, lon: number, prayerKey?: PrayerFrontKey) => void;
  clearInspectedCity: () => void;
  updateActiveEvents: (events: ActiveAdhanEvent[], settlements: Settlement[]) => void;
  updateTime: (elapsedSeconds: number) => void;
  dispose: () => void;
}

export function createQiblaArcsLayer(): QiblaArcsLayer {
  const group = new THREE.Group();
  group.name = 'qibla-arcs-layer';

  // Sanctuary beacon at the Kaaba in Mecca
  const kaabaPos = latLonToVector3(MECCA_LAT, MECCA_LON, EARTH_RADIUS * 1.003);
  const kaabaNormal = new THREE.Vector3(...kaabaPos).normalize();

  // Kaaba marker pillar
  const kaabaGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.4, 8);
  kaabaGeo.translate(0, 0.2, 0);
  const kaabaMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15, // Golden yellow
  });
  const kaabaMesh = new THREE.Mesh(kaabaGeo, kaabaMat);
  kaabaMesh.position.set(...kaabaPos);
  kaabaMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kaabaNormal);
  group.add(kaabaMesh);

  // Kaaba crown beacon
  const crownGeo = new THREE.SphereGeometry(0.04, 12, 12);
  const crownMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a, // Brilliant pale gold
  });
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.position.set(...kaabaPos).addScaledVector(kaabaNormal, 0.4);
  group.add(crownMesh);

  // Inspected city primary Qibla arc
  const inspectedGeometry = new THREE.BufferGeometry();
  const inspectedPositions = new Float32Array(SAMPLES_PER_ARC * 3);
  const inspectedProgress = new Float32Array(SAMPLES_PER_ARC);
  for (let i = 0; i < SAMPLES_PER_ARC; i++) {
    inspectedProgress[i] = i / (SAMPLES_PER_ARC - 1);
  }
  inspectedGeometry.setAttribute('position', new THREE.BufferAttribute(inspectedPositions, 3));
  inspectedGeometry.setAttribute('aProgress', new THREE.BufferAttribute(inspectedProgress, 1));

  const inspectedMaterial = new THREE.ShaderMaterial({
    vertexShader: arcVertexShader,
    fragmentShader: arcFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x38bdf8) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const inspectedLine = new THREE.Line(inspectedGeometry, inspectedMaterial);
  inspectedLine.visible = false;
  group.add(inspectedLine);

  // Active Adhan pool of secondary Qibla arcs
  interface ActiveArcObj {
    line: THREE.Line;
    geometry: THREE.BufferGeometry;
    material: THREE.ShaderMaterial;
  }

  const activeArcPool: ActiveArcObj[] = [];
  for (let i = 0; i < MAX_ACTIVE_ARCS; i++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SAMPLES_PER_ARC * 3);
    const prog = new Float32Array(SAMPLES_PER_ARC);
    for (let j = 0; j < SAMPLES_PER_ARC; j++) {
      prog[j] = j / (SAMPLES_PER_ARC - 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aProgress', new THREE.BufferAttribute(prog, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: arcVertexShader,
      fragmentShader: arcFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xfacc15) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.Line(geo, mat);
    line.visible = false;
    group.add(line);
    activeArcPool.push({ line, geometry: geo, material: mat });
  }

  // Build great circle geodesic 3D parabolic arc
  const buildArcGeometry = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    outPositions: Float32Array,
  ): void => {
    const v1 = new THREE.Vector3(...latLonToVector3(lat1, lon1, 1)).normalize();
    const v2 = new THREE.Vector3(...latLonToVector3(lat2, lon2, 1)).normalize();

    const angle = v1.angleTo(v2);
    // Peak height proportional to angular distance, clamped
    const peakHeight = Math.min(1.8, Math.max(0.3, angle * 0.65));

    for (let i = 0; i < SAMPLES_PER_ARC; i++) {
      const t = i / (SAMPLES_PER_ARC - 1);
      // Slerp along unit sphere
      const v = new THREE.Vector3().copy(v1).lerp(v2, t).normalize();
      // Parabolic altitude arching above the surface
      const altitude = EARTH_RADIUS * 1.004 + Math.sin(t * Math.PI) * peakHeight;

      outPositions[i * 3] = v.x * altitude;
      outPositions[i * 3 + 1] = v.y * altitude;
      outPositions[i * 3 + 2] = v.z * altitude;
    }
  };

  const setInspectedCity = (lat: number, lon: number, prayerKey: PrayerFrontKey = 'dhuhr'): void => {
    // Avoid drawing arc if already at Mecca
    if (Math.hypot(lat - MECCA_LAT, lon - MECCA_LON) < 0.5) {
      inspectedLine.visible = false;
      return;
    }

    buildArcGeometry(lat, lon, MECCA_LAT, MECCA_LON, inspectedPositions);
    (inspectedGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    const colorHex = PRAYER_COLORS[prayerKey] || 0x38bdf8;
    inspectedMaterial.uniforms.uColor.value.setHex(colorHex);
    inspectedLine.visible = true;
  };

  const clearInspectedCity = (): void => {
    inspectedLine.visible = false;
  };

  const updateActiveEvents = (events: ActiveAdhanEvent[], settlements: Settlement[]): void => {
    const count = Math.min(events.length, MAX_ACTIVE_ARCS);
    for (let i = 0; i < MAX_ACTIVE_ARCS; i++) {
      if (i < count) {
        const ev = events[i];
        const s = settlements[ev.settlementIndex];
        if (!s) {
          activeArcPool[i].line.visible = false;
          continue;
        }

        const geo = activeArcPool[i].geometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        buildArcGeometry(s.latitude, s.longitude, MECCA_LAT, MECCA_LON, posAttr.array as Float32Array);
        posAttr.needsUpdate = true;

        const colorHex = PRAYER_COLORS[ev.prayer] || 0xfacc15;
        activeArcPool[i].material.uniforms.uColor.value.setHex(colorHex);
        activeArcPool[i].line.visible = true;
      } else {
        activeArcPool[i].line.visible = false;
      }
    }
  };

  const updateTime = (elapsedSeconds: number): void => {
    inspectedMaterial.uniforms.uTime.value = elapsedSeconds;
    for (const arc of activeArcPool) {
      if (arc.line.visible) {
        arc.material.uniforms.uTime.value = elapsedSeconds;
      }
    }
    // Subtle pulsating glow on Kaaba summit
    crownMesh.scale.setScalar(1.0 + 0.15 * Math.sin(elapsedSeconds * 3.0));
  };

  const dispose = (): void => {
    kaabaGeo.dispose();
    kaabaMat.dispose();
    crownGeo.dispose();
    crownMat.dispose();
    inspectedGeometry.dispose();
    inspectedMaterial.dispose();
    for (const arc of activeArcPool) {
      arc.geometry.dispose();
      arc.material.dispose();
    }
  };

  return {
    group,
    setInspectedCity,
    clearInspectedCity,
    updateActiveEvents,
    updateTime,
    dispose,
  };
}
