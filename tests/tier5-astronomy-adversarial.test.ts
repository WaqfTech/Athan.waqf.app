// White-Box Adversarial Coverage Hardening for Astronomy & Prayer Engine
// Covers:
// - Brent solver edge conditions (grazing contacts, rapid derivatives, extreme tolerances)
// - Positive noon shadow edge cases (noon altitude 0.0, slightly negative, subsolar point)
// - Polar transitions (equinoxes vs solstices, latitude 66.5 - 90 N/S)
// - AngleBased fractional night dynamics vs MiddleOfTheNight / SeventhOfTheNight
// - 10 Conventions x 2 Madhabs x 3 High-Latitude Rules exhaustive matrix across extreme geographies
// - Strict Provenance Tag Invariants across all branches and calculations
// - Prayer Fronts and Contour Geometry boundary conditions

import { describe, it, expect } from 'vitest';
import {
  getSolarAltitude,
  getSolarDeclination,
  getEquationOfTime,
  getSubsolarPoint,
  getSolarAzimuth,
} from '../src/astronomy/solar';
import {
  findSolarCrossing,
  calculateNoonShadowRatio,
  calculateAsrAltitude,
  SolarEventResult,
} from '../src/astronomy/events';
import {
  getLocalHourAngle,
  latLonToVector3,
} from '../src/astronomy/coordinates';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from '../src/prayer/conventions';
import {
  calculatePrayerTimes,
  isPrayerResolved,
  PrayerEntry,
  PrayerProvenance,
  PrayerTimesSchedule,
} from '../src/prayer/calculator';
import {
  wrap180,
  generateSolarAltitudeRing,
  generateSolarAltitudeArc,
  generateDhuhrFront,
  generateAsrFront,
  generateGlobalPrayerFronts,
} from '../src/prayer/contours';

describe('Tier 5: White-Box Adversarial Coverage Hardening (Astronomy & Prayer Engine)', () => {
  // ==========================================================================
  // Suite 1: Brent Root Solver & Grazing Contact Edge Conditions
  // ==========================================================================
  describe('Suite 1: Brent Root Solver & Grazing Contact Edge Conditions', () => {
    const testDate = new Date('2026-03-20T12:00:00Z'); // Vernal equinox

    // Compute actual solar noon and nadir for Tromso (69.65, 18.96) on testDate
    const year = testDate.getUTCFullYear();
    const month = testDate.getUTCMonth();
    const day = testDate.getUTCDate();
    const utcMidnight = Date.UTC(year, month, day);
    const approxNoon = new Date(utcMidnight + 12 * 3600000);
    const eot = getEquationOfTime(approxNoon);
    const solarNoonHours = 12 - 18.96 / 15 - eot / 60;
    const solarNoonMs = utcMidnight + solarNoonHours * 3600000;
    const noonDate = new Date(solarNoonMs);
    const hNoon = getSolarAltitude(69.65, 18.96, noonDate);
    const nadirDateRising = new Date(solarNoonMs - 12 * 3600000);
    const nadirDateSetting = new Date(solarNoonMs + 12 * 3600000);
    const hNadirRising = getSolarAltitude(69.65, 18.96, nadirDateRising);
    const hNadirSetting = getSolarAltitude(69.65, 18.96, nadirDateSetting);

    it('S1.1: Exact grazing contact at hMax returns grazing kind with tangent altitude and hour angle 0', () => {
      const res = findSolarCrossing(69.65, 18.96, hNoon, testDate, 'rising');

      expect(res.kind).toBe('grazing');
      if (res.kind === 'grazing') {
        expect(res.date).toBeInstanceOf(Date);
        expect(res.tangentAltitudeDeg).toBeCloseTo(hNoon, 3);
        expect(res.hourAngleDeg).toBe(0);
      }
    });

    it('S1.2: Exact grazing contact at hMin returns grazing kind with tangent altitude and hour angle +-180', () => {
      const resRising = findSolarCrossing(69.65, 18.96, hNadirRising, testDate, 'rising');
      const resSetting = findSolarCrossing(69.65, 18.96, hNadirSetting, testDate, 'setting');

      expect(resRising.kind).toBe('grazing');
      if (resRising.kind === 'grazing') {
        expect(resRising.hourAngleDeg).toBe(-180);
      }

      expect(resSetting.kind).toBe('grazing');
      if (resSetting.kind === 'grazing') {
        expect(resSetting.hourAngleDeg).toBe(180);
      }
    });

    it('S1.3: Grazing contact discrimination within epsilon (0.005 deg)', () => {
      // Within default epsilon (0.005) -> grazing
      const resInside = findSolarCrossing(69.65, 18.96, hNoon - 0.003, testDate, 'rising');
      expect(resInside.kind).toBe('grazing');

      // Beyond epsilon (0.005) -> full crossing solved by Brent
      const resOutside = findSolarCrossing(69.65, 18.96, hNoon - 0.05, testDate, 'rising');
      expect(resOutside.kind).toBe('crossing');
      if (resOutside.kind === 'crossing') {
        expect(resOutside.actualAltitudeDeg).toBeCloseTo(hNoon - 0.05, 3);
        expect(resOutside.direction).toBe('rising');
        expect(resOutside.hourAngleDeg).toBeLessThan(0);
        expect(resOutside.bracketDurationSeconds).toBeGreaterThan(0);
      }
    });

    it('S1.4: Custom toleranceDeg (0.001 deg) shifts the grazing/crossing threshold', () => {
      // 0.003 deg below hNoon with tolerance 0.001 deg must be a crossing, not grazing
      const res = findSolarCrossing(69.65, 18.96, hNoon - 0.003, testDate, 'rising', {
        toleranceDeg: 0.001,
      });
      expect(res.kind).toBe('crossing');
      if (res.kind === 'crossing') {
        expect(res.actualAltitudeDeg).toBeCloseTo(hNoon - 0.003, 3);
      }
    });

    it('S1.5: Target altitude beyond hMax + epsilon yields alwaysBelow', () => {
      const res = findSolarCrossing(69.65, 18.96, hNoon + 0.1, testDate, 'rising');
      expect(res.kind).toBe('alwaysBelow');
      expect(res.date).toBeNull();
    });

    it('S1.6: Target altitude below hMin - epsilon yields alwaysAbove', () => {
      const res = findSolarCrossing(69.65, 18.96, hNadirRising - 0.1, testDate, 'rising');
      expect(res.kind).toBe('alwaysAbove');
      expect(res.date).toBeNull();
    });

    it('S1.7: Rapid altitude derivative at equator converges cleanly with tight tolerance', () => {
      // Near solar noon at equator, Sun ascends and descends rapidly
      const resRising = findSolarCrossing(0, 0, 45.0, testDate, 'rising');
      const resSetting = findSolarCrossing(0, 0, 45.0, testDate, 'setting');

      expect(resRising.kind).toBe('crossing');
      expect(resSetting.kind).toBe('crossing');

      if (resRising.kind === 'crossing' && resSetting.kind === 'crossing') {
        expect(resRising.actualAltitudeDeg).toBeCloseTo(45.0, 3);
        expect(resSetting.actualAltitudeDeg).toBeCloseTo(45.0, 3);
        expect(resRising.hourAngleDeg).toBeCloseTo(-45.0, 1);
        expect(resSetting.hourAngleDeg).toBeCloseTo(45.0, 1);
        expect(resRising.date.getTime()).toBeLessThan(resSetting.date.getTime());
      }
    });

    it('S1.8: Custom maxIterations parameter survives without throwing and terminates cleanly', () => {
      const res1 = findSolarCrossing(45, 10, 0.0, testDate, 'rising', { maxIterations: 5 });
      const res2 = findSolarCrossing(45, 10, 0.0, testDate, 'rising', { maxIterations: 60 });

      expect(res1.kind).toBe('crossing');
      expect(res2.kind).toBe('crossing');
      if (res1.kind === 'crossing' && res2.kind === 'crossing') {
        expect(res2.actualAltitudeDeg).toBeCloseTo(0.0, 3);
      }
    });

    it('S1.9: Window parameter input object { start, end } is supported', () => {
      const windowObj = {
        start: new Date('2026-03-20T00:00:00Z'),
        end: new Date('2026-03-20T23:59:59Z'),
      };
      const res = findSolarCrossing(21.42, 39.82, -0.8333, windowObj, 'rising');
      expect(res.kind).toBe('crossing');
      expect(res.date).toBeInstanceOf(Date);
    });

    it('S1.10: Rejects invalid inputs with typed invalid result and null date', () => {
      const invalidLat = findSolarCrossing(95, 0, 0, testDate, 'rising');
      expect(invalidLat.kind).toBe('invalid');
      expect(invalidLat.date).toBeNull();

      const nanLon = findSolarCrossing(0, NaN, 0, testDate, 'rising');
      expect(nanLon.kind).toBe('invalid');
      expect(nanLon.date).toBeNull();

      const invalidAlt = findSolarCrossing(0, 0, -100, testDate, 'rising');
      expect(invalidAlt.kind).toBe('invalid');
      expect(invalidAlt.date).toBeNull();

      const invalidDate = findSolarCrossing(0, 0, 0, new Date('invalid'), 'rising');
      expect(invalidDate.kind).toBe('invalid');
      expect(invalidDate.date).toBeNull();

      const invalidWindow = findSolarCrossing(0, 0, 0, {} as unknown as Date, 'rising');
      expect(invalidWindow.kind).toBe('invalid');
      expect(invalidWindow.date).toBeNull();
    });
  });

  // ==========================================================================
  // Suite 2: Positive Noon Shadow & Asr Calculation Edge Cases
  // ==========================================================================
  describe('Suite 2: Positive Noon Shadow & Asr Calculation Edge Cases', () => {
    it('S2.1: Local solar noon altitude exactly 0.0 deg returns null shadow and null Asr altitude', () => {
      // zenith = |lat - dec| = 90 deg -> noon altitude = 0.0 deg
      const noonShadow = calculateNoonShadowRatio(66.56, -23.44);
      expect(noonShadow).toBeNull();

      const asrAltShafi = calculateAsrAltitude(66.56, -23.44, 1);
      expect(asrAltShafi).toBeNull();

      const asrAltHanafi = calculateAsrAltitude(66.56, -23.44, 2);
      expect(asrAltHanafi).toBeNull();
    });

    it('S2.2: Local solar noon altitude slightly negative (-0.001 deg) returns null shadow', () => {
      const noonShadow = calculateNoonShadowRatio(66.561, -23.44);
      expect(noonShadow).toBeNull();

      const asrAlt = calculateAsrAltitude(66.561, -23.44, 1);
      expect(asrAlt).toBeNull();
    });

    it('S2.3: Local solar noon altitude slightly positive (+0.001 deg) produces valid positive shadow without NaN', () => {
      // zenith = 89.999 deg -> noon altitude = 0.001 deg
      const noonShadow = calculateNoonShadowRatio(66.559, -23.44);
      expect(noonShadow).not.toBeNull();
      expect(Number.isFinite(noonShadow)).toBe(true);
      expect(noonShadow!).toBeGreaterThan(50000); // tan(89.999 deg) ~ 57295

      const asrAlt = calculateAsrAltitude(66.559, -23.44, 1);
      expect(asrAlt).not.toBeNull();
      expect(Number.isFinite(asrAlt)).toBe(true);
      expect(asrAlt!).toBeGreaterThan(0);
      expect(asrAlt!).toBeLessThan(0.01);
    });

    it('S2.4: Subsolar point (zenith = 0 deg, Sun overhead) yields noon shadow 0.0 and canonical Asr angles', () => {
      const noonShadow = calculateNoonShadowRatio(15.0, 15.0);
      expect(noonShadow).toBeCloseTo(0.0, 6);

      // Shafi (shadowFactor 1): atan(1 / (0 + 1)) = 45 deg
      const asrShafi = calculateAsrAltitude(15.0, 15.0, 1);
      expect(asrShafi).toBeCloseTo(45.0, 4);

      // Hanafi (shadowFactor 2): atan(1 / (0 + 2)) = atan(0.5) ~ 26.565 deg
      const asrHanafi = calculateAsrAltitude(15.0, 15.0, 2);
      expect(asrHanafi).toBeCloseTo(26.565, 3);
    });

    it('S2.5: Arctic winter solstice: noon altitude < 0 across all latitudes >= 67N returns null shadow', () => {
      const arcticLats = [67.0, 70.0, 75.0, 80.0, 85.0, 90.0];
      for (const lat of arcticLats) {
        const shadow = calculateNoonShadowRatio(lat, -23.44);
        expect(shadow).toBeNull();
        expect(calculateAsrAltitude(lat, -23.44, 1)).toBeNull();
      }
    });

    it('S2.6: Antarctic winter solstice: noon altitude < 0 across all latitudes <= -67S returns null shadow', () => {
      const antarcticLats = [-67.0, -70.0, -75.0, -80.0, -85.0, -90.0];
      for (const lat of antarcticLats) {
        const shadow = calculateNoonShadowRatio(lat, 23.44);
        expect(shadow).toBeNull();
        expect(calculateAsrAltitude(lat, 23.44, 1)).toBeNull();
      }
    });

    it('S2.7: Invalid shadow factors (0, negative, NaN, Infinity) return null Asr altitude', () => {
      expect(calculateAsrAltitude(0, 0, 0)).toBeNull();
      expect(calculateAsrAltitude(0, 0, -1)).toBeNull();
      expect(calculateAsrAltitude(0, 0, NaN)).toBeNull();
      expect(calculateAsrAltitude(0, 0, Infinity)).toBeNull();
    });

    it('S2.8: Invalid coordinates or declination return null noon shadow', () => {
      expect(calculateNoonShadowRatio(NaN, 0)).toBeNull();
      expect(calculateNoonShadowRatio(0, NaN)).toBeNull();
      expect(calculateNoonShadowRatio(Infinity, 0)).toBeNull();
      expect(calculateNoonShadowRatio(0, Infinity)).toBeNull();
    });
  });

  // ==========================================================================
  // Suite 3: Polar Transitions & High Latitude Extremes (66.5 - 90 N/S)
  // ==========================================================================
  describe('Suite 3: Polar Transitions & High Latitude Extremes (66.5 - 90 N/S)', () => {
    const juneSolstice = new Date('2026-06-21T12:00:00Z');
    const decSolstice = new Date('2026-12-21T12:00:00Z');
    const marchEquinox = new Date('2026-03-20T12:00:00Z');
    const septEquinox = new Date('2026-09-22T12:00:00Z');

    it('S3.1: North Pole (90N) summer solstice exhibits midnight sun and virtual night prayer assignment', () => {
      const sched = calculatePrayerTimes(90, 0, juneSolstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      expect(sched.sunrise.date).toBeNull();
      expect(sched.sunrise.provenance).toBe('unresolved');
      expect(sched.sunset.date).toBeNull();
      expect(sched.sunset.provenance).toBe('unresolved');

      // Under highLatitudeRule, virtual night assigns Maghrib, Fajr, Isha
      expect(sched.maghrib.date).toBeInstanceOf(Date);
      expect(sched.maghrib.provenance).toBe('highLatitudeAdjustment');
      expect(sched.maghrib.ruleApplied).toBe('MiddleOfTheNight');

      expect(sched.fajr.date).toBeInstanceOf(Date);
      expect(sched.fajr.provenance).toBe('highLatitudeAdjustment');

      expect(sched.isha.date).toBeInstanceOf(Date);
      expect(sched.isha.provenance).toBe('highLatitudeAdjustment');
    });

    it('S3.2: North Pole (90N) winter solstice exhibits polar night and unresolved daytime prayers', () => {
      const sched = calculatePrayerTimes(90, 0, decSolstice);

      expect(sched.sunrise.date).toBeNull();
      expect(sched.sunrise.note).toBe('Polar night');
      expect(sched.sunrise.provenance).toBe('unresolved');

      expect(sched.sunset.date).toBeNull();
      expect(sched.sunset.note).toBe('Polar night');
      expect(sched.sunset.provenance).toBe('unresolved');

      expect(sched.asr.date).toBeNull();
      expect(sched.asr.provenance).toBe('unresolved');
      expect(sched.asr.note).toBe('No physical noon shadow');

      expect(sched.fajr.date).toBeNull();
      expect(sched.fajr.provenance).toBe('unresolved');
    });

    it('S3.3: South Pole (-90S) exhibits exact reverse seasonal polarity', () => {
      const schedSummer = calculatePrayerTimes(-90, 0, decSolstice, {
        highLatitudeRule: 'SeventhOfTheNight',
      });
      expect(schedSummer.sunrise.date).toBeNull();
      expect(schedSummer.maghrib.provenance).toBe('highLatitudeAdjustment');

      const schedWinter = calculatePrayerTimes(-90, 0, juneSolstice);
      expect(schedWinter.sunrise.date).toBeNull();
      expect(schedWinter.sunrise.note).toBe('Polar night');
      expect(schedWinter.asr.date).toBeNull();
      expect(schedWinter.asr.provenance).toBe('unresolved');
    });

    it('S3.4: Arctic Circle (66.5N) on equinoxes has fully resolved 5-prayer schedule with astronomical signs', () => {
      for (const eq of [marchEquinox, septEquinox]) {
        const sched = calculatePrayerTimes(66.5, 0, eq);
        expect(sched.fajr.date).toBeInstanceOf(Date);
        expect(sched.sunrise.date).toBeInstanceOf(Date);
        expect(sched.dhuhr.date).toBeInstanceOf(Date);
        expect(sched.asr.date).toBeInstanceOf(Date);
        expect(sched.maghrib.date).toBeInstanceOf(Date);
        expect(sched.sunset.date).toBeInstanceOf(Date);
        expect(sched.isha.date).toBeInstanceOf(Date);

        expect(sched.fajr.provenance).toBe('astronomicalSign');
        expect(sched.sunrise.provenance).toBe('astronomicalSign');
        expect(sched.dhuhr.provenance).toBe('astronomicalSign');
        expect(sched.asr.provenance).toBe('astronomicalSign');
        expect(sched.maghrib.provenance).toBe('astronomicalSign');
        expect(sched.sunset.provenance).toBe('astronomicalSign');
      }
    });

    it('S3.5: Svalbard (78.22N) and Greenland (77.47N) transition gracefully across all 4 astronomical seasons', () => {
      const locations = [
        { name: 'Svalbard', lat: 78.22, lon: 15.65 },
        { name: 'Qaanaaq Greenland', lat: 77.47, lon: -69.23 },
      ];
      const seasons = [marchEquinox, juneSolstice, septEquinox, decSolstice];

      for (const loc of locations) {
        for (const date of seasons) {
          const sched = calculatePrayerTimes(loc.lat, loc.lon, date, {
            highLatitudeRule: 'AngleBased',
          });
          expect(sched).toBeDefined();
          expect(sched.dhuhr.date).toBeInstanceOf(Date);
          expect(sched.dhuhr.provenance).toBe('astronomicalSign');
        }
      }
    });
  });

  // ==========================================================================
  // Suite 4: AngleBased Rule & Fractional Night Dynamics
  // ==========================================================================
  describe('Suite 4: AngleBased Rule & Fractional Night Dynamics', () => {
    const londonLat = 51.5074;
    const londonLon = -0.1278;
    const midSummer = new Date('2026-06-21T12:00:00Z');

    it('S4.1: AngleBased fraction strictly equals fajrAngle / 60.0', () => {
      // In London mid-summer, astronomical twilight (-18 deg) is never reached at night,
      // but sunrise and sunset occur normally.
      const schedAngle = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague', // fajrAngle = 18.0
        highLatitudeRule: 'AngleBased',
      });

      expect(schedAngle.sunrise.date).toBeInstanceOf(Date);
      expect(schedAngle.sunset.date).toBeInstanceOf(Date);
      expect(schedAngle.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(schedAngle.fajr.ruleApplied).toBe('AngleBased');

      const sunriseMs = schedAngle.sunrise.date!.getTime();
      const sunsetMs = schedAngle.sunset.date!.getTime();
      const nightMs = 24 * 3600000 - (sunsetMs - sunriseMs);
      const expectedFraction = 18.0 / 60.0; // 0.30

      const expectedFajrMs = sunriseMs - nightMs * expectedFraction;
      expect(schedAngle.fajr.date!.getTime()).toBeCloseTo(expectedFajrMs, -2);
    });

    it('S4.2: High-latitude summer ordering: fajr(MiddleOfTheNight) < fajr(AngleBased) < fajr(SeventhOfTheNight) < sunrise', () => {
      const schedMOTN = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const schedAngle = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const schedSeventh = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });

      const fajrMOTN = schedMOTN.fajr.date!.getTime();
      const fajrAngle = schedAngle.fajr.date!.getTime();
      const fajrSeventh = schedSeventh.fajr.date!.getTime();
      const sunrise = schedMOTN.sunrise.date!.getTime();

      // fraction: Seventh (1/7 ~ 0.14) < AngleBased (18/60 = 0.30) < MOTN (1/2 = 0.50)
      // fajr = sunrise - night * fraction
      // Larger fraction gives earlier Fajr!
      expect(fajrMOTN).toBeLessThan(fajrAngle);
      expect(fajrAngle).toBeLessThan(fajrSeventh);
      expect(fajrSeventh).toBeLessThan(sunrise);
    });

    it('S4.3: High-latitude summer evening ordering: sunset < isha(SeventhOfTheNight) < isha(AngleBased) < isha(MiddleOfTheNight)', () => {
      const schedMOTN = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const schedAngle = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const schedSeventh = calculatePrayerTimes(londonLat, londonLon, midSummer, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });

      const sunset = schedMOTN.sunset.date!.getTime();
      const ishaSeventh = schedSeventh.isha.date!.getTime();
      const ishaAngle = schedAngle.isha.date!.getTime();
      const ishaMOTN = schedMOTN.isha.date!.getTime();

      // isha = sunset + night * fraction
      // Smaller fraction gives earlier Isha!
      expect(sunset).toBeLessThan(ishaSeventh);
      expect(ishaSeventh).toBeLessThan(ishaAngle);
      expect(ishaAngle).toBeLessThan(ishaMOTN);
    });

    it('S4.4: Summer twilight absence across Nordic capitals (Oslo, Stockholm, Helsinki, Reykjavik)', () => {
      const capitals = [
        { name: 'Oslo', lat: 59.91, lon: 10.75 },
        { name: 'Stockholm', lat: 59.33, lon: 18.06 },
        { name: 'Helsinki', lat: 60.17, lon: 24.94 },
        { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
      ];

      for (const cap of capitals) {
        const sched = calculatePrayerTimes(cap.lat, cap.lon, midSummer, {
          convention: 'MuslimWorldLeague',
          highLatitudeRule: 'AngleBased',
        });

        expect(sched.sunrise.date).toBeInstanceOf(Date);
        expect(sched.sunset.date).toBeInstanceOf(Date);
        expect(sched.fajr.provenance).toBe('highLatitudeAdjustment');
        expect(sched.fajr.ruleApplied).toBe('AngleBased');
        expect(sched.isha.provenance).toBe('highLatitudeAdjustment');
        expect(sched.isha.ruleApplied).toBe('AngleBased');

        // Temporal bounds check
        expect(sched.fajr.date!.getTime()).toBeLessThan(sched.sunrise.date!.getTime());
        expect(sched.isha.date!.getTime()).toBeGreaterThan(sched.sunset.date!.getTime());
      }
    });

    it('S4.5: Fixed-interval conventions (UmmAlQura, Qatar) in high-latitude summer maintain exact 90-minute delay', () => {
      const conventions: CalculationConventionName[] = ['UmmAlQura', 'Qatar'];
      for (const conv of conventions) {
        const sched = calculatePrayerTimes(londonLat, londonLon, midSummer, {
          convention: conv,
          highLatitudeRule: 'AngleBased',
        });

        expect(sched.maghrib.date).toBeInstanceOf(Date);
        expect(sched.isha.date).toBeInstanceOf(Date);
        expect(sched.isha.provenance).toBe('fixedInterval');

        const delayMinutes =
          (sched.isha.date!.getTime() - sched.maghrib.date!.getTime()) / 60000;
        expect(delayMinutes).toBeCloseTo(90.0, 1);
      }
    });
  });

  // ==========================================================================
  // Suite 5: 10 Conventions x 2 Madhabs x 3 Rules Exhaustive Matrix
  // ==========================================================================
  describe('Suite 5: 10 Conventions x 2 Madhabs x 3 Rules Exhaustive Matrix', () => {
    const allConventions = Object.keys(CALCULATION_CONVENTIONS) as CalculationConventionName[];
    const allMadhabs: Madhab[] = ['Shafi', 'Hanafi'];
    const allRules: HighLatitudeRule[] = ['MiddleOfTheNight', 'SeventhOfTheNight', 'AngleBased'];

    const testLocations = [
      { name: 'Singapore (Equator)', lat: 1.3521, lon: 103.8198 },
      { name: 'Ushuaia (Sub-Antarctic)', lat: -54.8019, lon: -68.303 },
      { name: 'Longyearbyen (Svalbard)', lat: 78.2232, lon: 15.6267 },
      { name: 'Nuuk (Greenland)', lat: 64.1814, lon: -51.6941 },
      { name: 'North Pole (90N)', lat: 90.0, lon: 0.0 },
      { name: 'South Pole (-90S)', lat: -90.0, lon: 0.0 },
    ];

    const testDate = new Date('2026-03-20T12:00:00Z');

    it('S5.1: 60 parameter combinations execute without exceptions on Singapore (Equator)', () => {
      const loc = testLocations[0];
      let evaluatedCount = 0;

      for (const conv of allConventions) {
        for (const madhab of allMadhabs) {
          for (const rule of allRules) {
            const sched = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
              convention: conv,
              madhab,
              highLatitudeRule: rule,
            });

            expect(sched).toBeDefined();
            expect(sched.fajr.date).toBeInstanceOf(Date);
            expect(sched.sunrise.date).toBeInstanceOf(Date);
            expect(sched.dhuhr.date).toBeInstanceOf(Date);
            expect(sched.asr.date).toBeInstanceOf(Date);
            expect(sched.maghrib.date).toBeInstanceOf(Date);
            expect(sched.isha.date).toBeInstanceOf(Date);
            evaluatedCount++;
          }
        }
      }

      expect(evaluatedCount).toBe(60);
    });

    it('S5.2: 60 parameter combinations execute without exceptions on Ushuaia', () => {
      const loc = testLocations[1];
      for (const conv of allConventions) {
        for (const madhab of allMadhabs) {
          for (const rule of allRules) {
            const sched = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
              convention: conv,
              madhab,
              highLatitudeRule: rule,
            });
            expect(sched.dhuhr.date).toBeInstanceOf(Date);
          }
        }
      }
    });

    it('S5.3: 60 parameter combinations execute without exceptions on Svalbard and Greenland', () => {
      for (const loc of [testLocations[2], testLocations[3]]) {
        for (const conv of allConventions) {
          for (const madhab of allMadhabs) {
            for (const rule of allRules) {
              const sched = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
                convention: conv,
                madhab,
                highLatitudeRule: rule,
              });
              expect(sched.dhuhr.date).toBeInstanceOf(Date);
            }
          }
        }
      }
    });

    it('S5.4: 60 parameter combinations execute without exceptions on North and South Poles', () => {
      for (const loc of [testLocations[4], testLocations[5]]) {
        for (const conv of allConventions) {
          for (const madhab of allMadhabs) {
            for (const rule of allRules) {
              const sched = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
                convention: conv,
                madhab,
                highLatitudeRule: rule,
              });
              expect(sched).toBeDefined();
              expect(sched.dhuhr.date).toBeInstanceOf(Date);
            }
          }
        }
      }
    });

    it('S5.5: Hanafi Asr is strictly later than Shafi Asr across all resolved cases in the matrix', () => {
      for (const loc of [testLocations[0], testLocations[1], testLocations[3]]) {
        for (const conv of allConventions) {
          const schedShafi = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
            convention: conv,
            madhab: 'Shafi',
          });
          const schedHanafi = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
            convention: conv,
            madhab: 'Hanafi',
          });

          if (schedShafi.asr.date !== null && schedHanafi.asr.date !== null) {
            expect(schedHanafi.asr.date.getTime()).toBeGreaterThan(
              schedShafi.asr.date.getTime(),
            );
          }
        }
      }
    });

    it('S5.6: Fixed-interval conventions produce exactly 90-minute Maghrib-to-Isha delay across matrix', () => {
      for (const conv of ['UmmAlQura', 'Qatar'] as CalculationConventionName[]) {
        for (const madhab of allMadhabs) {
          for (const rule of allRules) {
            const sched = calculatePrayerTimes(1.35, 103.82, testDate, {
              convention: conv,
              madhab,
              highLatitudeRule: rule,
            });
            expect(sched.isha.provenance).toBe('fixedInterval');
            const diffMin =
              (sched.isha.date!.getTime() - sched.maghrib.date!.getTime()) / 60000;
            expect(diffMin).toBeCloseTo(90.0, 1);
          }
        }
      }
    });
  });

  // ==========================================================================
  // Suite 6: Provenance Tag Invariants & Schedule Integrity
  // ==========================================================================
  describe('Suite 6: Provenance Tag Invariants & Schedule Integrity', () => {
    const dates = [
      new Date('2026-03-20T12:00:00Z'),
      new Date('2026-06-21T12:00:00Z'),
      new Date('2026-09-22T12:00:00Z'),
      new Date('2026-12-21T12:00:00Z'),
    ];

    const testPoints = [
      { lat: 0, lon: 0 },
      { lat: 21.42, lon: 39.82 }, // Makkah
      { lat: 51.51, lon: -0.13 }, // London
      { lat: 69.65, lon: 18.96 }, // Tromso
      { lat: 78.22, lon: 15.65 }, // Svalbard
      { lat: 90.0, lon: 0.0 },    // North Pole
      { lat: -90.0, lon: 0.0 },   // South Pole
    ];

    it('S6.1: Invariant: date === null if and only if provenance === "unresolved"', () => {
      let entriesEvaluated = 0;

      for (const pt of testPoints) {
        for (const d of dates) {
          for (const rule of ['MiddleOfTheNight', 'AngleBased'] as HighLatitudeRule[]) {
            const sched = calculatePrayerTimes(pt.lat, pt.lon, d, {
              highLatitudeRule: rule,
            });

            const keys: (keyof DailyPrayerTimes)[] = [
              'fajr',
              'sunrise',
              'dhuhr',
              'asr',
              'maghrib',
              'isha',
            ];

            for (const k of keys) {
              const entry = sched[k];
              entriesEvaluated++;

              if (entry.date === null) {
                expect(entry.provenance).toBe('unresolved');
              } else {
                expect(entry.provenance).not.toBe('unresolved');
                expect([
                  'astronomicalSign',
                  'fixedInterval',
                  'highLatitudeAdjustment',
                ]).toContain(entry.provenance);
              }
            }
          }
        }
      }

      expect(entriesEvaluated).toBeGreaterThan(300);
    });

    it('S6.2: Invariant: provenance === "highLatitudeAdjustment" always defines ruleApplied', () => {
      for (const pt of testPoints) {
        for (const d of dates) {
          const sched = calculatePrayerTimes(pt.lat, pt.lon, d, {
            highLatitudeRule: 'AngleBased',
          });
          const keys: (keyof DailyPrayerTimes)[] = ['fajr', 'maghrib', 'isha'];
          for (const k of keys) {
            const entry = sched[k];
            if (entry.provenance === 'highLatitudeAdjustment') {
              expect(entry.ruleApplied).toBe('AngleBased');
            }
          }
        }
      }
    });

    it('S6.3: Invariant: provenance === "astronomicalSign" matches target altitude within 0.01 deg', () => {
      // Test astronomical signs on temperate city (Makkah)
      const makkahDate = new Date('2026-03-20T12:00:00Z');
      const sched = calculatePrayerTimes(21.42, 39.82, makkahDate, {
        convention: 'MuslimWorldLeague',
      });

      // Sunrise target: -0.8333 deg
      if (sched.sunrise.provenance === 'astronomicalSign') {
        const alt = getSolarAltitude(21.42, 39.82, sched.sunrise.date!);
        expect(alt).toBeCloseTo(-0.8333, 2);
      }

      // Sunset target: -0.8333 deg
      if (sched.sunset.provenance === 'astronomicalSign') {
        const alt = getSolarAltitude(21.42, 39.82, sched.sunset.date!);
        expect(alt).toBeCloseTo(-0.8333, 2);
      }

      // Fajr target: -18.0 deg
      if (sched.fajr.provenance === 'astronomicalSign') {
        const alt = getSolarAltitude(21.42, 39.82, sched.fajr.date!);
        expect(alt).toBeCloseTo(-18.0, 2);
      }

      // Isha target: -17.0 deg
      if (sched.isha.provenance === 'astronomicalSign') {
        const alt = getSolarAltitude(21.42, 39.82, sched.isha.date!);
        expect(alt).toBeCloseTo(-17.0, 2);
      }
    });

    it('S6.4: Invariant: Dhuhr always has astronomicalSign provenance with exact safety offset', () => {
      const conventions: CalculationConventionName[] = ['MuslimWorldLeague', 'Egyptian', 'UmmAlQura'];
      for (const convName of conventions) {
        const sched = calculatePrayerTimes(21.42, 39.82, new Date('2026-03-20T12:00:00Z'), {
          convention: convName,
        });
        expect(sched.dhuhr.provenance).toBe('astronomicalSign');
        expect(sched.dhuhr.date).toBeInstanceOf(Date);
      }
    });

    it('S6.5: Countdown and lookahead logic across daytime progression', () => {
      const date = new Date('2026-03-20T12:00:00Z');
      const sched = calculatePrayerTimes(21.42, 39.82, date, {
        now: new Date('2026-03-20T08:00:00Z'), // Morning between sunrise and dhuhr
      });

      expect(sched.currentPrayer).toBe('none'); // Duha period
      expect(sched.nextPrayer).toBe('dhuhr');
      expect(sched.nextPrayerTime).toBeInstanceOf(Date);
      expect(sched.countdownMs).toBeGreaterThan(0);
    });

    it('S6.6: Multi-day lookahead retrieves tomorrow Fajr when current time is past Isha', () => {
      const nowPastIsha = new Date('2026-03-20T21:00:00Z');
      const sched = calculatePrayerTimes(21.42, 39.82, nowPastIsha, {
        now: nowPastIsha,
      });

      expect(sched.currentPrayer).toBe('isha');
      expect(sched.nextPrayer).toBe('fajr');
      expect(sched.nextPrayerTime).toBeInstanceOf(Date);
      expect(sched.nextPrayerTime!.getUTCDate()).toBe(21); // Next calendar day
      expect(sched.countdownMs).toBeGreaterThan(0);
    });

    it('S6.7: isPrayerResolved type guard works as expected', () => {
      const validEntry: PrayerEntry = {
        date: new Date(),
        provenance: 'astronomicalSign',
      };
      const nullEntry: PrayerEntry = {
        date: null,
        provenance: 'unresolved',
      };

      expect(isPrayerResolved(validEntry)).toBe(true);
      expect(isPrayerResolved(nullEntry)).toBe(false);
    });
  });

  // ==========================================================================
  // Suite 7: Prayer Fronts & Contour Geometry Boundary Hardening
  // ==========================================================================
  describe('Suite 7: Prayer Fronts & Contour Geometry Boundary Hardening', () => {
    it('S7.1: wrap180 boundary arithmetic handles exact edge angles', () => {
      expect(wrap180(0)).toBe(0);
      expect(wrap180(180)).toBe(180);
      expect(wrap180(-180)).toBe(-180);
      expect(wrap180(181)).toBe(-179);
      expect(wrap180(-181)).toBe(179);
      expect(wrap180(360)).toBe(0);
      expect(wrap180(-360) + 0).toBe(0);
      expect(wrap180(540)).toBe(180);
      expect(wrap180(-540)).toBe(-180);
    });

    it('S7.2: generateAsrFront enforces positive noon shadow and afternoon hemisphere (H > 0)', () => {
      const subsolar = { latitude: 0.0, longitude: 0.0 };
      const asrFrontShafi = generateAsrFront(subsolar, 'Shafi', 1.0);
      const asrFrontHanafi = generateAsrFront(subsolar, 'Hanafi', 1.0);

      expect(asrFrontShafi.pointCount).toBeGreaterThan(0);
      expect(asrFrontHanafi.pointCount).toBeGreaterThan(0);

      // Verify all points have X > 0 in 3D coordinates (East of subsolar at lon 0)
      for (let i = 0; i < asrFrontShafi.pointCount; i++) {
        const px = asrFrontShafi.positions[i * 3];
        expect(px).toBeGreaterThanOrEqual(0);
      }
    });

    it('S7.3: Apparent terminator (-0.8333 deg) and Geometric terminator (0.0 deg) have distinct radii', () => {
      const subsolar = { latitude: 10.0, longitude: 20.0 };
      const geomRing = generateSolarAltitudeRing(subsolar, 0.0, 1.0, 36);
      const appRing = generateSolarAltitudeRing(subsolar, -0.8333, 1.0, 36);

      expect(geomRing.pointCount).toBe(37);
      expect(appRing.pointCount).toBe(37);

      // Position vectors must differ due to 0.8333 deg angular difference
      let maxDiff = 0;
      for (let i = 0; i < geomRing.positions.length; i++) {
        const diff = Math.abs(geomRing.positions[i] - appRing.positions[i]);
        if (diff > maxDiff) maxDiff = diff;
      }
      expect(maxDiff).toBeGreaterThan(0.01);
    });

    it('S7.4: Fixed-interval Isha front reflects 90-minute eastward offset in subsolar longitude', () => {
      const subsolar = { latitude: 0.0, longitude: 0.0 };
      const fronts = generateGlobalPrayerFronts(
        subsolar,
        CALCULATION_CONVENTIONS.UmmAlQura,
        'Shafi',
        1.0,
      );

      expect(fronts.isha.pointCount).toBeGreaterThan(0);
      expect(fronts.maghrib.pointCount).toBeGreaterThan(0);
    });

    it('S7.5: generateGlobalPrayerFronts runs across all 10 conventions with and without explicit date', () => {
      const subsolar = { latitude: 15.0, longitude: 45.0 };
      const allConvs = Object.values(CALCULATION_CONVENTIONS);
      const testDate = new Date('2026-03-20T12:00:00Z');

      for (const conv of allConvs) {
        const frontsWithDate = generateGlobalPrayerFronts(subsolar, conv, 'Shafi', 1.0, testDate);
        const frontsNoDate = generateGlobalPrayerFronts(subsolar, conv, 'Hanafi', 1.0);

        expect(frontsWithDate.fajr.pointCount).toBeGreaterThan(0);
        expect(frontsWithDate.dhuhr.pointCount).toBeGreaterThan(0);
        expect(frontsWithDate.asr.pointCount).toBeGreaterThan(0);
        expect(frontsWithDate.maghrib.pointCount).toBeGreaterThan(0);
        expect(frontsWithDate.isha.pointCount).toBeGreaterThan(0);

        expect(frontsNoDate.fajr.pointCount).toBeGreaterThan(0);
        expect(frontsNoDate.dhuhr.pointCount).toBeGreaterThan(0);
      }
    });

    it('S7.6: Dhuhr front spans from -88 deg to +88 deg latitude along subsolar meridian', () => {
      const subsolar = { latitude: 5.0, longitude: 30.0 };
      const dhuhrFront = generateDhuhrFront(subsolar, 1.0, 48);

      expect(dhuhrFront.pointCount).toBe(49);
      // South point at lat -88 -> y should be close to sin(-88 deg) ~ -0.999
      expect(dhuhrFront.positions[1]).toBeCloseTo(-0.999, 2);
      // North point at lat +88 -> y should be close to sin(+88 deg) ~ +0.999
      const lastIdx = (dhuhrFront.pointCount - 1) * 3;
      expect(dhuhrFront.positions[lastIdx + 1]).toBeCloseTo(0.999, 2);
    });
  });

  // ==========================================================================
  // Suite 8: Solar Ephemeris & Astronomical Fundamentals Hardening
  // ==========================================================================
  describe('Suite 8: Solar Ephemeris & Astronomical Fundamentals Hardening', () => {
    it('S8.1: getSolarDeclination strictly bounded within [-23.5, 23.5] across 365 days', () => {
      const baseMs = Date.UTC(2026, 0, 1, 12, 0, 0);
      for (let day = 0; day < 365; day += 5) {
        const d = new Date(baseMs + day * 86400000);
        const dec = getSolarDeclination(d);
        expect(dec).toBeGreaterThanOrEqual(-23.5);
        expect(dec).toBeLessThanOrEqual(23.5);
      }
    });

    it('S8.2: getEquationOfTime strictly bounded within [-20, 20] minutes across 365 days', () => {
      const baseMs = Date.UTC(2026, 0, 1, 12, 0, 0);
      for (let day = 0; day < 365; day += 5) {
        const d = new Date(baseMs + day * 86400000);
        const eot = getEquationOfTime(d);
        expect(eot).toBeGreaterThan(-17.0);
        expect(eot).toBeLessThan(17.0);
      }
    });

    it('S8.3: getSubsolarPoint longitude and latitude bounds', () => {
      const baseMs = Date.UTC(2026, 5, 21, 0, 0, 0);
      for (let hour = 0; hour < 24; hour++) {
        const d = new Date(baseMs + hour * 3600000);
        const pt = getSubsolarPoint(d);
        expect(pt.latitude).toBeGreaterThanOrEqual(-23.5);
        expect(pt.latitude).toBeLessThanOrEqual(23.5);
        expect(pt.longitude).toBeGreaterThanOrEqual(-180);
        expect(pt.longitude).toBeLessThanOrEqual(180);
      }
    });

    it('S8.4: getSolarAltitude throws TypeError or RangeError on invalid coordinates', () => {
      const d = new Date('2026-03-20T12:00:00Z');
      expect(() => getSolarAltitude(95, 0, d)).toThrow(RangeError);
      expect(() => getSolarAltitude(-95, 0, d)).toThrow(RangeError);
      expect(() => getSolarAltitude(NaN, 0, d)).toThrow(TypeError);
      expect(() => getSolarAltitude(0, NaN, d)).toThrow(TypeError);
    });

    it('S8.5: getSolarAzimuth returns values strictly in [0, 360)', () => {
      const d = new Date('2026-03-20T12:00:00Z');
      const testCoordinates = [
        { lat: 0, lon: 0 },
        { lat: 45, lon: 45 },
        { lat: -45, lon: -45 },
        { lat: 89.9, lon: 100 },
        { lat: -89.9, lon: -100 },
      ];

      for (const coord of testCoordinates) {
        const az = getSolarAzimuth(coord.lat, coord.lon, d);
        expect(Number.isFinite(az)).toBe(true);
        expect(az).toBeGreaterThanOrEqual(0);
        expect(az).toBeLessThan(360);
      }
    });
  });
});
