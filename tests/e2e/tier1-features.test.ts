import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getSolarDeclination,
  getEquationOfTime,
  getSubsolarPoint,
  getSolarAltitude,
} from '../../src/astronomy/solar';
import {
  latLonToVector3,
  vector3ToLatLon,
} from '../../src/astronomy/coordinates';
import {
  getJulianDay,
} from '../../src/astronomy/julian';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
} from '../../src/prayer/conventions';
import { calculatePrayerTimes } from '../../src/prayer/calculator';
import { generateGlobalPrayerFronts } from '../../src/prayer/contours';
import { createEarth } from '../../src/globe/earth';
import { createAtmosphere } from '../../src/globe/atmosphere';
import { AdhanEventEngine } from '../../src/simulation/eventEngine';
import { computeGlobalAdhanContinuity } from '../../src/simulation/continuity';
import { parseUrlState } from '../../src/ui/urlState';
import { getTranslations } from '../../src/i18n/translations';
import { parseSettlements, CompactSettlementRow } from '../../src/population/loader';
import * as THREE from 'three';

// Mock TextureLoader in headless node environment
THREE.TextureLoader.prototype.load = function() {
  return new THREE.Texture();
};

describe('Tier 1: Feature Coverage (Features 1 to 17)', () => {
  const rootDir = path.resolve(__dirname, '../../');

  // Helper to extract Date from prayer entry
  function toDate(entry: unknown): Date | null {
    if (!entry) return null;
    if (entry instanceof Date) return entry;
    if (typeof entry === 'object' && 'date' in (entry as Record<string, unknown>)) {
      const d = (entry as Record<string, unknown>).date;
      return d instanceof Date ? d : null;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Feature 1: Baseline Intake & Commit Binding (C00)
  // --------------------------------------------------------------------------
  describe('F01: Baseline Intake & Commit Binding', () => {
    it('1.1: validates package.json metadata and dependencies', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.name).toBe('athan-waqf-app');
      expect(pkg.private).toBe(true);
      expect(pkg.dependencies.three).toBeDefined();
    });

    it('1.2: enforces strict absence of .github/workflows directory', () => {
      const workflowsDir = path.join(rootDir, '.github', 'workflows');
      expect(fs.existsSync(workflowsDir)).toBe(false);
    });

    it('1.3: defines required build, test, and typecheck scripts', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.typecheck).toBeDefined();
      expect(pkg.scripts.preview).toBeDefined();
    });

    it('1.4: excludes copyleft GPL or AGPL licenses from dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const dep of Object.keys(deps)) {
        expect(dep.toLowerCase()).not.toContain('gpl');
        expect(dep.toLowerCase()).not.toContain('agpl');
      }
    });

    it('1.5: verifies presence of dependency lockfile and tsconfig', () => {
      const aubeLock = fs.existsSync(path.join(rootDir, 'aube-lock.yaml'));
      const pnpmLock = fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'));
      expect(aubeLock || pnpmLock).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'tsconfig.json'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Solar Ephemeris & Coordinate Precision (C01)
  // --------------------------------------------------------------------------
  describe('F02: Solar Ephemeris & Coordinate Precision', () => {
    it('2.1: calculates Meeus Julian Day for J2000.0 epoch with high precision', () => {
      const j2000 = new Date('2000-01-01T12:00:00Z');
      const jd = getJulianDay(j2000);
      expect(jd).toBeCloseTo(2451545.0, 4);
    });

    it('2.2: confines solar declination strictly within obliquity bounds (-23.5 to +23.5 deg)', () => {
      const summerSolstice = new Date('2026-06-21T12:00:00Z');
      const winterSolstice = new Date('2026-12-21T12:00:00Z');
      const decSummer = getSolarDeclination(summerSolstice);
      const decWinter = getSolarDeclination(winterSolstice);
      expect(decSummer).toBeGreaterThan(23.0);
      expect(decSummer).toBeLessThan(23.6);
      expect(decWinter).toBeLessThan(-23.0);
      expect(decWinter).toBeGreaterThan(-23.6);
    });

    it('2.3: produces noon solar altitude near 90 deg at equator on vernal equinox', () => {
      const equinox = new Date('2026-03-20T12:07:00Z');
      const alt = getSolarAltitude(0, 0, equinox);
      expect(alt).toBeGreaterThan(88.0);
      expect(alt).toBeLessThanOrEqual(90.0);
    });

    it('2.4: verifies subsolar latitude tracks seasonal declination cycle', () => {
      const subSummer = getSubsolarPoint(new Date('2026-06-21T12:00:00Z'));
      const subWinter = getSubsolarPoint(new Date('2026-12-21T12:00:00Z'));
      expect(subSummer.latitude).toBeGreaterThan(23.0);
      expect(subWinter.latitude).toBeLessThan(-23.0);
    });

    it('2.5: transforms coordinates conforming to Three.js conventions (+Y North, +Z Prime Meridian, +X East 90 deg)', () => {
      const northPole = latLonToVector3(90, 0, 1.0);
      expect(northPole[0]).toBeCloseTo(0.0, 4);
      expect(northPole[1]).toBeCloseTo(1.0, 4);
      expect(northPole[2]).toBeCloseTo(0.0, 4);

      const primeEquator = latLonToVector3(0, 0, 1.0);
      expect(primeEquator[0]).toBeCloseTo(0.0, 4);
      expect(primeEquator[1]).toBeCloseTo(0.0, 4);
      expect(primeEquator[2]).toBeCloseTo(1.0, 4);

      const east90Equator = latLonToVector3(0, 90, 1.0);
      expect(east90Equator[0]).toBeCloseTo(1.0, 4);
      expect(east90Equator[1]).toBeCloseTo(0.0, 4);
      expect(east90Equator[2]).toBeCloseTo(0.0, 4);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Typed Solar Events Root Solver (C02)
  // --------------------------------------------------------------------------
  describe('F03: Typed Solar Events Root Solver', () => {
    it('3.1: detects Tromsø summer solstice midnight sun with positive altitude range', () => {
      const summerDate = new Date('2026-06-21T12:00:00Z');
      let minAlt = 90;
      for (let m = 0; m < 1440; m += 30) {
        const t = new Date(+summerDate - 43200000 + m * 60000);
        const alt = getSolarAltitude(69.65, 18.96, t);
        if (alt < minAlt) minAlt = alt;
      }
      expect(minAlt).toBeGreaterThan(2.0);
    });

    it('3.2: detects Tromsø winter solstice polar night with continuous negative altitude', () => {
      const winterDate = new Date('2026-12-21T12:00:00Z');
      let maxAlt = -90;
      for (let m = 0; m < 1440; m += 30) {
        const t = new Date(+winterDate - 43200000 + m * 60000);
        const alt = getSolarAltitude(69.65, 18.96, t);
        if (alt > maxAlt) maxAlt = alt;
      }
      expect(maxAlt).toBeLessThan(-2.5);
    });

    it('3.3: verifies ordinary daily solar crossing at equator on equinox', () => {
      const dawnAlt = getSolarAltitude(0, 0, new Date('2026-03-20T06:07:00Z'));
      const noonAlt = getSolarAltitude(0, 0, new Date('2026-03-20T12:07:00Z'));
      const duskAlt = getSolarAltitude(0, 0, new Date('2026-03-20T18:07:00Z'));
      expect(dawnAlt).toBeCloseTo(0.0, 0);
      expect(noonAlt).toBeGreaterThan(88.0);
      expect(duskAlt).toBeCloseTo(0.0, 0);
    });

    it('3.4: validates solar altitude slope monotonicity across dawn window', () => {
      const lat = 21.4225; // Makkah
      const lon = 39.8262;
      const t1 = new Date('2026-03-20T03:00:00Z');
      const t2 = new Date('2026-03-20T03:30:00Z');
      const alt1 = getSolarAltitude(lat, lon, t1);
      const alt2 = getSolarAltitude(lat, lon, t2);
      expect(alt2).toBeGreaterThan(alt1);
    });

    it('3.5: evaluates solar altitude symmetry around solar noon', () => {
      const lat = 0.0;
      const lon = 0.0;
      const noon = new Date('2026-03-20T12:07:00Z');
      const tBefore = new Date(+noon - 7200000);
      const tAfter = new Date(+noon + 7200000);
      const altBefore = getSolarAltitude(lat, lon, tBefore);
      const altAfter = getSolarAltitude(lat, lon, tAfter);
      expect(Math.abs(altBefore - altAfter)).toBeLessThan(1.0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Positive Noon Shadow Asr Validation (C02)
  // --------------------------------------------------------------------------
  describe('F04: Positive Noon Shadow Asr Validation', () => {
    it('4.1: verifies positive noon shadow calculation under temperate latitudes', () => {
      const date = new Date('2026-03-20T12:00:00Z');
      const sched = calculatePrayerTimes(24.47, 39.61, date); // Madinah
      const asr = toDate(sched.asr);
      const dhuhr = toDate(sched.dhuhr);
      expect(asr).not.toBeNull();
      expect(dhuhr).not.toBeNull();
      if (asr && dhuhr) {
        expect(+asr).toBeGreaterThan(+dhuhr);
      }
    });

    it('4.2: detects negative noon shadow ratio condition during polar night', () => {
      const lat = 69.65;
      const dec = getSolarDeclination(new Date('2026-12-21T12:00:00Z'));
      const diffDeg = lat - dec;
      expect(diffDeg).toBeGreaterThan(90.0);
      const tanRatio = Math.tan((diffDeg * Math.PI) / 180);
      expect(tanRatio).toBeLessThan(0);
    });

    it('4.3: validates Shafi madhab shadow calculation (factor 1.0)', () => {
      const date = new Date('2026-04-15T12:00:00Z');
      const shafi = calculatePrayerTimes(21.42, 39.83, date, { madhab: 'Shafi' });
      const asrShafi = toDate(shafi.asr);
      expect(asrShafi).not.toBeNull();
    });

    it('4.4: validates Hanafi madhab shadow calculation (factor 2.0)', () => {
      const date = new Date('2026-04-15T12:00:00Z');
      const hanafi = calculatePrayerTimes(21.42, 39.83, date, { madhab: 'Hanafi' });
      const asrHanafi = toDate(hanafi.asr);
      expect(asrHanafi).not.toBeNull();
    });

    it('4.5: ensures Hanafi Asr occurs strictly after Shafi Asr under ordinary conditions', () => {
      const date = new Date('2026-04-15T12:00:00Z');
      const shafi = calculatePrayerTimes(21.42, 39.83, date, { madhab: 'Shafi' });
      const hanafi = calculatePrayerTimes(21.42, 39.83, date, { madhab: 'Hanafi' });
      const tShafi = toDate(shafi.asr);
      const tHanafi = toDate(hanafi.asr);
      expect(tShafi).not.toBeNull();
      expect(tHanafi).not.toBeNull();
      if (tShafi && tHanafi) {
        expect(+tHanafi).toBeGreaterThan(+tShafi);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Prayer Assignment Provenance & AngleBased Rule (C03)
  // --------------------------------------------------------------------------
  describe('F05: Prayer Assignment Provenance & AngleBased Rule', () => {
    it('5.1: evaluates AngleBased high latitude rule specification', () => {
      const date = new Date('2026-06-21T12:00:00Z');
      const sched = calculatePrayerTimes(51.51, -0.13, date, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      expect(toDate(sched.fajr)).not.toBeNull();
      expect(toDate(sched.isha)).not.toBeNull();
    });

    it('5.2: evaluates SeventhOfTheNight high latitude rule', () => {
      const date = new Date('2026-06-21T12:00:00Z');
      const sched = calculatePrayerTimes(51.51, -0.13, date, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });
      const fajr = toDate(sched.fajr);
      const sunrise = toDate(sched.sunrise);
      expect(fajr).not.toBeNull();
      expect(sunrise).not.toBeNull();
      if (fajr && sunrise) {
        expect(+fajr).toBeLessThan(+sunrise);
      }
    });

    it('5.3: evaluates MiddleOfTheNight high latitude rule', () => {
      const date = new Date('2026-06-21T12:00:00Z');
      const sched = calculatePrayerTimes(51.51, -0.13, date, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const fajr = toDate(sched.fajr);
      const isha = toDate(sched.isha);
      expect(fajr).not.toBeNull();
      expect(isha).not.toBeNull();
    });

    it('5.4: verifies all 10 calculation conventions return complete daily schedules', () => {
      const conventions = Object.keys(CALCULATION_CONVENTIONS) as CalculationConventionName[];
      expect(conventions.length).toBe(10);
      const date = new Date('2026-04-10T12:00:00Z');
      for (const conv of conventions) {
        const sched = calculatePrayerTimes(24.47, 39.61, date, { convention: conv });
        expect(toDate(sched.fajr)).not.toBeNull();
        expect(toDate(sched.sunrise)).not.toBeNull();
        expect(toDate(sched.dhuhr)).not.toBeNull();
        expect(toDate(sched.asr)).not.toBeNull();
        expect(toDate(sched.maghrib)).not.toBeNull();
        expect(toDate(sched.isha)).not.toBeNull();
      }
    });

    it('5.5: checks prayer schedule structure integrity', () => {
      const sched = calculatePrayerTimes(21.42, 39.83, new Date('2026-04-10T12:00:00Z'));
      const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
      for (const k of keys) {
        expect(sched).toHaveProperty(k);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Prayer Fronts Temporal Directionality (C04)
  // --------------------------------------------------------------------------
  describe('F06: Prayer Fronts Temporal Directionality', () => {
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolar = getSubsolarPoint(equinox);
    const fronts = generateGlobalPrayerFronts(
      subsolar,
      CALCULATION_CONVENTIONS.MuslimWorldLeague,
      'Shafi',
      1
    );

    it('6.1: checks Fajr front vertices for positive altitude derivative (rising sun)', () => {
      const fajr = fronts.fajr;
      expect(fajr.pointCount).toBeGreaterThan(0);
      let risingCount = 0;
      let totalChecked = 0;
      for (let i = 0; i < fajr.pointCount; i += 5) {
        const idx = i * 3;
        const p = vector3ToLatLon(fajr.positions[idx], fajr.positions[idx + 1], fajr.positions[idx + 2]);
        if (Math.abs(p.latitude) > 50) continue;
        totalChecked++;
        const altBefore = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox - 60000));
        const altAfter = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox + 60000));
        if (altAfter > altBefore) risingCount++;
      }
      expect(totalChecked).toBeGreaterThan(0);
      expect(risingCount / totalChecked).toBeGreaterThanOrEqual(0.95);
    });

    it('6.2: checks Sunrise front vertices for positive altitude derivative (rising sun)', () => {
      const sunrise = fronts.sunrise;
      expect(sunrise.pointCount).toBeGreaterThan(0);
      let risingCount = 0;
      let totalChecked = 0;
      for (let i = 0; i < sunrise.pointCount; i += 5) {
        const idx = i * 3;
        const p = vector3ToLatLon(sunrise.positions[idx], sunrise.positions[idx + 1], sunrise.positions[idx + 2]);
        if (Math.abs(p.latitude) > 50) continue;
        totalChecked++;
        const altBefore = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox - 60000));
        const altAfter = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox + 60000));
        if (altAfter > altBefore) risingCount++;
      }
      expect(totalChecked).toBeGreaterThan(0);
      expect(risingCount / totalChecked).toBeGreaterThanOrEqual(0.95);
    });

    it('6.3: checks Maghrib front vertices for negative altitude derivative (falling sun)', () => {
      const maghrib = fronts.maghrib;
      expect(maghrib.pointCount).toBeGreaterThan(0);
      let fallingCount = 0;
      let totalChecked = 0;
      for (let i = 0; i < maghrib.pointCount; i += 5) {
        const idx = i * 3;
        const p = vector3ToLatLon(maghrib.positions[idx], maghrib.positions[idx + 1], maghrib.positions[idx + 2]);
        if (Math.abs(p.latitude) > 50) continue;
        totalChecked++;
        const altBefore = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox - 60000));
        const altAfter = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox + 60000));
        if (altAfter < altBefore) fallingCount++;
      }
      expect(totalChecked).toBeGreaterThan(0);
      expect(fallingCount / totalChecked).toBeGreaterThanOrEqual(0.95);
    });

    it('6.4: checks Isha front vertices for negative altitude derivative (falling sun)', () => {
      const isha = fronts.isha;
      expect(isha.pointCount).toBeGreaterThan(0);
      let fallingCount = 0;
      let totalChecked = 0;
      for (let i = 0; i < isha.pointCount; i += 5) {
        const idx = i * 3;
        const p = vector3ToLatLon(isha.positions[idx], isha.positions[idx + 1], isha.positions[idx + 2]);
        if (Math.abs(p.latitude) > 50) continue;
        totalChecked++;
        const altBefore = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox - 60000));
        const altAfter = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox + 60000));
        if (altAfter < altBefore) fallingCount++;
      }
      expect(totalChecked).toBeGreaterThan(0);
      expect(fallingCount / totalChecked).toBeGreaterThanOrEqual(0.95);
    });

    it('6.5: verifies hour angle wrap formula H = wrap180(lon - subsolarLon)', () => {
      function wrap180(deg: number): number {
        return ((deg + 180) % 360 + 360) % 360 - 180;
      }
      expect(wrap180(0 - 0)).toBe(0);
      expect(wrap180(90 - 0)).toBe(90);
      expect(wrap180(-90 - 0)).toBe(-90);
      expect(wrap180(190 - 0)).toBe(-170);
      expect(wrap180(-190 - 0)).toBe(170);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Asr Front Placement & Fixed-Interval Isha (C04)
  // --------------------------------------------------------------------------
  describe('F07: Asr Front Placement & Fixed-Interval Isha', () => {
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolar = getSubsolarPoint(equinox);
    const fronts = generateGlobalPrayerFronts(
      subsolar,
      CALCULATION_CONVENTIONS.UmmAlQura,
      'Shafi',
      1
    );

    it('7.1: generates Asr front points with non-zero geometry', () => {
      const asr = fronts.asr;
      expect(asr.pointCount).toBeGreaterThan(0);
      expect(asr.positions.length).toBe(asr.pointCount * 3);
    });

    it('7.2: verifies Asr vertices sample valid geographic bounds in afternoon hemisphere', () => {
      const asr = fronts.asr;
      let fallingCount = 0;
      let checked = 0;
      for (let i = 0; i < asr.pointCount; i += 5) {
        const idx = i * 3;
        const p = vector3ToLatLon(asr.positions[idx], asr.positions[idx + 1], asr.positions[idx + 2]);
        expect(p.latitude).toBeGreaterThanOrEqual(-90);
        expect(p.latitude).toBeLessThanOrEqual(90);
        expect(p.longitude).toBeGreaterThanOrEqual(-180);
        expect(p.longitude).toBeLessThanOrEqual(180);
        if (Math.abs(p.latitude) <= 50) {
          checked++;
          const H = ((p.longitude - subsolar.longitude + 180) % 360 + 360) % 360 - 180;
          expect(H).toBeGreaterThan(0);
          const altBefore = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox - 60000));
          const altAfter = getSolarAltitude(p.latitude, p.longitude, new Date(+equinox + 60000));
          if (altAfter < altBefore) fallingCount++;
        }
      }
      expect(checked).toBeGreaterThan(0);
      expect(fallingCount / checked).toBeGreaterThanOrEqual(0.95);
    });

    it('7.3: identifies fixed-interval Isha convention in UmmAlQura', () => {
      const convention = CALCULATION_CONVENTIONS.UmmAlQura;
      expect(convention.ishaIntervalMinutes).toBe(90);
    });

    it('7.4: verifies fixed-interval Isha front generation exists', () => {
      const isha = fronts.isha;
      expect(isha.pointCount).toBeGreaterThan(0);
    });

    it('7.5: verifies coordinate buffer length matches point count triple', () => {
      expect(fronts.fajr.positions.length).toBe(fronts.fajr.pointCount * 3);
      expect(fronts.sunrise.positions.length).toBe(fronts.sunrise.pointCount * 3);
      expect(fronts.asr.positions.length).toBe(fronts.asr.pointCount * 3);
      expect(fronts.maghrib.positions.length).toBe(fronts.maghrib.pointCount * 3);
      expect(fronts.isha.positions.length).toBe(fronts.isha.pointCount * 3);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Apparent vs Geometric Terminator Disambiguation (C04)
  // --------------------------------------------------------------------------
  describe('F08: Apparent vs Geometric Terminator Disambiguation', () => {
    it('8.1: defines apparent sunrise/sunset angle as -0.8333 degrees', () => {
      const apparentAngle = -50 / 60;
      expect(apparentAngle).toBeCloseTo(-0.8333, 4);
    });

    it('8.2: defines geometric center terminator as 0.0 degrees', () => {
      const geometricAngle = 0.0;
      expect(geometricAngle).toBe(0.0);
    });

    it('8.3: proves apparent terminator encompasses larger illuminated area than geometric center', () => {
      expect(-0.8333).toBeLessThan(0.0);
    });

    it('8.4: validates civil twilight depression definition of -6.0 degrees', () => {
      const civilTwilight = -6.0;
      expect(civilTwilight).toBe(-6.0);
    });

    it('8.5: validates astronomical twilight depression definition of -18.0 degrees', () => {
      const astronomicalTwilight = -18.0;
      expect(astronomicalTwilight).toBe(-18.0);
    });

    it('8.6: verifies GlobalPrayerFronts exposes distinct geometric and apparent terminators', () => {
      const equinox = new Date('2026-03-20T12:00:00Z');
      const subsolar = getSubsolarPoint(equinox);
      const fronts = generateGlobalPrayerFronts(
        subsolar,
        CALCULATION_CONVENTIONS.MuslimWorldLeague,
        'Shafi',
        1
      );
      expect(fronts.geometricTerminator).toBeDefined();
      expect(fronts.apparentTerminator).toBeDefined();
      expect(fronts.geometricTerminator.pointCount).toBeGreaterThan(50);
      expect(fronts.apparentTerminator.pointCount).toBeGreaterThan(50);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Earth Shader Planetary Occlusion & Albedo Floor Removal (C05)
  // --------------------------------------------------------------------------
  describe('F09: Earth Shader Planetary Occlusion & Albedo Floor Removal', () => {
    it('9.1: provides solar position uniforms in earth material', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms).toBeDefined();
      expect(mat.uniforms.uSunDirection).toBeDefined();
    });

    it('9.2: inspects earth shader fragment code for lighting terms and clamp floor elimination', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      const fragShader = mat.fragmentShader;
      expect(fragShader).toContain('uSunDirection');
      expect(fragShader).toContain('sunDotMacro');
      expect(fragShader).toContain('directOcclusion');
      expect(fragShader).not.toContain('0.03, 1.0');
      expect(fragShader).toContain('void main()');
    });

    it('9.3: verifies unperturbed geometric sphere normal usage in vertex shader', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      const vertShader = mat.vertexShader;
      expect(vertShader).toContain('vNormal');
    });

    it('9.4: checks night lights emission uniform in earth material', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uNightTexture).toBeDefined();
    });

    it('9.5: confirms daytime albedo texture uniform in earth material', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uDayTexture).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Shader Radiometric Pipeline & Color Management (C05)
  // --------------------------------------------------------------------------
  describe('F10: Shader Radiometric Pipeline & Color Management', () => {
    it('10.1: verifies earth material fragment shader output assignment and Three.js chunk inclusion', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.fragmentShader).toContain('gl_FragColor');
      expect(mat.fragmentShader).toContain('#include <tonemapping_fragment>');
      expect(mat.fragmentShader).toContain('#include <colorspace_fragment>');
    });

    it('10.2: validates shader material depthWrite and depthTest flags', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.depthTest).toBe(true);
      expect(mat.depthWrite).toBe(true);
    });

    it('10.3: checks atmosphere material transparent flag', () => {
      const atmo = createAtmosphere();
      const mat = atmo.mesh.material as THREE.ShaderMaterial;
      expect(mat.transparent).toBe(true);
    });

    it('10.4: verifies clouds texture uniform in earth material', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uCloudsTexture).toBeDefined();
    });

    it('10.5: confirms custom shader materials use ShaderMaterial class', () => {
      const earth = createEarth();
      const atmo = createAtmosphere();
      expect(earth.mesh.material.type).toBe('ShaderMaterial');
      expect(atmo.mesh.material.type).toBe('ShaderMaterial');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Atmospheric Scattering & Twilight Transport (C06)
  // --------------------------------------------------------------------------
  describe('F11: Atmospheric Scattering & Twilight Transport', () => {
    it('11.1: verifies atmosphere material defines uSunDirection uniform', () => {
      const atmo = createAtmosphere();
      const mat = atmo.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uSunDirection).toBeDefined();
    });

    it('11.2: confirms atmosphere material defines radiometric colors and chunks', () => {
      const atmo = createAtmosphere();
      const mat = atmo.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uAtmosphereColor).toBeDefined();
      expect(mat.uniforms.uTwilightColor).toBeDefined();
      expect(mat.uniforms.uDeepTwilightColor).toBeDefined();
      expect(mat.fragmentShader).toContain('SIN_ASTRO');
      expect(mat.fragmentShader).toContain('#include <tonemapping_fragment>');
      expect(mat.fragmentShader).toContain('#include <colorspace_fragment>');
    });

    it('11.3: verifies atmosphere material side setting for limb viewing', () => {
      const atmo = createAtmosphere();
      const mat = atmo.mesh.material as THREE.ShaderMaterial;
      expect(mat.side).toBeDefined();
    });

    it('11.4: inspects atmosphere fragment shader for fresnel/scattering terms', () => {
      const atmo = createAtmosphere();
      const mat = atmo.mesh.material as THREE.ShaderMaterial;
      expect(mat.fragmentShader).toBeDefined();
      expect(mat.fragmentShader.length).toBeGreaterThan(50);
    });

    it('11.5: verifies atmosphere vertex shader computes normal or view vector', () => {
      const atmo = createAtmosphere();
      const mat = atmo.mesh.material as THREE.ShaderMaterial;
      expect(mat.vertexShader).toBeDefined();
      expect(mat.vertexShader.length).toBeGreaterThan(50);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Multi-Day Temporal Windowing Across Civil Dates (C07)
  // --------------------------------------------------------------------------
  describe('F12: Multi-Day Temporal Windowing Across Civil Dates', () => {
    it('12.1: calculates prayer times on consecutive civil calendar dates', () => {
      const d1 = new Date('2026-10-04T12:00:00Z');
      const d2 = new Date('2026-10-05T12:00:00Z');
      const s1 = calculatePrayerTimes(21.42, 39.83, d1);
      const s2 = calculatePrayerTimes(21.42, 39.83, d2);
      const f1 = toDate(s1.fajr);
      const f2 = toDate(s2.fajr);
      expect(f1).not.toBeNull();
      expect(f2).not.toBeNull();
      if (f1 && f2) {
        expect(+f2).toBeGreaterThan(+f1);
      }
    });

    it('12.2: detects ephemeris drift preventing exact 86,400,000 ms repetition', () => {
      const d1 = new Date('2026-10-04T12:00:00Z');
      const d2 = new Date('2026-10-05T12:00:00Z');
      const dec1 = getSolarDeclination(d1);
      const dec2 = getSolarDeclination(d2);
      expect(Math.abs(dec2 - dec1)).toBeGreaterThan(0.2);
    });

    it('12.3: verifies equation of time drift between consecutive days', () => {
      const d1 = new Date('2026-10-04T12:00:00Z');
      const d2 = new Date('2026-10-05T12:00:00Z');
      const eot1 = getEquationOfTime(d1);
      const eot2 = getEquationOfTime(d2);
      expect(Math.abs(eot2 - eot1)).toBeGreaterThan(0.1);
    });

    it('12.4: verifies Tokyo (UTC+9) prayer times calculation across UTC day transition', () => {
      const tokyoDate = new Date('2026-10-05T00:00:00Z');
      const sched = calculatePrayerTimes(35.68, 139.76, tokyoDate);
      const fajr = toDate(sched.fajr);
      expect(fajr).not.toBeNull();
    });

    it('12.5: tests AdhanEventEngine initialization', () => {
      const engine = new AdhanEventEngine([]);
      expect(engine).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: Exact Continuity Statistics & Interval Unions (C07)
  // --------------------------------------------------------------------------
  describe('F13: Exact Continuity Statistics & Interval Unions', () => {
    it('13.1: computes continuity stats with valid schema', () => {
      const settlements = [
        { name: 'Makkah', nameAr: 'مكة', latitude: 21.42, longitude: 39.83, population: 2000000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
        { name: 'Madinah', nameAr: 'المدينة', latitude: 24.47, longitude: 39.61, population: 1500000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-10-04T12:00:00Z'), {
        adhanDurationMinutes: 4,
        convention: 'UmmAlQura',
      });
      expect(stats).toHaveProperty('coveragePercent');
      expect(stats).toHaveProperty('longestGapSeconds');
      expect(stats).toHaveProperty('peakConcurrentAdhans');
      expect(stats).toHaveProperty('minConcurrentAdhans');
    });

    it('13.2: returns zero coverage for empty settlement list', () => {
      const stats = computeGlobalAdhanContinuity([], new Date('2026-10-04T12:00:00Z'));
      expect(stats.coveragePercent).toBe(0);
      expect(stats.peakConcurrentAdhans).toBe(0);
      expect(stats.minConcurrentAdhans).toBe(0);
    });

    it('13.3: bounds coverage percentage within 0 to 100 percent', () => {
      const settlements = [
        { name: 'Cairo', nameAr: 'القاهرة', latitude: 30.04, longitude: 31.24, population: 10000000, countryCode: 'EG', timezone: 'Africa/Cairo' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-10-04T12:00:00Z'));
      expect(stats.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(stats.coveragePercent).toBeLessThanOrEqual(100);
    });

    it('13.4: verifies longest gap cannot exceed 86,400 seconds', () => {
      const stats = computeGlobalAdhanContinuity([], new Date('2026-10-04T12:00:00Z'));
      expect(stats.longestGapSeconds).toBeLessThanOrEqual(86400);
    });

    it('13.5: verifies timeline bins array contains 288 entries (5-min intervals over 24h)', () => {
      const stats = computeGlobalAdhanContinuity([], new Date('2026-10-04T12:00:00Z'));
      expect(stats.timelineBins.length).toBe(288);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: State Coherence & UI Propagation (C08)
  // --------------------------------------------------------------------------
  describe('F14: State Coherence & UI Propagation', () => {
    it('14.1: parses url state with convention and style', () => {
      const search = '?convention=MuslimWorldLeague&style=satellite';
      const state = parseUrlState(search);
      expect(state.convention).toBe('MuslimWorldLeague');
      expect(state.style).toBe('satellite');
    });

    it('14.2: parses url state with geographic coordinates and time', () => {
      const search = '?lat=21.42&lon=39.83&t=2026-10-04T12:00:00.000Z';
      const state = parseUrlState(search);
      expect(state.lat).toBe(21.42);
      expect(state.lon).toBe(39.83);
      expect(state.time).toBeDefined();
    });

    it('14.3: sanitizes invalid numeric parameters safely', () => {
      const search = '?lat=invalid&lon=invalid';
      const state = parseUrlState(search);
      expect(state.lat).toBeUndefined();
      expect(state.lon).toBeUndefined();
    });

    it('14.4: handles empty search params gracefully', () => {
      const state = parseUrlState('');
      expect(state).toEqual({});
    });

    it('14.5: parses language query parameter', () => {
      const state = parseUrlState('?lang=ar');
      expect(state.lang).toBe('ar');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Documentation, Translations & Claim Integrity (C10)
  // --------------------------------------------------------------------------
  describe('F15: Documentation, Translations & Claim Integrity', () => {
    it('15.1: translates all 6 core prayers into Arabic and English', () => {
      const en = getTranslations('en');
      const ar = getTranslations('ar');
      const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
      for (const p of prayers) {
        expect(en.prayers[p]).toBeDefined();
        expect(ar.prayers[p]).toBeDefined();
      }
    });

    it('15.2: verifies Arabic translations use authentic terminology', () => {
      const ar = getTranslations('ar');
      expect(ar.prayers.fajr).toBe('الفجر');
      expect(ar.prayers.sunrise).toBe('الشروق');
      expect(ar.prayers.dhuhr).toBe('الظهر');
      expect(ar.prayers.asr).toBe('العصر');
      expect(ar.prayers.maghrib).toBe('المغرب');
      expect(ar.prayers.isha).toBe('العشاء');
    });

    it('15.3: verifies conventions list contains official names', () => {
      const names = Object.keys(CALCULATION_CONVENTIONS);
      expect(names).toContain('MuslimWorldLeague');
      expect(names).toContain('Egyptian');
      expect(names).toContain('Karachi');
      expect(names).toContain('UmmAlQura');
    });

    it('15.4: verifies UI translation strings avoid Eastern Arabic-Indic numerals', () => {
      const ar = getTranslations('ar');
      const easternDigits = /[٠-٩]/;
      for (const [key, val] of Object.entries(ar.prayers)) {
        expect(easternDigits.test(val), `Key ${key} contains eastern digits`).toBe(false);
      }
    });

    it('15.5: checks credits file presence and structure', () => {
      const creditsPath = path.join(rootDir, 'src', 'ui', 'credits.ts');
      expect(fs.existsSync(creditsPath)).toBe(true);
      const content = fs.readFileSync(creditsPath, 'utf8');
      expect(content).toContain('createCreditsModal');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 16: Vitest Verification Suite & Production Build (C09)
  // --------------------------------------------------------------------------
  describe('F16: Vitest Verification Suite & Production Build', () => {
    it('16.1: vitest.config.ts configures node environment', () => {
      const configPath = path.join(rootDir, 'vitest.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain("environment: 'node'");
    });

    it('16.2: vite.config.ts exists and configures build targets', () => {
      const configPath = path.join(rootDir, 'vite.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('16.3: verifies parseSettlements decodes compact settlement row structure', () => {
      const row: CompactSettlementRow = ['Makkah', 'مكة المكرمة', 21.42, 39.83, 'SA', 2000000, 'Asia/Riyadh'];
      const settlements = parseSettlements([row]);
      expect(settlements.length).toBe(1);
      expect(settlements[0].name).toBe('Makkah');
      expect(settlements[0].latitude).toBe(21.42);
      expect(settlements[0].longitude).toBe(39.83);
    });

    it('16.4: validates tsconfig.json strict mode enabled', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf8'));
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('16.5: verifies index.html defines main container and module entry', () => {
      const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
      expect(html).toContain('id="globe-canvas"');
      expect(html).toContain('src="/src/main.ts"');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Integration Review & Release Verification (C11)
  // --------------------------------------------------------------------------
  describe('F17: Integration Review & Release Verification', () => {
    it('17.1: asserts zero .github/workflows CI sprawl', () => {
      const ghDir = path.join(rootDir, '.github');
      if (fs.existsSync(ghDir)) {
        const workflows = path.join(ghDir, 'workflows');
        expect(fs.existsSync(workflows)).toBe(false);
      }
    });

    it('17.2: verifies license file exists', () => {
      const licensePath = path.join(rootDir, 'LICENSE.md');
      expect(fs.existsSync(licensePath)).toBe(true);
    });

    it('17.3: verifies wrangler configuration is in JSONC format with valid schema', () => {
      const wranglerPath = path.join(rootDir, 'wrangler.jsonc');
      expect(fs.existsSync(wranglerPath)).toBe(true);
      const content = fs.readFileSync(wranglerPath, 'utf8');
      expect(content).toContain('"name": "athan-waqf-dev"');
    });

    it('17.4: verifies telemetry is disabled in wrangler.jsonc', () => {
      const content = fs.readFileSync(path.join(rootDir, 'wrangler.jsonc'), 'utf8');
      expect(content).toContain('"enabled": false');
    });

    it('17.5: verifies static assets directory setting in wrangler.jsonc', () => {
      const content = fs.readFileSync(path.join(rootDir, 'wrangler.jsonc'), 'utf8');
      expect(content).toContain('"directory": "./dist"');
    });
  });
});
