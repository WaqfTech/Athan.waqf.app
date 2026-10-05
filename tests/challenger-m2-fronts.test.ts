import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import {
  generateSolarAltitudeArc,
  generateSolarAltitudeRing,
  generateDhuhrFront,
  generateAsrFront,
  generateGlobalPrayerFronts,
  wrap180,
} from '../src/prayer/contours';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  CalculationParameters,
  Madhab,
} from '../src/prayer/conventions';
import {
  latLonToVector3,
  vector3ToLatLon,
  getLocalHourAngle,
} from '../src/astronomy/coordinates';
import {
  getSubsolarPoint,
  getSolarAltitude,
  SubsolarCoordinates,
} from '../src/astronomy/solar';
import {
  createPrayerFrontsLayer,
  AllFrontKey,
  PRAYER_COLORS,
} from '../src/globe/fronts';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const RADIUS = 5.02;

beforeAll(() => {
  // Polyfill minimal window for headless test environment if needed
  if (typeof window === 'undefined') {
    (globalThis as unknown as { window: unknown }).window = {
      innerWidth: 1920,
      innerHeight: 1080,
    };
  }
});

describe('Empirical Challenger: Milestone 2 Map Fronts & Terminator Geometry', () => {
  // Test dates representing diverse seasons and solar declinations:
  const testDates = [
    { name: 'Equinox (March 20, 2026 12:00 UTC)', date: new Date('2026-03-20T12:00:00Z') },
    { name: 'Equinox (March 20, 2026 00:00 UTC)', date: new Date('2026-03-20T00:00:00Z') },
    { name: 'Summer Solstice (June 21, 2026 12:00 UTC)', date: new Date('2026-06-21T12:00:00Z') },
    { name: 'Summer Solstice (June 21, 2026 00:00 UTC)', date: new Date('2026-06-21T00:00:00Z') },
    { name: 'Winter Solstice (December 21, 2026 12:00 UTC)', date: new Date('2026-12-21T12:00:00Z') },
    { name: 'Winter Solstice (December 21, 2026 00:00 UTC)', date: new Date('2026-12-21T00:00:00Z') },
  ];

  // =========================================================================
  // Challenge 1: Fajr Front Vertices - Rising Solar Altitude (dh/dt > 0) & H < 0
  // =========================================================================
  describe('Challenge 1: Fajr front vertices have rising solar altitudes (dh/dt > 0) and H < 0', () => {
    const testedConventions: CalculationConventionName[] = [
      'MuslimWorldLeague', // 18.0 deg
      'UmmAlQura',         // 18.5 deg
      'Egyptian',          // 19.5 deg
      'NorthAmerica',      // 15.0 deg
      'Singapore',         // 20.0 deg
    ];

    it('empirically verifies every Fajr vertex satisfies H < 0 and dh/dt > 0 across seasonal test dates', () => {
      let verifiedPointCount = 0;
      let strictlyRisingCount = 0;

      for (const { name: dateName, date } of testDates) {
        const subsolar = getSubsolarPoint(date);

        for (const convName of testedConventions) {
          const conv = CALCULATION_CONVENTIONS[convName];
          const fronts = generateGlobalPrayerFronts(subsolar, conv, 'Shafi', RADIUS, date);
          const fajr = fronts.fajr;

          expect(fajr.pointCount).toBeGreaterThan(10);

          for (let i = 0; i < fajr.pointCount; i++) {
            const x = fajr.positions[i * 3];
            const y = fajr.positions[i * 3 + 1];
            const z = fajr.positions[i * 3 + 2];

            // 1. Point must lie on the sphere
            const r = Math.hypot(x, y, z);
            expect(r).toBeCloseTo(RADIUS, 2);

            // 2. Geographic coordinates
            const geo = vector3ToLatLon(x, y, z);

            // 3. Hour angle H = wrap180(lon - subsolarLon)
            const H = wrap180(geo.longitude - subsolar.longitude);
            // Hour angle for morning/dawn is in [-180, 0] deg (West of subsolar meridian).
            // At the midnight meridian boundary (+180 deg = -180 deg), H wraps near +/- 180 deg.
            const isDawnHemisphere = H <= 0.001 || H >= 179.9;
            expect(isDawnHemisphere).toBe(true);

            // 4. Solar altitude at current time t
            const altT0 = getSolarAltitude(geo.latitude, geo.longitude, date);
            expect(altT0).toBeCloseTo(-conv.fajrAngle, 1);

            // 5. Numerical time derivative: altitude at t + 60 seconds
            const nextDate = new Date(date.getTime() + 60 * 1000);
            const altT1 = getSolarAltitude(geo.latitude, geo.longitude, nextDate);
            const dh = altT1 - altT0;

            // Diurnal altitude rate:
            // For all interior points (not exactly at the noon/midnight culmination points where sin(H) = 0),
            // dh/dt MUST be strictly positive (rising Sun).
            // At the exact culmination boundary vertices (where |H| < 0.1 deg or |H| > 179.9 deg),
            // diurnal derivative is zero and seasonal declination drift (|dh| < 0.001 deg/min) dominates.
            const isNearCulmination = Math.abs(H) < 0.1 || Math.abs(H) > 179.9;
            if (!isNearCulmination) {
              expect(dh).toBeGreaterThan(0);
              strictlyRisingCount++;
            } else {
              expect(Math.abs(dh)).toBeLessThan(0.001);
            }

            verifiedPointCount++;
          }
        }
      }

      // Assert statistically significant sample size evaluated and >95% are strictly rising
      expect(verifiedPointCount).toBeGreaterThan(1000);
      expect(strictlyRisingCount / verifiedPointCount).toBeGreaterThan(0.95);
    });

    it('empirically verifies Sunrise front vertices satisfy H < 0 and dh/dt > 0', () => {
      let verifiedPointCount = 0;
      let strictlyRisingCount = 0;

      for (const { date } of testDates) {
        const subsolar = getSubsolarPoint(date);
        const fronts = generateGlobalPrayerFronts(
          subsolar,
          CALCULATION_CONVENTIONS.MuslimWorldLeague,
          'Shafi',
          RADIUS,
          date,
        );
        const sunrise = fronts.sunrise;

        expect(sunrise.pointCount).toBeGreaterThan(10);

        for (let i = 0; i < sunrise.pointCount; i++) {
          const x = sunrise.positions[i * 3];
          const y = sunrise.positions[i * 3 + 1];
          const z = sunrise.positions[i * 3 + 2];

          const geo = vector3ToLatLon(x, y, z);
          const H = wrap180(geo.longitude - subsolar.longitude);
          const isDawnHemisphere = H <= 0.001 || H >= 179.9;
          expect(isDawnHemisphere).toBe(true);

          const altT0 = getSolarAltitude(geo.latitude, geo.longitude, date);
          expect(altT0).toBeCloseTo(-0.8333, 1);

          const nextDate = new Date(date.getTime() + 60 * 1000);
          const altT1 = getSolarAltitude(geo.latitude, geo.longitude, nextDate);
          const dh = altT1 - altT0;

          const isNearCulmination = Math.abs(H) < 0.1 || Math.abs(H) > 179.9;
          if (!isNearCulmination) {
            expect(dh).toBeGreaterThan(0);
            strictlyRisingCount++;
          } else {
            expect(Math.abs(dh)).toBeLessThan(0.001);
          }

          verifiedPointCount++;
        }
      }

      expect(verifiedPointCount).toBeGreaterThan(200);
      expect(strictlyRisingCount / verifiedPointCount).toBeGreaterThan(0.95);
    });
  });

  // =========================================================================
  // Challenge 2: Maghrib Front Vertices - Falling Solar Altitude (dh/dt < 0) & H > 0
  // =========================================================================
  describe('Challenge 2: Maghrib front vertices have falling solar altitudes (dh/dt < 0) and H > 0', () => {
    it('empirically verifies every Maghrib vertex satisfies H > 0 and dh/dt < 0 across seasonal test dates', () => {
      let verifiedPointCount = 0;
      let strictlyFallingCount = 0;

      for (const { date } of testDates) {
        const subsolar = getSubsolarPoint(date);
        const fronts = generateGlobalPrayerFronts(
          subsolar,
          CALCULATION_CONVENTIONS.MuslimWorldLeague,
          'Shafi',
          RADIUS,
          date,
        );
        const maghrib = fronts.maghrib;

        expect(maghrib.pointCount).toBeGreaterThan(10);

        for (let i = 0; i < maghrib.pointCount; i++) {
          const x = maghrib.positions[i * 3];
          const y = maghrib.positions[i * 3 + 1];
          const z = maghrib.positions[i * 3 + 2];

          const r = Math.hypot(x, y, z);
          expect(r).toBeCloseTo(RADIUS, 2);

          const geo = vector3ToLatLon(x, y, z);
          const H = wrap180(geo.longitude - subsolar.longitude);

          // Hour angle for evening/dusk is in [0, +180] deg.
          // Note that +180 deg and -180 deg are congruent on the antimeridian.
          // In branch cut wrap180, 180 + eps wraps to -180.
          // Therefore: either H in [-0.001, 180] or H <= -179.9 (at the midnight boundary)
          const isDuskHemisphere = H >= -0.001 || H <= -179.9;
          expect(isDuskHemisphere).toBe(true);

          const altT0 = getSolarAltitude(geo.latitude, geo.longitude, date);
          expect(altT0).toBeCloseTo(-0.8333, 1);

          const nextDate = new Date(date.getTime() + 60 * 1000);
          const altT1 = getSolarAltitude(geo.latitude, geo.longitude, nextDate);
          const dh = altT1 - altT0;

          // For all interior points, altitude must be strictly falling (dh < 0)
          const isNearCulmination = Math.abs(H) < 0.1 || Math.abs(H) > 179.9;
          if (!isNearCulmination) {
            expect(dh).toBeLessThan(0);
            strictlyFallingCount++;
          } else {
            expect(Math.abs(dh)).toBeLessThan(0.001);
          }

          verifiedPointCount++;
        }
      }

      expect(verifiedPointCount).toBeGreaterThan(300);
      expect(strictlyFallingCount / verifiedPointCount).toBeGreaterThan(0.95);
    });

    it('empirically verifies astronomical Isha (e.g. MWL 17 deg) vertices satisfy H in dusk arc and dh/dt < 0', () => {
      let verifiedPointCount = 0;
      let strictlyFallingCount = 0;

      for (const { date } of testDates) {
        const subsolar = getSubsolarPoint(date);
        const fronts = generateGlobalPrayerFronts(
          subsolar,
          CALCULATION_CONVENTIONS.MuslimWorldLeague,
          'Shafi',
          RADIUS,
          date,
        );
        const isha = fronts.isha;

        expect(isha.pointCount).toBeGreaterThan(10);

        for (let i = 0; i < isha.pointCount; i++) {
          const x = isha.positions[i * 3];
          const y = isha.positions[i * 3 + 1];
          const z = isha.positions[i * 3 + 2];

          const geo = vector3ToLatLon(x, y, z);
          const H = wrap180(geo.longitude - subsolar.longitude);
          const isDuskHemisphere = H >= -0.001 || H <= -179.9;
          expect(isDuskHemisphere).toBe(true);

          const altT0 = getSolarAltitude(geo.latitude, geo.longitude, date);
          expect(altT0).toBeCloseTo(-17.0, 1);

          const nextDate = new Date(date.getTime() + 60 * 1000);
          const altT1 = getSolarAltitude(geo.latitude, geo.longitude, nextDate);
          const dh = altT1 - altT0;

          const isNearCulmination = Math.abs(H) < 0.1 || Math.abs(H) > 179.9;
          if (!isNearCulmination) {
            expect(dh).toBeLessThan(0);
            strictlyFallingCount++;
          } else {
            expect(Math.abs(dh)).toBeLessThan(0.001);
          }

          verifiedPointCount++;
        }
      }

      expect(verifiedPointCount).toBeGreaterThan(300);
      expect(strictlyFallingCount / verifiedPointCount).toBeGreaterThan(0.95);
    });
  });

  // =========================================================================
  // Challenge 3: Asr Front Vertices - Afternoon Side (H > 0) & Falling Altitude
  // =========================================================================
  describe('Challenge 3: Asr front vertices have H > 0 and falling solar altitudes', () => {
    const madhabs: Madhab[] = ['Shafi', 'Hanafi'];

    it('empirically verifies every Asr vertex has H > 0 and dh/dt < 0 for both Shafi and Hanafi', () => {
      let verifiedPointCount = 0;

      for (const { date } of testDates) {
        const subsolar = getSubsolarPoint(date);

        for (const madhab of madhabs) {
          const fronts = generateGlobalPrayerFronts(
            subsolar,
            CALCULATION_CONVENTIONS.MuslimWorldLeague,
            madhab,
            RADIUS,
            date,
          );
          const asr = fronts.asr;

          expect(asr.pointCount).toBeGreaterThan(15);

          for (let i = 0; i < asr.pointCount; i++) {
            const x = asr.positions[i * 3];
            const y = asr.positions[i * 3 + 1];
            const z = asr.positions[i * 3 + 2];

            const geo = vector3ToLatLon(x, y, z);
            const H = wrap180(geo.longitude - subsolar.longitude);

            // In afternoon, Asr front is strictly East of subsolar meridian: H > 0
            expect(H).toBeGreaterThan(0);

            // Verify solar altitude matches Asr shadow definition
            const zenithDeg = Math.abs(geo.latitude - subsolar.latitude);
            expect(zenithDeg).toBeLessThan(90); // Positive noon shadow check

            const noonShadow = Math.tan(zenithDeg * DEG2RAD);
            const shadowFactor = madhab === 'Hanafi' ? 2 : 1;
            const expectedAsrAlt = Math.atan(1 / (noonShadow + shadowFactor)) * RAD2DEG;

            const altT0 = getSolarAltitude(geo.latitude, geo.longitude, date);
            expect(altT0).toBeCloseTo(expectedAsrAlt, 1);

            // In afternoon, solar altitude must be strictly falling (dh/dt < 0)
            const nextDate = new Date(date.getTime() + 60 * 1000);
            const altT1 = getSolarAltitude(geo.latitude, geo.longitude, nextDate);
            const dh = altT1 - altT0;
            expect(dh).toBeLessThan(0);

            verifiedPointCount++;
          }
        }
      }

      expect(verifiedPointCount).toBeGreaterThan(400);
    });

    it('empirically verifies Hanafi Asr is consistently later in the afternoon than Shafi Asr', () => {
      for (const { date } of testDates) {
        const subsolar = getSubsolarPoint(date);
        const shafiAsr = generateAsrFront(subsolar, 'Shafi', RADIUS, 1);
        const hanafiAsr = generateAsrFront(subsolar, 'Hanafi', RADIUS, 1);

        expect(shafiAsr.pointCount).toBeGreaterThan(20);
        expect(hanafiAsr.pointCount).toBeGreaterThan(20);

        // Compare hour angles at common latitudes
        for (let i = 0; i < Math.min(shafiAsr.pointCount, hanafiAsr.pointCount); i++) {
          const shafiGeo = vector3ToLatLon(
            shafiAsr.positions[i * 3],
            shafiAsr.positions[i * 3 + 1],
            shafiAsr.positions[i * 3 + 2],
          );
          const hanafiGeo = vector3ToLatLon(
            hanafiAsr.positions[i * 3],
            hanafiAsr.positions[i * 3 + 1],
            hanafiAsr.positions[i * 3 + 2],
          );

          if (Math.abs(shafiGeo.latitude - hanafiGeo.latitude) < 0.1) {
            const shafiH = wrap180(shafiGeo.longitude - subsolar.longitude);
            const hanafiH = wrap180(hanafiGeo.longitude - subsolar.longitude);

            // Hanafi shadow = noon shadow + 2, which requires a lower Sun, hence larger hour angle H
            expect(hanafiH).toBeGreaterThan(shafiH);
          }
        }
      }
    });
  });

  // =========================================================================
  // Challenge 4: Polar Night Solstice Dates & Absence Handling
  // =========================================================================
  describe('Challenge 4: Polar night solstice dates and absence handling', () => {
    it('verifies Asr front skips latitudes where Sun does not rise on Northern winter solstice (Tromsø Dec 21)', () => {
      const decSolstice = new Date('2026-12-21T12:00:00Z');
      const subsolar = getSubsolarPoint(decSolstice);

      // Declination is approximately -23.44 deg
      expect(subsolar.latitude).toBeCloseTo(-23.44, 0.5);

      const asr = generateAsrFront(subsolar, 'Shafi', RADIUS, 1);

      // Arctic circle boundary: 90 - 23.44 = 66.56 deg N
      // Latitudes >= 66.56 N experience polar night (zenith >= 90 deg)
      for (let i = 0; i < asr.pointCount; i++) {
        const x = asr.positions[i * 3];
        const y = asr.positions[i * 3 + 1];
        const z = asr.positions[i * 3 + 2];

        // Ensure zero NaNs or Infinities
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);

        const geo = vector3ToLatLon(x, y, z);

        // Must strictly be below the polar night threshold
        expect(geo.latitude).toBeLessThan(66.56);

        // Specifically check that Tromso (69.65 N), Longyearbyen (78.22 N), Hammerfest (70.66 N) are excluded
        expect(geo.latitude).not.toBeCloseTo(69.65, 0.1);
        expect(geo.latitude).not.toBeCloseTo(78.22, 0.1);
        expect(geo.latitude).not.toBeCloseTo(70.66, 0.1);
      }
    });

    it('verifies Asr front skips Southern polar night on Summer solstice (Antarctica June 21)', () => {
      const junSolstice = new Date('2026-06-21T12:00:00Z');
      const subsolar = getSubsolarPoint(junSolstice);

      expect(subsolar.latitude).toBeCloseTo(23.44, 0.5);

      const asr = generateAsrFront(subsolar, 'Shafi', RADIUS, 1);

      // Latitudes <= -66.56 S experience polar night in June
      for (let i = 0; i < asr.pointCount; i++) {
        const x = asr.positions[i * 3];
        const y = asr.positions[i * 3 + 1];
        const z = asr.positions[i * 3 + 2];

        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);

        const geo = vector3ToLatLon(x, y, z);
        expect(geo.latitude).toBeGreaterThan(-66.56);
      }
    });

    it('handles extreme polar inputs without throwing or producing NaN across all fronts', () => {
      // Subsolar coordinates at extreme boundaries
      const extremeSubsolars: SubsolarCoordinates[] = [
        { latitude: -23.44, longitude: 0 },
        { latitude: 23.44, longitude: 180 },
        { latitude: 0, longitude: -180 },
        { latitude: -23.44, longitude: -179.99 },
        { latitude: 23.44, longitude: 179.99 },
      ];

      for (const sub of extremeSubsolars) {
        expect(() => {
          const fronts = generateGlobalPrayerFronts(
            sub,
            CALCULATION_CONVENTIONS.MuslimWorldLeague,
            'Shafi',
            RADIUS,
          );

          for (const key of Object.keys(fronts) as (keyof typeof fronts)[]) {
            const contour = fronts[key];
            expect(contour.pointCount).toBeGreaterThanOrEqual(0);
            for (let i = 0; i < contour.pointCount * 3; i++) {
              expect(Number.isFinite(contour.positions[i])).toBe(true);
            }
          }
        }).not.toThrow();
      }
    });
  });

  // =========================================================================
  // Challenge 5: Fixed-Interval Isha Front (Umm al-Qura & Qatar)
  // =========================================================================
  describe('Challenge 5: Fixed-interval Isha front under Umm al-Qura and Qatar conventions', () => {
    it('verifies Umm al-Qura Isha front matches the sunset locus at t - 90 minutes when date is provided', () => {
      const testDate = new Date('2026-10-04T12:00:00Z');
      const subsolarNow = getSubsolarPoint(testDate);

      const frontsNow = generateGlobalPrayerFronts(
        subsolarNow,
        CALCULATION_CONVENTIONS.UmmAlQura,
        'Shafi',
        RADIUS,
        testDate,
      );

      // Historical sunset date 90 minutes earlier
      const prevDate = new Date(testDate.getTime() - 90 * 60000);
      const subsolarPrev = getSubsolarPoint(prevDate);
      const frontsPrev = generateGlobalPrayerFronts(
        subsolarPrev,
        CALCULATION_CONVENTIONS.UmmAlQura,
        'Shafi',
        RADIUS,
        prevDate,
      );

      // 1. Point counts must match
      expect(frontsNow.isha.pointCount).toBe(frontsPrev.maghrib.pointCount);

      // 2. Vertex coordinates must be identical
      for (let i = 0; i < frontsNow.isha.pointCount * 3; i++) {
        expect(frontsNow.isha.positions[i]).toBeCloseTo(frontsPrev.maghrib.positions[i], 4);
      }
    });

    it('verifies Qatar Isha front matches the sunset locus at t - 90 minutes', () => {
      const testDate = new Date('2026-06-21T18:00:00Z');
      const subsolarNow = getSubsolarPoint(testDate);

      const frontsNow = generateGlobalPrayerFronts(
        subsolarNow,
        CALCULATION_CONVENTIONS.Qatar,
        'Shafi',
        RADIUS,
        testDate,
      );

      const prevDate = new Date(testDate.getTime() - 90 * 60000);
      const subsolarPrev = getSubsolarPoint(prevDate);
      const frontsPrev = generateGlobalPrayerFronts(
        subsolarPrev,
        CALCULATION_CONVENTIONS.Qatar,
        'Shafi',
        RADIUS,
        prevDate,
      );

      expect(frontsNow.isha.pointCount).toBe(frontsPrev.maghrib.pointCount);
      for (let i = 0; i < frontsNow.isha.pointCount * 3; i++) {
        expect(frontsNow.isha.positions[i]).toBeCloseTo(frontsPrev.maghrib.positions[i], 4);
      }
    });

    it('verifies fixed-interval Isha without date applies 0.25 deg/min westward rotation (22.5 deg eastward offset)', () => {
      const staticSubsolar: SubsolarCoordinates = { latitude: 15, longitude: 45 };
      const fronts = generateGlobalPrayerFronts(
        staticSubsolar,
        CALCULATION_CONVENTIONS.UmmAlQura,
        'Shafi',
        RADIUS,
      );

      expect(fronts.isha.pointCount).toBeGreaterThan(10);
      expect(fronts.maghrib.pointCount).toBeGreaterThan(10);

      // Mid-point longitude difference between Maghrib and Isha contours
      const mMid = Math.floor(fronts.maghrib.pointCount / 2) * 3;
      const mLon = (Math.atan2(fronts.maghrib.positions[mMid], fronts.maghrib.positions[mMid + 2]) * 180) / Math.PI;

      const iMid = Math.floor(fronts.isha.pointCount / 2) * 3;
      const iLon = (Math.atan2(fronts.isha.positions[iMid], fronts.isha.positions[iMid + 2]) * 180) / Math.PI;

      // In 90 minutes at 0.25 deg/min, the dusk locus shifted eastward by exactly 22.5 degrees
      const lonDiff = wrap180(iLon - mLon);
      expect(lonDiff).toBeCloseTo(22.5, 0.5);
    });

    it('verifies custom Ramadan interval (120 minutes) shifts contour by 30 degrees', () => {
      const ramadanConvention: CalculationParameters = {
        name: 'UmmAlQura',
        fajrAngle: 18.5,
        ishaAngle: 0,
        ishaIntervalMinutes: 120,
      };

      const staticSubsolar: SubsolarCoordinates = { latitude: 15, longitude: 45 };
      const fronts = generateGlobalPrayerFronts(staticSubsolar, ramadanConvention, 'Shafi', RADIUS);

      const mMid = Math.floor(fronts.maghrib.pointCount / 2) * 3;
      const mLon = (Math.atan2(fronts.maghrib.positions[mMid], fronts.maghrib.positions[mMid + 2]) * 180) / Math.PI;

      const iMid = Math.floor(fronts.isha.pointCount / 2) * 3;
      const iLon = (Math.atan2(fronts.isha.positions[iMid], fronts.isha.positions[iMid + 2]) * 180) / Math.PI;

      const lonDiff = wrap180(iLon - mLon);
      // 120 minutes * 0.25 deg/min = 30.0 degrees
      expect(lonDiff).toBeCloseTo(30.0, 0.5);
    });
  });

  // =========================================================================
  // Challenge 6: Antimeridian Crossings (-180 / +180 deg) & Curve Continuity
  // =========================================================================
  describe('Challenge 6: Antimeridian crossings (-180 / +180 deg) and curve continuity', () => {
    const subsolarsCrossingAntimeridian: SubsolarCoordinates[] = [
      { latitude: 0, longitude: 175 },
      { latitude: 15, longitude: -175 },
      { latitude: -20, longitude: 180 },
      { latitude: 23, longitude: -160 },
      { latitude: -10, longitude: 160 },
    ];

    it('ensures all fronts have small consecutive chord distances across antimeridian without false bridging', () => {
      // Maximum allowed 3D step between consecutive points along contour (no chords across globe interior)
      // Radius = 5.02. A jump across the globe would be ~ 10.0. Normal step is ~ 0.25 - 0.5.
      const MAX_CHORD_DISTANCE = 1.0;

      for (const subsolar of subsolarsCrossingAntimeridian) {
        const fronts = generateGlobalPrayerFronts(
          subsolar,
          CALCULATION_CONVENTIONS.MuslimWorldLeague,
          'Shafi',
          RADIUS,
        );

        const frontKeys: (keyof typeof fronts)[] = [
          'fajr',
          'sunrise',
          'dhuhr',
          'asr',
          'maghrib',
          'isha',
          'terminator',
          'geometricTerminator',
          'apparentTerminator',
        ];

        for (const key of frontKeys) {
          const contour = fronts[key];
          expect(contour.pointCount).toBeGreaterThan(1);

          for (let i = 0; i < contour.pointCount - 1; i++) {
            const idx1 = i * 3;
            const idx2 = (i + 1) * 3;

            const dx = contour.positions[idx2] - contour.positions[idx1];
            const dy = contour.positions[idx2 + 1] - contour.positions[idx1 + 1];
            const dz = contour.positions[idx2 + 2] - contour.positions[idx1 + 2];

            const chordDist = Math.hypot(dx, dy, dz);

            // Invariant: Curve is continuous, no zig-zags through globe interior
            expect(chordDist).toBeLessThan(MAX_CHORD_DISTANCE);
          }
        }
      }
    });

    it('verifies Asr front cleanly traverses the antimeridian without disruption', () => {
      // Subsolar at longitude 150 deg: afternoon Asr (hour angle ~30-60 deg) will cross +180/-180 deg
      const subsolar: SubsolarCoordinates = { latitude: 10, longitude: 150 };
      const asr = generateAsrFront(subsolar, 'Shafi', RADIUS, 1);

      expect(asr.pointCount).toBeGreaterThan(30);

      let foundAntimeridianCrossing = false;
      for (let i = 0; i < asr.pointCount - 1; i++) {
        const p1 = vector3ToLatLon(
          asr.positions[i * 3],
          asr.positions[i * 3 + 1],
          asr.positions[i * 3 + 2],
        );
        const p2 = vector3ToLatLon(
          asr.positions[(i + 1) * 3],
          asr.positions[(i + 1) * 3 + 1],
          asr.positions[(i + 1) * 3 + 2],
        );

        // Check if segment crosses 180 / -180: sign flip with high magnitude
        if (p1.longitude > 170 && p2.longitude < -170) {
          foundAntimeridianCrossing = true;
          // In 3D space, distance must remain continuous (< 0.5 units)
          const dx = asr.positions[(i + 1) * 3] - asr.positions[i * 3];
          const dy = asr.positions[(i + 1) * 3 + 1] - asr.positions[i * 3 + 1];
          const dz = asr.positions[(i + 1) * 3 + 2] - asr.positions[i * 3 + 2];
          expect(Math.hypot(dx, dy, dz)).toBeLessThan(0.5);
        }
      }

      expect(foundAntimeridianCrossing).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 7: Geometric vs Apparent Terminator Disambiguation
  // =========================================================================
  describe('Challenge 7: Distinct Geometric and Apparent Terminators', () => {
    it('verifies geometric and apparent terminators are mathematically distinct circles', () => {
      const subsolar: SubsolarCoordinates = { latitude: 10, longitude: 30 };
      const fronts = generateGlobalPrayerFronts(
        subsolar,
        CALCULATION_CONVENTIONS.MuslimWorldLeague,
        'Shafi',
        RADIUS,
      );

      const geom = fronts.geometricTerminator;
      const app = fronts.apparentTerminator;

      expect(geom.pointCount).toBeGreaterThan(50);
      expect(app.pointCount).toBeGreaterThan(50);

      const [sx, sy, sz] = latLonToVector3(subsolar.latitude, subsolar.longitude, 1);

      // Geometric terminator: sun center at horizon => altitude = 0.0 deg => dot product = 0.0
      for (let i = 0; i < geom.pointCount; i += 5) {
        const x = geom.positions[i * 3];
        const y = geom.positions[i * 3 + 1];
        const z = geom.positions[i * 3 + 2];
        const dot = (x * sx + y * sy + z * sz) / RADIUS;
        expect(dot).toBeCloseTo(0.0, 2);
      }

      // Apparent terminator: sun upper limb with refraction => altitude = -0.8333 deg => dot product = sin(-0.8333)
      const expectedApparentDot = Math.sin(-0.8333 * DEG2RAD);
      for (let i = 0; i < app.pointCount; i += 5) {
        const x = app.positions[i * 3];
        const y = app.positions[i * 3 + 1];
        const z = app.positions[i * 3 + 2];
        const dot = (x * sx + y * sy + z * sz) / RADIUS;
        expect(dot).toBeCloseTo(expectedApparentDot, 2);
      }

      // Ensure they do not coincide
      const geomSample = geom.positions.slice(0, 3);
      const appSample = app.positions.slice(0, 3);
      const diff = Math.hypot(
        geomSample[0] - appSample[0],
        geomSample[1] - appSample[1],
        geomSample[2] - appSample[2],
      );
      expect(diff).toBeGreaterThan(0.05);
    });
  });

  // =========================================================================
  // Challenge 8: Three.js Fronts Layer Integration (`src/globe/fronts.ts`)
  // =========================================================================
  describe('Challenge 8: Three.js Fronts Layer Integration', () => {
    it('initializes PrayerFrontsLayer with all 9 fronts, distinct colors, and manages updates', () => {
      const layer = createPrayerFrontsLayer();
      expect(layer.group).toBeDefined();
      expect(layer.group.name).toBe('prayer-fronts-layer');

      // Verify group contains 18 children (9 core lines + 9 glow lines)
      expect(layer.group.children.length).toBe(18);

      const subsolar: SubsolarCoordinates = { latitude: 12, longitude: 45 };
      const date = new Date('2026-10-04T12:00:00Z');

      // Update layer with data
      expect(() => {
        layer.update(subsolar, CALCULATION_CONVENTIONS.UmmAlQura, 'Shafi', date);
      }).not.toThrow();

      // Test visibility toggles
      expect(() => {
        layer.setVisibility('fajr', false);
        layer.setVisibility('fajr', true);
        layer.setAllVisibility(false);
        layer.setAllVisibility(true);
        layer.setResolution(1920, 1080);
      }).not.toThrow();

      // Test resource cleanup
      expect(() => {
        layer.dispose();
      }).not.toThrow();
    });
  });
});
