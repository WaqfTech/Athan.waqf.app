// Three.js 3D prayer front visualization layer with color-coded glowing lines

import * as THREE from 'three';
import { SubsolarCoordinates } from '../astronomy/solar';
import { generateGlobalPrayerFronts } from '../prayer/contours';
import { CalculationParameters, Madhab, CALCULATION_CONVENTIONS } from '../prayer/conventions';
import { EARTH_RADIUS } from './earth';

export type PrayerFrontKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'terminator';

export const PRAYER_COLORS: Record<PrayerFrontKey, number> = {
  fajr: 0x38bdf8, // Cyan / Dawn twilight
  sunrise: 0xfef08a, // Pale gold / Sunrise
  dhuhr: 0xfacc15, // Golden yellow / Solar noon
  asr: 0xff5500, // Vivid blazing orange / Afternoon shadow
  maghrib: 0xf43f5e, // Crimson rose / Sunset
  isha: 0xa855f7, // Vivid violet-purple / Nightfall twilight
  terminator: 0xe2e8f0, // Crisp silver-white / Day-night solar boundary
};

export interface FrontLineObject {
  line: THREE.Line;
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
}

export interface PrayerFrontsLayer {
  group: THREE.Group;
  setVisibility: (key: PrayerFrontKey, visible: boolean) => void;
  setAllVisibility: (visible: boolean) => void;
  update: (
    subsolar: SubsolarCoordinates,
    convention?: CalculationParameters,
    madhab?: Madhab,
  ) => void;
  dispose: () => void;
}

export function createPrayerFrontsLayer(): PrayerFrontsLayer {
  const group = new THREE.Group();
  group.name = 'prayer-fronts-layer';

  const overlayRadius = EARTH_RADIUS * 1.004; // Slight elevation to avoid z-fighting

  const frontKeys: PrayerFrontKey[] = [
    'fajr',
    'sunrise',
    'dhuhr',
    'asr',
    'maghrib',
    'isha',
    'terminator',
  ];

  const linesMap = new Map<PrayerFrontKey, FrontLineObject>();

  // Allocate reusable buffer geometries for each front
  for (const key of frontKeys) {
    const geometry = new THREE.BufferGeometry();
    // Pre-allocate buffer for up to 256 vertices
    const maxPoints = 256;
    const positions = new Float32Array(maxPoints * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color: PRAYER_COLORS[key],
      linewidth: 2,
      transparent: true,
      opacity: key === 'terminator' ? 0.75 : 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.name = `front-${key}`;
    group.add(line);

    linesMap.set(key, { line, geometry, material });
  }

  const setVisibility = (key: PrayerFrontKey, visible: boolean): void => {
    const obj = linesMap.get(key);
    if (obj) {
      obj.line.visible = visible;
    }
  };

  const setAllVisibility = (visible: boolean): void => {
    for (const [, obj] of linesMap) {
      obj.line.visible = visible;
    }
  };

  const update = (
    subsolar: SubsolarCoordinates,
    convention: CalculationParameters = CALCULATION_CONVENTIONS.UmmAlQura,
    madhab: Madhab = 'Shafi',
  ): void => {
    const fronts = generateGlobalPrayerFronts(subsolar, convention, madhab, overlayRadius);

    for (const key of frontKeys) {
      const obj = linesMap.get(key);
      if (!obj) continue;

      const contour = fronts[key];
      const positionAttr = obj.geometry.attributes.position as THREE.BufferAttribute;
      const array = positionAttr.array as Float32Array;

      // Copy calculated contour points into geometry attribute
      const count = Math.min(contour.pointCount, array.length / 3);
      for (let i = 0; i < count * 3; i++) {
        array[i] = contour.positions[i];
      }

      positionAttr.needsUpdate = true;
      obj.geometry.setDrawRange(0, count);
    }
  };

  const dispose = (): void => {
    for (const [, obj] of linesMap) {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  };

  return {
    group,
    setVisibility,
    setAllVisibility,
    update,
    dispose,
  };
}
