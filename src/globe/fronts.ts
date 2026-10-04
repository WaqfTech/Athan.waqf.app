// Three.js 3D prayer front visualization layer with color-coded glowing lines

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { SubsolarCoordinates } from '../astronomy/solar';
import { generateGlobalPrayerFronts } from '../prayer/contours';
import { CalculationParameters, Madhab, CALCULATION_CONVENTIONS } from '../prayer/conventions';
import { EARTH_RADIUS } from './earth';

export type PrayerFrontKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'terminator';

export const PRAYER_COLORS: Record<PrayerFrontKey, number> = {
  fajr: 0x38bdf8, // Cyan / Dawn twilight
  sunrise: 0x34d399, // Emerald / Sunrise (distinct from Dhuhr yellow)
  dhuhr: 0xfacc15, // Golden yellow / Solar noon
  asr: 0xff5500, // Vivid blazing orange / Afternoon shadow
  maghrib: 0xec4899, // Hot pink / Sunset (distinct from Asr orange)
  isha: 0xa855f7, // Vivid violet-purple / Nightfall twilight
  terminator: 0xe2e8f0, // Crisp silver-white / Day-night solar boundary
};

export interface FrontLineObject {
  core: Line2;
  glow: Line2;
  geometry: LineGeometry;
  coreMaterial: LineMaterial;
  glowMaterial: LineMaterial;
}

export interface PrayerFrontsLayer {
  group: THREE.Group;
  setVisibility: (key: PrayerFrontKey, visible: boolean) => void;
  setAllVisibility: (visible: boolean) => void;
  setResolution: (width: number, height: number) => void;
  update: (
    subsolar: SubsolarCoordinates,
    convention?: CalculationParameters,
    madhab?: Madhab,
  ) => void;
  dispose: () => void;
}

const CORE_WIDTH_PX = 2.5;
const GLOW_WIDTH_PX = 8;

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
  const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

  // Each front is a crisp opaque core line (exact palette colour, no tone mapping)
  // plus a wide faint additive halo that gives the glow without washing the colour out.
  for (const key of frontKeys) {
    const geometry = new LineGeometry();

    const coreMaterial = new LineMaterial({
      color: PRAYER_COLORS[key],
      linewidth: CORE_WIDTH_PX,
      transparent: false,
      depthWrite: false,
      toneMapped: false,
      resolution,
    });

    const glowMaterial = new LineMaterial({
      color: PRAYER_COLORS[key],
      linewidth: GLOW_WIDTH_PX,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      resolution,
    });

    const glow = new Line2(geometry, glowMaterial);
    glow.name = `front-glow-${key}`;
    glow.visible = false;
    const core = new Line2(geometry, coreMaterial);
    core.name = `front-${key}`;
    core.visible = false;
    group.add(glow);
    group.add(core);

    linesMap.set(key, { core, glow, geometry, coreMaterial, glowMaterial });
  }

  const userVisible = new Map<PrayerFrontKey, boolean>(frontKeys.map((k) => [k, true]));
  const hasGeometry = new Map<PrayerFrontKey, boolean>(frontKeys.map((k) => [k, false]));

  const applyVisibility = (key: PrayerFrontKey): void => {
    const obj = linesMap.get(key);
    if (!obj) return;
    const show = Boolean(userVisible.get(key)) && Boolean(hasGeometry.get(key));
    obj.core.visible = show;
    obj.glow.visible = show;
  };

  const setVisibility = (key: PrayerFrontKey, visible: boolean): void => {
    userVisible.set(key, visible);
    applyVisibility(key);
  };

  const setAllVisibility = (visible: boolean): void => {
    for (const key of frontKeys) setVisibility(key, visible);
  };

  const setResolution = (width: number, height: number): void => {
    resolution.set(width, height);
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
      const count = contour.pointCount;
      if (count >= 2) {
        obj.geometry.setPositions(contour.positions.subarray(0, count * 3));
      }
      hasGeometry.set(key, count >= 2);
      applyVisibility(key);
    }
  };

  const dispose = (): void => {
    for (const [, obj] of linesMap) {
      obj.geometry.dispose();
      obj.coreMaterial.dispose();
      obj.glowMaterial.dispose();
    }
  };

  return {
    group,
    setVisibility,
    setAllVisibility,
    setResolution,
    update,
    dispose,
  };
}
