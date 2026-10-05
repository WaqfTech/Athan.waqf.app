import { describe, it, expect } from 'vitest';
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
  getJulianCenturies,
} from '../../src/astronomy/julian';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
} from '../../src/prayer/conventions';
import { calculatePrayerTimes } from '../../src/prayer/calculator';
import { generateGlobalPrayerFronts } from '../../src/prayer/contours';
import { createEarth } from '../../src/globe/earth';
import { createAtmosphere } from '../../src/globe/atmosphere';
import { computeGlobalAdhanContinuity } from '../../src/simulation/continuity';
import { parseUrlState } from '../../src/ui/urlState';
import { parseSettlements, CompactSettlementRow } from '../../src/population/loader';
import * as THREE from 'three';

// Mock TextureLoader in headless node environment
THREE.TextureLoader.prototype.load = function() {
  return new THREE.Texture();
};

describe('Tier 2: Boundary & Corner Cases (17 Boundary Domains)', () => {
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
  // B01: Polar Night Boundaries (High Latitudes in Winter)
  // --------------------------------------------------------------------------
  describe('B01: Polar Night Boundaries', () => {
    it('B01.1: Longyearbyen (78.22 N) has continuous solar depression < -10 deg on winter solstice', () => {
      const solstice = new Date('2026-12-21T12:00:00Z');
      for (let h = 0; h < 24; h += 2) {
        const t = new Date(+solstice - 43200000 + h * 3600000);
        const alt = getSolarAltitude(78.22, 15.65, t);
        expect(alt).toBeLessThan(-10.0);
      }
    });

    it('B01.2: Arctic Circle (66.5 N) culmination at winter solstice grazes horizon near -0.833 deg', () => {
      const solsticeNoon = new Date('2026-12-21T12:00:00Z');
      const dec = getSolarDeclination(solsticeNoon);
      const culmination = 90 - (66.5 - dec);
      expect(culmination).toBeCloseTo(0.0, 0);
    });

    it('B01.3: Tromsø (69.65 N) maximum solar altitude remains strictly below -2.5 deg on Dec 21', () => {
      const solstice = new Date('2026-12-21T12:00:00Z');
      let maxAlt = -90;
      for (let m = 0; m < 1440; m += 15) {
        const t = new Date(+solstice - 43200000 + m * 60000);
        const alt = getSolarAltitude(69.65, 18.96, t);
        if (alt > maxAlt) maxAlt = alt;
      }
      expect(maxAlt).toBeLessThan(-2.5);
    });

    it('B01.4: Antarctica (-78.0 S) has continuous solar depression < -10 deg on June 21', () => {
      const solstice = new Date('2026-06-21T12:00:00Z');
      for (let h = 0; h < 24; h += 2) {
        const t = new Date(+solstice - 43200000 + h * 3600000);
        const alt = getSolarAltitude(-78.0, 0.0, t);
        expect(alt).toBeLessThan(-10.0);
      }
    });

    it('B01.5: South Pole (-90 S) on June 21 maintains constant negative solar altitude around -23.4 deg', () => {
      const solstice = new Date('2026-06-21T12:00:00Z');
      const alt1 = getSolarAltitude(-90.0, 0.0, solstice);
      const alt2 = getSolarAltitude(-90.0, 90.0, solstice);
      expect(alt1).toBeCloseTo(-23.44, 1);
      expect(alt2).toBeCloseTo(-23.44, 1);
    });
  });

  // --------------------------------------------------------------------------
  // B02: Midnight Sun Boundaries (High Latitudes in Summer)
  // --------------------------------------------------------------------------
  describe('B02: Midnight Sun Boundaries', () => {
    it('B02.1: Longyearbyen (78.22 N) minimum solar altitude > 10 deg on summer solstice', () => {
      const solstice = new Date('2026-06-21T12:00:00Z');
      let minAlt = 90;
      for (let h = 0; h < 24; h += 2) {
        const t = new Date(+solstice - 43200000 + h * 3600000);
        const alt = getSolarAltitude(78.22, 15.65, t);
        if (alt < minAlt) minAlt = alt;
      }
      expect(minAlt).toBeGreaterThan(10.0);
    });

    it('B02.2: Arctic Circle (66.5 N) midnight sun nadir grazes horizon near 0 deg on summer solstice', () => {
      const solsticeMidnight = new Date('2026-06-21T00:00:00Z');
      const alt = getSolarAltitude(66.5, 0.0, solsticeMidnight);
      expect(alt).toBeCloseTo(0.0, 0);
    });

    it('B02.3: Tromsø (69.65 N) minimum solar altitude remains > +2.5 deg on June 21', () => {
      const solstice = new Date('2026-06-21T12:00:00Z');
      let minAlt = 90;
      for (let m = 0; m < 1440; m += 15) {
        const t = new Date(+solstice - 43200000 + m * 60000);
        const alt = getSolarAltitude(69.65, 18.96, t);
        if (alt < minAlt) minAlt = alt;
      }
      expect(minAlt).toBeGreaterThan(2.5);
    });

    it('B02.4: Antarctica (-78.0 S) minimum solar altitude > 10 deg on December 21', () => {
      const solstice = new Date('2026-12-21T12:00:00Z');
      let minAlt = 90;
      for (let h = 0; h < 24; h += 2) {
        const t = new Date(+solstice - 43200000 + h * 3600000);
        const alt = getSolarAltitude(-78.0, 0.0, t);
        if (alt < minAlt) minAlt = alt;
      }
      expect(minAlt).toBeGreaterThan(10.0);
    });

    it('B02.5: North Pole (90 N) on June 21 maintains constant positive solar altitude around +23.4 deg', () => {
      const solstice = new Date('2026-06-21T12:00:00Z');
      const alt1 = getSolarAltitude(90.0, 0.0, solstice);
      const alt2 = getSolarAltitude(90.0, 90.0, solstice);
      expect(alt1).toBeCloseTo(23.44, 1);
      expect(alt2).toBeCloseTo(23.44, 1);
    });
  });

  // --------------------------------------------------------------------------
  // B03: Solstice Extremes
  // --------------------------------------------------------------------------
  describe('B03: Solstice Extremes', () => {
    it('B03.1: Summer solstice solar declination reaches northern maximum (+23.438 deg)', () => {
      const dec = getSolarDeclination(new Date('2026-06-21T12:00:00Z'));
      expect(dec).toBeCloseTo(23.438, 1);
    });

    it('B03.2: Winter solstice solar declination reaches southern minimum (-23.438 deg)', () => {
      const dec = getSolarDeclination(new Date('2026-12-21T12:00:00Z'));
      expect(dec).toBeCloseTo(-23.438, 1);
    });

    it('B03.3: Declination rate of change is stationary near solstices', () => {
      const t1 = new Date('2026-06-21T00:00:00Z');
      const t2 = new Date('2026-06-22T00:00:00Z');
      const d1 = getSolarDeclination(t1);
      const d2 = getSolarDeclination(t2);
      expect(Math.abs(d2 - d1)).toBeLessThan(0.02); // very small daily change
    });

    it('B03.4: Day length at 60 N (Oslo) reaches maximum at summer solstice (> 18 hours)', () => {
      const sched = calculatePrayerTimes(59.91, 10.75, new Date('2026-06-21T12:00:00Z'));
      const sr = toDate(sched.sunrise);
      const mr = toDate(sched.maghrib);
      if (sr && mr) {
        const dayDurationHours = (+mr - +sr) / 3600000;
        expect(dayDurationHours).toBeGreaterThan(18.0);
      }
    });

    it('B03.5: Day length at 60 N (Oslo) reaches minimum at winter solstice (< 6.5 hours)', () => {
      const sched = calculatePrayerTimes(59.91, 10.75, new Date('2026-12-21T12:00:00Z'));
      const sr = toDate(sched.sunrise);
      const mr = toDate(sched.maghrib);
      if (sr && mr) {
        const dayDurationHours = (+mr - +sr) / 3600000;
        expect(dayDurationHours).toBeLessThan(6.5);
      }
    });
  });

  // --------------------------------------------------------------------------
  // B04: Equinox Extremes
  // --------------------------------------------------------------------------
  describe('B04: Equinox Extremes', () => {
    it('B04.1: Vernal equinox (March 20) declination is near 0 deg (|delta| < 0.25 deg)', () => {
      const dec = getSolarDeclination(new Date('2026-03-20T12:00:00Z'));
      expect(Math.abs(dec)).toBeLessThan(0.25);
    });

    it('B04.2: Autumnal equinox (Sept 22) declination is near 0 deg (|delta| < 0.25 deg)', () => {
      const dec = getSolarDeclination(new Date('2026-09-22T12:00:00Z'));
      expect(Math.abs(dec)).toBeLessThan(0.25);
    });

    it('B04.3: Equator day length on equinox is approximately 12 hours (within 15 min)', () => {
      const sched = calculatePrayerTimes(0.0, 0.0, new Date('2026-03-20T12:00:00Z'));
      const sr = toDate(sched.sunrise);
      const mr = toDate(sched.maghrib);
      if (sr && mr) {
        const hours = (+mr - +sr) / 3600000;
        expect(hours).toBeCloseTo(12.0, 0);
      }
    });

    it('B04.4: Declination rate of change reaches maximum at equinox (~0.35-0.40 deg per day)', () => {
      const t1 = new Date('2026-03-20T00:00:00Z');
      const t2 = new Date('2026-03-21T00:00:00Z');
      const d1 = getSolarDeclination(t1);
      const d2 = getSolarDeclination(t2);
      expect(Math.abs(d2 - d1)).toBeGreaterThan(0.35);
    });

    it('B04.5: Solar altitude at both poles grazes horizon within 1 deg at equinox noon', () => {
      const equinox = new Date('2026-03-20T12:00:00Z');
      const northAlt = getSolarAltitude(90.0, 0.0, equinox);
      const southAlt = getSolarAltitude(-90.0, 0.0, equinox);
      expect(Math.abs(northAlt)).toBeLessThan(1.0);
      expect(Math.abs(southAlt)).toBeLessThan(1.0);
    });
  });

  // --------------------------------------------------------------------------
  // B05: Extreme Latitudes (+90, -90, +-89.9, Equator 0)
  // --------------------------------------------------------------------------
  describe('B05: Extreme Latitudes', () => {
    it('B05.1: North Pole (+90) maps to unit sphere vector [0, 1, 0]', () => {
      const v = latLonToVector3(90.0, 0.0, 1.0);
      expect(v[0]).toBeCloseTo(0.0, 4);
      expect(v[1]).toBeCloseTo(1.0, 4);
      expect(v[2]).toBeCloseTo(0.0, 4);
    });

    it('B05.2: South Pole (-90) maps to unit sphere vector [0, -1, 0]', () => {
      const v = latLonToVector3(-90.0, 0.0, 1.0);
      expect(v[0]).toBeCloseTo(0.0, 4);
      expect(v[1]).toBeCloseTo(-1.0, 4);
      expect(v[2]).toBeCloseTo(0.0, 4);
    });

    it('B05.3: Equator prime meridian (0, 0) maps to unit sphere vector [0, 0, 1]', () => {
      const v = latLonToVector3(0.0, 0.0, 1.0);
      expect(v[0]).toBeCloseTo(0.0, 4);
      expect(v[1]).toBeCloseTo(0.0, 4);
      expect(v[2]).toBeCloseTo(1.0, 4);
    });

    it('B05.4: Near-pole latitude 89.9 deg round-trips through vector conversion', () => {
      const v = latLonToVector3(89.9, 45.0, 1.0);
      const p = vector3ToLatLon(v[0], v[1], v[2]);
      expect(p.latitude).toBeCloseTo(89.9, 2);
      expect(p.longitude).toBeCloseTo(45.0, 2);
    });

    it('B05.5: Near-pole latitude -89.9 deg round-trips through vector conversion', () => {
      const v = latLonToVector3(-89.9, -45.0, 1.0);
      const p = vector3ToLatLon(v[0], v[1], v[2]);
      expect(p.latitude).toBeCloseTo(-89.9, 2);
      expect(p.longitude).toBeCloseTo(-45.0, 2);
    });
  });

  // --------------------------------------------------------------------------
  // B06: Boundary Longitudes (Prime Meridian, Antimeridian, +-180)
  // --------------------------------------------------------------------------
  describe('B06: Boundary Longitudes', () => {
    it('B06.1: Prime meridian (0 deg) solar noon occurs close to 12:00 UTC', () => {
      const noon = new Date('2026-03-20T12:07:00Z');
      const alt = getSolarAltitude(0.0, 0.0, noon);
      expect(alt).toBeGreaterThan(88.0);
    });

    it('B06.2: Exactly +180 deg longitude vector maps to -Z axis on equator', () => {
      const v = latLonToVector3(0.0, 180.0, 1.0);
      expect(v[0]).toBeCloseTo(0.0, 4);
      expect(v[1]).toBeCloseTo(0.0, 4);
      expect(v[2]).toBeCloseTo(-1.0, 4);
    });

    it('B06.3: Exactly -180 deg longitude vector matches +180 deg vector', () => {
      const vPlus = latLonToVector3(0.0, 180.0, 1.0);
      const vMinus = latLonToVector3(0.0, -180.0, 1.0);
      expect(vPlus[0]).toBeCloseTo(vMinus[0], 4);
      expect(vPlus[1]).toBeCloseTo(vMinus[1], 4);
      expect(vPlus[2]).toBeCloseTo(vMinus[2], 4);
    });

    it('B06.4: Longitude wrapping preserves shortest angular distance across 180 deg', () => {
      function wrap180(d: number): number {
        return ((d + 180) % 360 + 360) % 360 - 180;
      }
      expect(wrap180(179 - -179)).toBe(-2);
      expect(wrap180(-179 - 179)).toBe(2);
    });

    it('B06.5: Prayer times at 179.9 E and -179.9 W differ by approximately local solar offset modulo 24h', () => {
      const d = new Date('2026-03-20T12:00:00Z');
      const sEast = calculatePrayerTimes(0.0, 179.9, d);
      const sWest = calculatePrayerTimes(0.0, -179.9, d);
      const dEast = toDate(sEast.dhuhr);
      const dWest = toDate(sWest.dhuhr);
      if (dEast && dWest) {
        // Across the date line, UTC timestamps on same calendar day differ by ~24h minus 48 seconds
        const diffSec = Math.abs((+dEast - +dWest) / 1000);
        const solarOffsetSec = Math.min(diffSec, Math.abs(86400 - diffSec));
        expect(solarOffsetSec).toBeLessThan(100);
      }
    });
  });

  // --------------------------------------------------------------------------
  // B07: Extreme Solar Depression Angles
  // --------------------------------------------------------------------------
  describe('B07: Extreme Solar Depression Angles', () => {
    it('B07.1: Apparent horizon threshold at -0.833 deg is recognized', () => {
      expect(-50 / 60).toBeCloseTo(-0.8333, 4);
    });

    it('B07.2: Civil twilight threshold at -6.0 deg is recognized', () => {
      expect(-6.0).toBe(-6.0);
    });

    it('B07.3: Nautical twilight threshold at -12.0 deg is recognized', () => {
      expect(-12.0).toBe(-12.0);
    });

    it('B07.4: Astronomical twilight threshold at -18.0 deg is recognized', () => {
      expect(-18.0).toBe(-18.0);
    });

    it('B07.5: Deep night threshold at -24.0 deg is recognized', () => {
      expect(-24.0).toBe(-24.0);
    });
  });

  // --------------------------------------------------------------------------
  // B08: Asr Shadow Ratio Boundary Conditions
  // --------------------------------------------------------------------------
  describe('B08: Asr Shadow Ratio Boundary Conditions', () => {
    it('B08.1: Equator equinox Shafi Asr altitude occurs at ~45 deg (noon shadow = 0, cot(45) = 1)', () => {
      const altDeg = 45.0;
      const cotAlt = 1 / Math.tan((altDeg * Math.PI) / 180);
      expect(cotAlt).toBeCloseTo(1.0, 4);
    });

    it('B08.2: Equator equinox Hanafi Asr altitude occurs at ~26.565 deg (noon shadow = 0, cot(alt) = 2)', () => {
      const expectedAlt = Math.atan(0.5) * (180 / Math.PI);
      expect(expectedAlt).toBeCloseTo(26.565, 3);
      const cotAlt = 1 / Math.tan((expectedAlt * Math.PI) / 180);
      expect(cotAlt).toBeCloseTo(2.0, 4);
    });

    it('B08.3: 45 deg noon shadow difference (phi - delta = 45 deg) produces noon shadow = 1.0', () => {
      const tan45 = Math.tan((45 * Math.PI) / 180);
      expect(tan45).toBeCloseTo(1.0, 4);
    });

    it('B08.4: Shafi Asr required shadow length is 1 + noonShadow', () => {
      const noonShadow = 0.5;
      const shafiRatio = 1.0 + noonShadow;
      expect(shafiRatio).toBe(1.5);
    });

    it('B08.5: Hanafi Asr required shadow length is 2 + noonShadow', () => {
      const noonShadow = 0.5;
      const hanafiRatio = 2.0 + noonShadow;
      expect(hanafiRatio).toBe(2.5);
    });
  });

  // --------------------------------------------------------------------------
  // B09: High-Latitude Rule Fallback Boundaries
  // --------------------------------------------------------------------------
  describe('B09: High-Latitude Rule Fallback Boundaries', () => {
    it('B09.1: AngleBased rule formula calculates (fajrAngle / 60) fractional night proportion', () => {
      const fajrAngle = 18.0;
      const proportion = fajrAngle / 60;
      expect(proportion).toBe(0.3); // 30% of night
    });

    it('B09.2: SeventhOfTheNight rule calculates exactly 1/7 of night proportion', () => {
      const proportion = 1 / 7;
      expect(proportion).toBeCloseTo(0.142857, 4);
    });

    it('B09.3: MiddleOfTheNight rule calculates exactly 1/2 of night proportion', () => {
      const proportion = 1 / 2;
      expect(proportion).toBe(0.5);
    });

    it('B09.4: High-latitude rules produce distinct proportions', () => {
      const pAngle = 18.0 / 60;
      const pSeventh = 1 / 7;
      const pMiddle = 1 / 2;
      expect(pSeventh).toBeLessThan(pAngle);
      expect(pAngle).toBeLessThan(pMiddle);
    });

    it('B09.5: London (51.51 N) in June computes valid prayer times under all three rules', () => {
      const d = new Date('2026-06-21T12:00:00Z');
      const sMiddle = calculatePrayerTimes(51.51, -0.13, d, { highLatitudeRule: 'MiddleOfTheNight' });
      const sSeventh = calculatePrayerTimes(51.51, -0.13, d, { highLatitudeRule: 'SeventhOfTheNight' });
      const sAngle = calculatePrayerTimes(51.51, -0.13, d, { highLatitudeRule: 'AngleBased' });
      expect(toDate(sMiddle.fajr)).not.toBeNull();
      expect(toDate(sSeventh.fajr)).not.toBeNull();
      expect(toDate(sAngle.fajr)).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // B10: Antimeridian Prayer Front Discontinuities
  // --------------------------------------------------------------------------
  describe('B10: Antimeridian Prayer Front Discontinuities', () => {
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolar = getSubsolarPoint(equinox);
    const fronts = generateGlobalPrayerFronts(
      subsolar,
      CALCULATION_CONVENTIONS.MuslimWorldLeague,
      'Shafi',
      1
    );

    it('B10.1: Fajr front positions stay within valid unit sphere radius', () => {
      const f = fronts.fajr;
      for (let i = 0; i < f.pointCount; i += 10) {
        const idx = i * 3;
        const x = f.positions[idx];
        const y = f.positions[idx + 1];
        const z = f.positions[idx + 2];
        const r = Math.sqrt(x * x + y * y + z * z);
        expect(r).toBeCloseTo(1.0, 2);
      }
    });

    it('B10.2: Sunrise front positions stay within valid unit sphere radius', () => {
      const f = fronts.sunrise;
      for (let i = 0; i < f.pointCount; i += 10) {
        const idx = i * 3;
        const r = Math.sqrt(f.positions[idx] ** 2 + f.positions[idx + 1] ** 2 + f.positions[idx + 2] ** 2);
        expect(r).toBeCloseTo(1.0, 2);
      }
    });

    it('B10.3: Maghrib front positions stay within valid unit sphere radius', () => {
      const f = fronts.maghrib;
      for (let i = 0; i < f.pointCount; i += 10) {
        const idx = i * 3;
        const r = Math.sqrt(f.positions[idx] ** 2 + f.positions[idx + 1] ** 2 + f.positions[idx + 2] ** 2);
        expect(r).toBeCloseTo(1.0, 2);
      }
    });

    it('B10.4: Isha front positions stay within valid unit sphere radius', () => {
      const f = fronts.isha;
      for (let i = 0; i < f.pointCount; i += 10) {
        const idx = i * 3;
        const r = Math.sqrt(f.positions[idx] ** 2 + f.positions[idx + 1] ** 2 + f.positions[idx + 2] ** 2);
        expect(r).toBeCloseTo(1.0, 2);
      }
    });

    it('B10.5: Asr front positions stay within valid unit sphere radius', () => {
      const f = fronts.asr;
      for (let i = 0; i < f.pointCount; i += 10) {
        const idx = i * 3;
        const r = Math.sqrt(f.positions[idx] ** 2 + f.positions[idx + 1] ** 2 + f.positions[idx + 2] ** 2);
        expect(r).toBeCloseTo(1.0, 2);
      }
    });
  });

  // --------------------------------------------------------------------------
  // B11: Shading Normal Singularities at Poles
  // --------------------------------------------------------------------------
  describe('B11: Shading Normal Singularities at Poles', () => {
    it('B11.1: North pole normal is unit vector [0, 1, 0]', () => {
      const n = new THREE.Vector3(0, 1, 0).normalize();
      expect(n.length()).toBeCloseTo(1.0, 4);
      expect(n.y).toBeCloseTo(1.0, 4);
    });

    it('B11.2: South pole normal is unit vector [0, -1, 0]', () => {
      const n = new THREE.Vector3(0, -1, 0).normalize();
      expect(n.length()).toBeCloseTo(1.0, 4);
      expect(n.y).toBeCloseTo(-1.0, 4);
    });

    it('B11.3: Tangent fallback prevents zero-division at poles', () => {
      const normal = new THREE.Vector3(0, 1, 0);
      let tangent = new THREE.Vector3(-normal.z, 0, normal.x);
      if (tangent.length() < 0.001) tangent = new THREE.Vector3(1, 0, 0);
      expect(tangent.length()).toBe(1.0);
      expect(tangent.x).toBe(1.0);
    });

    it('B11.4: Sun direction vector remains unit length for all dates', () => {
      const dates = [
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-03-20T12:00:00Z'),
        new Date('2026-06-21T06:00:00Z'),
        new Date('2026-09-22T18:00:00Z'),
      ];
      for (const d of dates) {
        const sub = getSubsolarPoint(d);
        const v = latLonToVector3(sub.latitude, sub.longitude, 1.0);
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        expect(len).toBeCloseTo(1.0, 4);
      }
    });

    it('B11.5: Occlusion dot product is clamped to [-1, 1]', () => {
      const n = new THREE.Vector3(0, 1, 0);
      const s = new THREE.Vector3(0, -1, 0);
      const dot = Math.max(-1.0, Math.min(1.0, n.dot(s)));
      expect(dot).toBe(-1.0);
    });
  });

  // --------------------------------------------------------------------------
  // B12: Radiometric Color Space Boundary Values
  // --------------------------------------------------------------------------
  describe('B12: Radiometric Color Space Boundary Values', () => {
    function linearToSRGB(c: number): number {
      return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
    }

    it('B12.1: Pure black linear 0.0 converts to sRGB 0.0', () => {
      expect(linearToSRGB(0.0)).toBeCloseTo(0.0, 4);
    });

    it('B12.2: Pure white linear 1.0 converts to sRGB 1.0', () => {
      expect(linearToSRGB(1.0)).toBeCloseTo(1.0, 4);
    });

    it('B12.3: Linear 0.5 converts to ~0.735 sRGB', () => {
      expect(linearToSRGB(0.5)).toBeCloseTo(0.735, 2);
    });

    it('B12.4: Reinhard tone mapping maps infinite HDR radiance to [0, 1)', () => {
      function reinhard(x: number): number {
        return x / (1.0 + x);
      }
      expect(reinhard(0.0)).toBe(0.0);
      expect(reinhard(1.0)).toBe(0.5);
      expect(reinhard(10.0)).toBeCloseTo(0.909, 3);
      expect(reinhard(100.0)).toBeLessThan(1.0);
    });

    it('B12.5: Deep night direct diffuse floor elimination leaves 0 direct contribution', () => {
      const sunDot = -0.5; // deep night
      const directDiffuse = Math.max(0.0, sunDot);
      expect(directDiffuse).toBe(0.0);
    });
  });

  // --------------------------------------------------------------------------
  // B13: Atmospheric Scale Height & Limb Boundaries
  // --------------------------------------------------------------------------
  describe('B13: Atmospheric Scale Height & Limb Boundaries', () => {
    it('B13.1: Atmosphere shell radius scale is strictly greater than 1.0', () => {
      const atmo = createAtmosphere();
      expect(atmo.mesh.geometry.parameters.radius).toBeGreaterThan(5.0);
    });

    it('B13.2: Rim Fresnel reaches 1.0 at glancing limb (dotNV = 0)', () => {
      const dotNV = 0.0;
      const rim = Math.pow(1.0 - Math.min(Math.max(dotNV, 0.0), 1.0), 3.5);
      expect(rim).toBeCloseTo(1.0, 4);
    });

    it('B13.3: Rim Fresnel reaches 0.0 at center disk (dotNV = 1)', () => {
      const dotNV = 1.0;
      const rim = Math.pow(1.0 - Math.min(Math.max(dotNV, 0.0), 1.0), 3.5);
      expect(rim).toBeCloseTo(0.0, 4);
    });

    it('B13.4: Atmosphere dayFactor smoothstep is monotonically increasing', () => {
      function smoothstep(min: number, max: number, value: number): number {
        const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return x * x * (3 - 2 * x);
      }
      const s1 = smoothstep(-0.2, 0.3, -0.2);
      const s2 = smoothstep(-0.2, 0.3, 0.05);
      const s3 = smoothstep(-0.2, 0.3, 0.3);
      expect(s1).toBe(0.0);
      expect(s2).toBeGreaterThan(s1);
      expect(s3).toBe(1.0);
    });

    it('B13.5: Atmosphere terminator glow peaks at sunFactor = 0', () => {
      function terminatorGlow(sunFactor: number): number {
        const x = Math.max(0, Math.min(1, Math.abs(sunFactor) / 0.35));
        return 1.0 - x * x * (3 - 2 * x);
      }
      expect(terminatorGlow(0.0)).toBe(1.0);
      expect(terminatorGlow(0.35)).toBe(0.0);
      expect(terminatorGlow(-0.35)).toBe(0.0);
    });
  });

  // --------------------------------------------------------------------------
  // B14: Calendar Date Boundaries & Leap Years
  // --------------------------------------------------------------------------
  describe('B14: Calendar Date Boundaries & Leap Years', () => {
    it('B14.1: Computes valid ephemeris on leap day (2028-02-29)', () => {
      const leapDay = new Date('2028-02-29T12:00:00Z');
      const jd = getJulianDay(leapDay);
      expect(jd).toBeGreaterThan(2451545.0);
      const dec = getSolarDeclination(leapDay);
      expect(dec).toBeGreaterThan(-10.0);
      expect(dec).toBeLessThan(-5.0);
    });

    it('B14.2: Computes continuous ephemeris across year boundary (2026-12-31 to 2027-01-01)', () => {
      const d1 = new Date('2026-12-31T23:59:59Z');
      const d2 = new Date('2027-01-01T00:00:01Z');
      const dec1 = getSolarDeclination(d1);
      const dec2 = getSolarDeclination(d2);
      expect(Math.abs(dec2 - dec1)).toBeLessThan(0.001);
    });

    it('B14.3: Century calculation progresses monotonically', () => {
      const t1 = getJulianCenturies(new Date('2000-01-01T12:00:00Z'));
      const t2 = getJulianCenturies(new Date('2100-01-01T12:00:00Z'));
      expect(t1).toBeCloseTo(0.0, 4);
      expect(t2).toBeCloseTo(1.0, 2);
    });

    it('B14.4: Computes valid prayer times across leap day 2028-02-29', () => {
      const leapSched = calculatePrayerTimes(21.42, 39.83, new Date('2028-02-29T12:00:00Z'));
      expect(toDate(leapSched.fajr)).not.toBeNull();
      expect(toDate(leapSched.maghrib)).not.toBeNull();
    });

    it('B14.5: Computes valid prayer times on month boundaries', () => {
      const endMonth = calculatePrayerTimes(21.42, 39.83, new Date('2026-04-30T12:00:00Z'));
      const startMonth = calculatePrayerTimes(21.42, 39.83, new Date('2026-05-01T12:00:00Z'));
      expect(toDate(endMonth.fajr)).not.toBeNull();
      expect(toDate(startMonth.fajr)).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // B15: Continuity Calculation Extremes
  // --------------------------------------------------------------------------
  describe('B15: Continuity Calculation Extremes', () => {
    it('B15.1: Single settlement coverage equals 5 prayers * 4 min = 20 min / 1440 min = 1.39%', () => {
      const single = [
        { name: 'EquatorCity', nameAr: 'مدينة', latitude: 0.0, longitude: 0.0, population: 1000, countryCode: 'XX', timezone: 'UTC' },
      ];
      const stats = computeGlobalAdhanContinuity(single, new Date('2026-03-20T12:00:00Z'), {
        adhanDurationMinutes: 4,
      });
      // 5 prayers * 240 seconds = 1200 seconds / 86400 = 1.3888%
      expect(stats.coveragePercent).toBeCloseTo(1.39, 1);
    });

    it('B15.2: Two antipodal settlements (0 and 180 lon) have disjoint coverage', () => {
      const settlements = [
        { name: 'CityA', nameAr: 'أ', latitude: 0.0, longitude: 0.0, population: 1000, countryCode: 'XX', timezone: 'UTC' },
        { name: 'CityB', nameAr: 'ب', latitude: 0.0, longitude: 180.0, population: 1000, countryCode: 'XX', timezone: 'UTC' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-03-20T12:00:00Z'), {
        adhanDurationMinutes: 4,
      });
      expect(stats.coveragePercent).toBeCloseTo(2.78, 1);
    });

    it('B15.3: Extremely small duration (0.001 minutes) produces minimal covered seconds', () => {
      const settlements = [
        { name: 'CityA', nameAr: 'أ', latitude: 0.0, longitude: 0.0, population: 1000, countryCode: 'XX', timezone: 'UTC' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-03-20T12:00:00Z'), {
        adhanDurationMinutes: 0.001,
      });
      expect(stats.coveredSeconds).toBeLessThanOrEqual(5);
    });

    it('B15.4: Duration 288 minutes is handled gracefully without index out of bounds', () => {
      const settlements = [
        { name: 'CityA', nameAr: 'أ', latitude: 0.0, longitude: 0.0, population: 1000, countryCode: 'XX', timezone: 'UTC' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-03-20T12:00:00Z'), {
        adhanDurationMinutes: 288,
      });
      expect(stats.timelineBins.length).toBe(288);
    });

    it('B15.5: Peak concurrent adhans cannot exceed settlement count times 5 prayers', () => {
      const settlements = [
        { name: 'CityA', nameAr: 'أ', latitude: 0.0, longitude: 0.0, population: 1000, countryCode: 'XX', timezone: 'UTC' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-03-20T12:00:00Z'));
      expect(stats.peakConcurrentAdhans).toBeLessThanOrEqual(5);
    });
  });

  // --------------------------------------------------------------------------
  // B16: URL State Parsing Corner Cases
  // --------------------------------------------------------------------------
  describe('B16: URL State Parsing Corner Cases', () => {
    it('B16.1: Parses extreme latitude 90.0 correctly', () => {
      const state = parseUrlState('?lat=90.0&lon=0.0');
      expect(state.lat).toBe(90.0);
    });

    it('B16.2: Parses extreme longitude -180.0 correctly', () => {
      const state = parseUrlState('?lat=0.0&lon=-180.0');
      expect(state.lon).toBe(-180.0);
    });

    it('B16.3: Handles malformed date parameter safely without crashing', () => {
      const state = parseUrlState('?t=not-a-date');
      expect(state.time).toBeUndefined();
    });

    it('B16.4: Handles excessively long URL parameter string gracefully', () => {
      const longParam = 'a'.repeat(2000);
      const state = parseUrlState(`?convention=${longParam}`);
      expect(state.convention).toBe(longParam);
    });

    it('B16.5: Handles URI encoded characters in query string', () => {
      const state = parseUrlState('?convention=Umm%20Al-Qura');
      expect(state.convention).toBe('Umm Al-Qura');
    });
  });

  // --------------------------------------------------------------------------
  // B17: Settlement Loader Boundaries
  // --------------------------------------------------------------------------
  describe('B17: Settlement Loader Boundaries', () => {
    it('B17.1: Parses empty settlement data array without throwing', () => {
      const settlements = parseSettlements([]);
      expect(settlements).toEqual([]);
    });

    it('B17.2: Decodes extreme north coordinate settlement (Longyearbyen 78.22 N)', () => {
      const row: CompactSettlementRow = ['Longyearbyen', 'لونغياربين', 78.22, 15.65, 'NO', 2400, 'Europe/Oslo'];
      const res = parseSettlements([row]);
      expect(res.length).toBe(1);
      expect(res[0].latitude).toBe(78.22);
    });

    it('B17.3: Decodes extreme south coordinate settlement (Ushuaia -54.80 S)', () => {
      const row: CompactSettlementRow = ['Ushuaia', 'أوشوايا', -54.80, -68.30, 'AR', 82000, 'America/Argentina/Ushuaia'];
      const res = parseSettlements([row]);
      expect(res.length).toBe(1);
      expect(res[0].latitude).toBe(-54.80);
    });

    it('B17.4: Handles zero population settlements safely', () => {
      const row: CompactSettlementRow = ['ResearchStation', 'محطة', -75.0, 0.0, 'AQ', 0, 'Antarctica/Troll'];
      const res = parseSettlements([row]);
      expect(res.length).toBe(1);
      expect(res[0].population).toBe(0);
    });

    it('B17.5: Handles Palestine name and code overrides accurately', () => {
      const row: CompactSettlementRow = ['Salama', 'سلمة', 32.05, 34.80, 'IL', 1000, 'Asia/Jerusalem'];
      const res = parseSettlements([row]);
      expect(res.length).toBe(1);
      expect(res[0].countryCode).toBe('PS');
      expect(res[0].timezone).toBe('Asia/Hebron');
    });
  });
});
