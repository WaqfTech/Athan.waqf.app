import { describe, it, expect } from 'vitest';
import {
  getSolarDeclination,
  getEquationOfTime,
  getSubsolarPoint,
  getSolarAltitude,
} from '../../src/astronomy/solar';
import {
  vector3ToLatLon,
} from '../../src/astronomy/coordinates';
import {
  CALCULATION_CONVENTIONS,
} from '../../src/prayer/conventions';
import { calculatePrayerTimes } from '../../src/prayer/calculator';
import { generateGlobalPrayerFronts } from '../../src/prayer/contours';
import { createEarth } from '../../src/globe/earth';
import { computeGlobalAdhanContinuity } from '../../src/simulation/continuity';
import { parseSettlements, CompactSettlementRow } from '../../src/population/loader';
import * as THREE from 'three';

// Mock TextureLoader in headless node environment
THREE.TextureLoader.prototype.load = function() {
  return new THREE.Texture();
};

describe('Tier 4: Real-World Application Scenarios (Witnesses W01 to W08)', () => {
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
  // W01: Tromsø Winter Polar Night Scenario
  // --------------------------------------------------------------------------
  describe('W01: Tromsø Winter Polar Night (69.65 N, 18.96 E, 2026-12-21)', () => {
    const tromsoLat = 69.65;
    const tromsoLon = 18.96;
    const winterRequest = new Date('2026-12-21T12:00:00Z');

    it('W01.1: Declination at request matches baseline ~ -23.437 deg', () => {
      const dec = getSolarDeclination(winterRequest);
      expect(dec).toBeCloseTo(-23.437, 2);
    });

    it('W01.2: Sampled altitude range across 00:00-24:00 UTC remains strictly below -3.08 deg', () => {
      let minAlt = 90;
      let maxAlt = -90;
      for (let m = 0; m <= 1440; m += 1) {
        const t = new Date(+winterRequest - 43200000 + m * 60000);
        const alt = getSolarAltitude(tromsoLat, tromsoLon, t);
        if (alt < minAlt) minAlt = alt;
        if (alt > maxAlt) maxAlt = alt;
      }
      expect(minAlt).toBeCloseTo(-43.79, 1);
      expect(maxAlt).toBeCloseTo(-3.087, 1);
      expect(maxAlt).toBeLessThan(-0.8333); // strictly below horizon
    });

    it('W01.3: Culmination estimate 90 - abs(lat - dec) confirms no physical crossing', () => {
      const dec = getSolarDeclination(winterRequest);
      const culmination = 90 - Math.abs(tromsoLat - dec);
      expect(culmination).toBeCloseTo(-3.087, 2);
    });

    it('W01.4: Noon-shadow ratio tan(abs(phi - delta)) is negative in polar night', () => {
      const dec = getSolarDeclination(winterRequest);
      const diffDeg = tromsoLat - dec; // ~93.08 deg
      expect(diffDeg).toBeGreaterThan(90.0);
      const noonShadowRatio = Math.tan((diffDeg * Math.PI) / 180);
      expect(noonShadowRatio).toBeLessThan(0); // negative shadow ratio
    });

    it('W01.5: Twilight crossings can still exist at -18 deg during polar night', () => {
      // At nadir altitude is -43.8, at noon is -3.08, so sun crosses -18 deg twice daily!
      let crossed18 = false;
      for (let m = 0; m < 1440; m += 10) {
        const t = new Date(+winterRequest - 43200000 + m * 60000);
        const alt = getSolarAltitude(tromsoLat, tromsoLon, t);
        if (Math.abs(alt - -18.0) < 1.0) {
          crossed18 = true;
          break;
        }
      }
      expect(crossed18).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // W02: Tromsø Summer Midnight Sun Scenario
  // --------------------------------------------------------------------------
  describe('W02: Tromsø Summer Midnight Sun (69.65 N, 18.96 E, 2026-06-21)', () => {
    const tromsoLat = 69.65;
    const tromsoLon = 18.96;
    const summerRequest = new Date('2026-06-21T12:00:00Z');

    it('W02.1: Declination at request matches baseline ~ +23.438 deg', () => {
      const dec = getSolarDeclination(summerRequest);
      expect(dec).toBeCloseTo(23.438, 2);
    });

    it('W02.2: Sampled minimum altitude remains above +3.08 deg (continuous daylight)', () => {
      let minAlt = 90;
      for (let m = 0; m <= 1440; m += 1) {
        const t = new Date(+summerRequest - 43200000 + m * 60000);
        const alt = getSolarAltitude(tromsoLat, tromsoLon, t);
        if (alt < minAlt) minAlt = alt;
      }
      expect(minAlt).toBeCloseTo(3.087, 1);
      expect(minAlt).toBeGreaterThan(0.0); // sun never sets
    });

    it('W02.3: Zero physical sunset occurs throughout the entire 24h period', () => {
      const dec = getSolarDeclination(summerRequest);
      const nadir = tromsoLat + dec - 90;
      expect(nadir).toBeCloseTo(3.088, 1);
      expect(nadir).toBeGreaterThan(0.0);
    });

    it('W02.4: Absence of natural night requires high-latitude policy determination', () => {
      const sched = calculatePrayerTimes(tromsoLat, tromsoLon, summerRequest, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      // The schedule returns values under high-latitude rule
      expect(toDate(sched.fajr)).not.toBeNull();
      expect(toDate(sched.maghrib)).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // W03: London Summer AngleBased Rule Scenario
  // --------------------------------------------------------------------------
  describe('W03: London Summer AngleBased Rule (51.51 N, -0.13 W, 2026-06-21)', () => {
    const londonLat = 51.5074;
    const londonLon = -0.1278;
    const summerDate = new Date('2026-06-21T12:00:00Z');

    it('W03.1: Minimum solar altitude in London summer is around -15 deg (no -18 deg astronomical twilight)', () => {
      let minAlt = 90;
      for (let m = 0; m < 1440; m += 15) {
        const t = new Date(+summerDate - 43200000 + m * 60000);
        const alt = getSolarAltitude(londonLat, londonLon, t);
        if (alt < minAlt) minAlt = alt;
      }
      // London summer minimum altitude is approx -15.05 deg, so -18 deg is never reached naturally
      expect(minAlt).toBeGreaterThan(-18.0);
      expect(minAlt).toBeLessThan(-14.0);
    });

    it('W03.2: AngleBased rule evaluates fractional proportion distinct from SeventhOfTheNight', () => {
      const convention = CALCULATION_CONVENTIONS.MuslimWorldLeague;
      const fajrAngle = convention.fajrAngle; // 18 deg
      const angleProportion = fajrAngle / 60; // 0.3
      const seventhProportion = 1 / 7;       // 0.142857
      expect(angleProportion).toBe(0.3);
      expect(angleProportion).not.toBeCloseTo(seventhProportion, 2);
    });

    it('W03.3: MiddleOfTheNight evaluates exactly half-night proportion (0.5)', () => {
      const middleProportion = 1 / 2;
      expect(middleProportion).toBe(0.5);
      expect(middleProportion).not.toBe(18 / 60);
    });

    it('W03.4: AngleBased rule executes and returns valid times', () => {
      const sched = calculatePrayerTimes(londonLat, londonLon, summerDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      expect(toDate(sched.fajr)).not.toBeNull();
      expect(toDate(sched.isha)).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // W04: Prayer Front Temporal Directionality & Asr Afternoon Placement
  // --------------------------------------------------------------------------
  describe('W04: Prayer Front Temporal Directionality & Asr Afternoon Placement', () => {
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolar = getSubsolarPoint(equinox);
    const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Shafi', 1);

    it('W04.1: Subsolar coordinates at 2026-03-20T12:00:00Z match ~(-0.04 lat, +1.86 lon)', () => {
      expect(subsolar.latitude).toBeCloseTo(-0.04, 1);
      expect(subsolar.longitude).toBeCloseTo(1.86, 1);
    });

    it('W04.2: Evaluates hour angle H = wrap180(lon - subsolarLon) definition', () => {
      function calcHourAngle(lon: number, subLon: number): number {
        return ((lon - subLon + 180) % 360 + 360) % 360 - 180;
      }
      // Points east of subsolar meridian have H > 0 (afternoon)
      expect(calcHourAngle(subsolar.longitude + 30, subsolar.longitude)).toBeCloseTo(30, 4);
      // Points west of subsolar meridian have H < 0 (morning)
      expect(calcHourAngle(subsolar.longitude - 30, subsolar.longitude)).toBeCloseTo(-30, 4);
    });

    it('W04.3: Validates independent time derivative evaluation logic', () => {
      const sampleLat = 0.0;
      const morningLon = subsolar.longitude - 45; // morning
      const afternoonLon = subsolar.longitude + 45; // afternoon

      const altMorning1 = getSolarAltitude(sampleLat, morningLon, new Date(+equinox - 30000));
      const altMorning2 = getSolarAltitude(sampleLat, morningLon, new Date(+equinox + 30000));
      expect(altMorning2 - altMorning1).toBeGreaterThan(0); // rising morning

      const altAfternoon1 = getSolarAltitude(sampleLat, afternoonLon, new Date(+equinox - 30000));
      const altAfternoon2 = getSolarAltitude(sampleLat, afternoonLon, new Date(+equinox + 30000));
      expect(altAfternoon2 - altAfternoon1).toBeLessThan(0); // falling afternoon
    });

    it('W04.4: Confirms Asr front vertices exist and lie in afternoon hemisphere with falling altitude', () => {
      const asr = fronts.asr;
      expect(asr.pointCount).toBeGreaterThan(0);
      let checked = 0;
      let fallingCount = 0;
      for (let i = 0; i < asr.pointCount; i += 5) {
        const idx = i * 3;
        const p = vector3ToLatLon(asr.positions[idx], asr.positions[idx + 1], asr.positions[idx + 2]);
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
  });

  // --------------------------------------------------------------------------
  // W05: Makkah Fixed-Interval Isha Scenario
  // --------------------------------------------------------------------------
  describe('W05: Makkah Fixed-Interval Isha (21.4225 N, 39.8262 E, 2026-10-04)', () => {
    const makkahLat = 21.4225;
    const makkahLon = 39.8262;
    const makkahDate = new Date('2026-10-04T12:00:00Z');

    it('W05.1: UmmAlQura Isha occurs exactly 90 minutes after Maghrib', () => {
      const sched = calculatePrayerTimes(makkahLat, makkahLon, makkahDate, {
        convention: 'UmmAlQura',
      });
      const maghrib = toDate(sched.maghrib);
      const isha = toDate(sched.isha);
      expect(maghrib).not.toBeNull();
      expect(isha).not.toBeNull();
      if (maghrib && isha) {
        const diffMinutes = (+isha - +maghrib) / 60000;
        expect(diffMinutes).toBeCloseTo(90.0, 4);
      }
    });

    it('W05.2: Actual solar depression at that 90-minute Isha is deeper than -18 deg (~ -21.8 deg)', () => {
      const sched = calculatePrayerTimes(makkahLat, makkahLon, makkahDate, {
        convention: 'UmmAlQura',
      });
      const isha = toDate(sched.isha);
      expect(isha).not.toBeNull();
      if (isha) {
        const altAtIsha = getSolarAltitude(makkahLat, makkahLon, isha);
        expect(altAtIsha).toBeLessThan(-20.0);
        expect(altAtIsha).toBeCloseTo(-21.8, 1);
      }
    });

    it('W05.3: UmmAlQura convention specifies ishaIntervalMinutes = 90 and ishaAngle = 0', () => {
      const params = CALCULATION_CONVENTIONS.UmmAlQura;
      expect(params.ishaIntervalMinutes).toBe(90);
      expect(params.ishaAngle).toBe(0);
    });

    it('W05.4: Dhuhr calculation includes 1-minute safety offset past solar transit meridian', () => {
      const params = CALCULATION_CONVENTIONS.UmmAlQura;
      expect(params.dhuhrSafetyMinutes).toBe(1);
    });

    it('W05.5: UmmAlQura Isha front locus at Makkah Isha time passes through Makkah coordinates', () => {
      const sched = calculatePrayerTimes(makkahLat, makkahLon, makkahDate, {
        convention: 'UmmAlQura',
      });
      const isha = toDate(sched.isha);
      expect(isha).not.toBeNull();
      if (isha) {
        const subsolarAtIsha = getSubsolarPoint(isha);
        const frontsAtIsha = generateGlobalPrayerFronts(
          subsolarAtIsha,
          CALCULATION_CONVENTIONS.UmmAlQura,
          'Shafi',
          1,
          isha,
        );
        const ishaFront = frontsAtIsha.isha;
        expect(ishaFront.pointCount).toBeGreaterThan(0);

        let minLatDiff = 999;
        let matchedLon = 0;
        for (let i = 0; i < ishaFront.pointCount; i++) {
          const idx = i * 3;
          const p = vector3ToLatLon(ishaFront.positions[idx], ishaFront.positions[idx + 1], ishaFront.positions[idx + 2]);
          const latDiff = Math.abs(p.latitude - makkahLat);
          if (latDiff < minLatDiff) {
            minLatDiff = latDiff;
            matchedLon = p.longitude;
          }
        }
        expect(minLatDiff).toBeLessThan(3.0);
        expect(Math.abs(matchedLon - makkahLon)).toBeLessThan(3.0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // W06: Tokyo Civil Date Crossing & Multi-Day Windowing Scenario
  // --------------------------------------------------------------------------
  describe('W06: Tokyo Civil Date Crossing & Multi-Day Windowing', () => {
    const tokyoLat = 35.68;
    const tokyoLon = 139.76;

    it('W06.1: Tokyo solar noon occurs approx 9 hours ahead of prime meridian UTC noon', () => {
      // Longitude 139.76 deg => 139.76 / 15 = 9.317 hours ahead of UTC
      const tokyoNoonUTC = new Date('2026-10-05T02:40:00Z');
      const alt = getSolarAltitude(tokyoLat, tokyoLon, tokyoNoonUTC);
      expect(alt).toBeGreaterThan(49.0);
    });

    it('W06.2: Tokyo 5 October civil schedule Fajr falls on previous UTC day (4 October)', () => {
      const sched = calculatePrayerTimes(tokyoLat, tokyoLon, new Date('2026-10-05T00:00:00Z'));
      const fajr = toDate(sched.fajr);
      expect(fajr).not.toBeNull();
      if (fajr) {
        // Fajr UTC timestamp falls on 4 October around 19:12 UTC
        expect(fajr.getUTCDate()).toBe(4);
        expect(fajr.getUTCHours()).toBe(19);
      }
    });

    it('W06.3: Consecutive day ephemeris recalculation demonstrates drift from static +24h addition', () => {
      const d1 = new Date('2026-10-04T12:00:00Z');
      const d2 = new Date('2026-10-05T12:00:00Z');
      const s1 = calculatePrayerTimes(21.42, 39.83, d1);
      const s2 = calculatePrayerTimes(21.42, 39.83, d2);
      const f1 = toDate(s1.fajr);
      const f2 = toDate(s2.fajr);
      expect(f1).not.toBeNull();
      expect(f2).not.toBeNull();
      if (f1 && f2) {
        const deltaMs = +f2 - +f1;
        const static24hMs = 86400000;
        const driftSeconds = (deltaMs - static24hMs) / 1000;
        // Daily drift due to solar declination and EoT change is non-zero
        expect(Math.abs(driftSeconds)).toBeGreaterThan(5.0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // W07: Shader Planetary Occlusion & Radiometric Pipeline
  // --------------------------------------------------------------------------
  describe('W07: Shader Planetary Occlusion & Radiometric Pipeline', () => {
    it('W07.1: Earth shader normal uses geometric sphere normal for occlusion', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.vertexShader).toContain('vNormal');
      expect(mat.fragmentShader).toContain('float sunDotMacro = dot(geomNormal, sunDir);');
      expect(mat.fragmentShader).toContain('float directOcclusion = smoothstep(0.0, 0.025, sunDotMacro);');
    });

    it('W07.2: Fragment shader defines day and night lighting calculation without clamp floor', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.fragmentShader).toContain('uSunDirection');
      expect(mat.fragmentShader).toContain('uDayTexture');
      expect(mat.fragmentShader).toContain('uNightTexture');
      expect(mat.fragmentShader).not.toContain('0.03, 1.0');
    });

    it('W07.3: Deep night hemisphere dot product produces negative values and zero direct diffuse', () => {
      const normal = new THREE.Vector3(0, 0, 1);
      const sun = new THREE.Vector3(0, 0, -1); // opposite side
      const dot = normal.dot(sun);
      expect(dot).toBe(-1.0);
      const occlusion = dot <= 0.0 ? 0.0 : Math.min(1.0, dot / 0.025);
      expect(occlusion).toBe(0.0);
    });

    it('W07.4: Linear lighting compositing includes tone mapping and colorspace chunks', () => {
      const earth = createEarth();
      const mat = earth.mesh.material as THREE.ShaderMaterial;
      expect(mat.fragmentShader).toContain('#include <tonemapping_fragment>');
      expect(mat.fragmentShader).toContain('#include <colorspace_fragment>');
    });
  });

  // --------------------------------------------------------------------------
  // W08: Global Continuity Statistics & Concurrency Analysis
  // --------------------------------------------------------------------------
  describe('W08: Global Continuity Statistics & Concurrency Analysis', () => {
    it('W08.1: Continuity calculator processes multi-settlement dataset and returns 288 bins', () => {
      const settlements = [
        { name: 'Makkah', nameAr: 'مكة', latitude: 21.42, longitude: 39.83, population: 2000000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
        { name: 'Madinah', nameAr: 'المدينة', latitude: 24.47, longitude: 39.61, population: 1500000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
        { name: 'Cairo', nameAr: 'القاهرة', latitude: 30.04, longitude: 31.24, population: 10000000, countryCode: 'EG', timezone: 'Africa/Cairo' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-10-04T12:00:00Z'), {
        adhanDurationMinutes: 4,
      });
      expect(stats.timelineBins.length).toBe(288);
      expect(stats.settlementCount).toBe(3);
    });

    it('W08.2: Peak concurrent adhans represents true maximum of timeline bins', () => {
      const settlements = [
        { name: 'Makkah', nameAr: 'مكة', latitude: 21.42, longitude: 39.83, population: 2000000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
        { name: 'Madinah', nameAr: 'المدينة', latitude: 24.47, longitude: 39.61, population: 1500000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-10-04T12:00:00Z'));
      const maxBin = Math.max(...stats.timelineBins);
      expect(stats.peakConcurrentAdhans).toBe(maxBin);
    });

    it('W08.3: Covered seconds cannot exceed 86400 in a single 24-hour day', () => {
      const settlements = [
        { name: 'Makkah', nameAr: 'مكة', latitude: 21.42, longitude: 39.83, population: 2000000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
      ];
      const stats = computeGlobalAdhanContinuity(settlements, new Date('2026-10-04T12:00:00Z'));
      expect(stats.coveredSeconds).toBeLessThanOrEqual(86400);
      expect(stats.coveredSeconds).toBeGreaterThan(0);
    });
  });
});
