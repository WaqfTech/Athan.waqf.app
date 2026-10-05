import { describe, it, expect } from 'vitest';
import { calculatePrayerTimes } from '../src/prayer/calculator';
import { CALCULATION_CONVENTIONS, HighLatitudeRule } from '../src/prayer/conventions';
import { calculateNoonShadowRatio, calculateAsrAltitude, findSolarCrossing } from '../src/astronomy/events';
import { getSolarDeclination, getSolarAltitude } from '../src/astronomy/solar';

describe('Adversarial Challenge: Prayer Calculation Engine & High-Latitude Rules (Cell C03)', () => {

  // ==========================================================================
  // Challenge Domain 1: High Latitude Summer Matrix (London, Oslo, Reykjavik, St. Petersburg, Stockholm)
  // ==========================================================================
  describe('C03.1: High Latitude Summer Matrix (5 Cities x Solstice/Midsummer)', () => {
    const highLatCities = [
      { name: 'London', lat: 51.5074, lon: -0.1278 },
      { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
      { name: 'Reykjavik', lat: 64.1466, lon: -21.9426 },
      { name: 'St. Petersburg', lat: 59.9311, lon: 30.3609 },
      { name: 'Stockholm', lat: 59.3293, lon: 18.0686 },
    ];

    const summerDates = [
      new Date('2026-06-01T12:00:00Z'),
      new Date('2026-06-21T12:00:00Z'), // Solstice
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-15T12:00:00Z'),
    ];

    const rules: HighLatitudeRule[] = ['MiddleOfTheNight', 'SeventhOfTheNight', 'AngleBased'];

    for (const city of highLatCities) {
      for (const date of summerDates) {
        it(`${city.name} on ${date.toISOString().slice(0, 10)}: distinct results across rules and correct night fractions`, () => {
          const results = rules.map((rule) => {
            return {
              rule,
              sched: calculatePrayerTimes(city.lat, city.lon, date, {
                convention: 'MuslimWorldLeague',
                highLatitudeRule: rule,
              }),
            };
          });

          const middle = results.find((r) => r.rule === 'MiddleOfTheNight')!.sched;
          const seventh = results.find((r) => r.rule === 'SeventhOfTheNight')!.sched;
          const angle = results.find((r) => r.rule === 'AngleBased')!.sched;

          // Fajr checks
          expect(middle.fajr.provenance).toBe('highLatitudeAdjustment');
          expect(seventh.fajr.provenance).toBe('highLatitudeAdjustment');
          expect(angle.fajr.provenance).toBe('highLatitudeAdjustment');

          expect(middle.fajr.ruleApplied).toBe('MiddleOfTheNight');
          expect(seventh.fajr.ruleApplied).toBe('SeventhOfTheNight');
          expect(angle.fajr.ruleApplied).toBe('AngleBased');

          expect(middle.fajr.date).not.toBeNull();
          expect(seventh.fajr.date).not.toBeNull();
          expect(angle.fajr.date).not.toBeNull();

          const tMiddleFajr = middle.fajr.date!.getTime();
          const tSeventhFajr = seventh.fajr.date!.getTime();
          const tAngleFajr = angle.fajr.date!.getTime();

          // 1. Strict inequality: AngleBased MUST NOT equal MiddleOfTheNight (Witness W03)
          expect(tAngleFajr).not.toBe(tMiddleFajr);
          expect(tAngleFajr).not.toBe(tSeventhFajr);
          expect(tMiddleFajr).not.toBe(tSeventhFajr);

          // 2. Strict fraction ordering:
          // Fraction: Seventh (1/7 ~= 0.1429) < AngleBased (18/60 = 0.3000) < Middle (1/2 = 0.5000)
          // Since Fajr = sunrise - nightDuration * fraction, higher fraction means earlier time.
          // Therefore: tMiddleFajr < tAngleFajr < tSeventhFajr
          expect(tMiddleFajr).toBeLessThan(tAngleFajr);
          expect(tAngleFajr).toBeLessThan(tSeventhFajr);

          // Isha checks (MWL has ishaAngle = 17 deg)
          // On July 15 in London, the Sun physically crosses -17 deg at 23:49 UTC,
          // yielding a valid astronomical crossing (Criterion A10).
          if (city.name === 'London' && date.toISOString().slice(0, 10) === '2026-07-15') {
            expect(middle.isha.provenance).toBe('astronomicalSign');
            expect(seventh.isha.provenance).toBe('astronomicalSign');
            expect(angle.isha.provenance).toBe('astronomicalSign');
            expect(middle.isha.date).not.toBeNull();
          } else {
            expect(middle.isha.provenance).toBe('highLatitudeAdjustment');
            expect(seventh.isha.provenance).toBe('highLatitudeAdjustment');
            expect(angle.isha.provenance).toBe('highLatitudeAdjustment');

            expect(middle.isha.date).not.toBeNull();
            expect(seventh.isha.date).not.toBeNull();
            expect(angle.isha.date).not.toBeNull();

            const tMiddleIsha = middle.isha.date!.getTime();
            const tSeventhIsha = seventh.isha.date!.getTime();
            const tAngleIsha = angle.isha.date!.getTime();

            // 3. Strict inequality for Isha
            expect(tAngleIsha).not.toBe(tMiddleIsha);
            expect(tAngleIsha).not.toBe(tSeventhIsha);

            // 4. Strict fraction ordering for Isha:
            // Since Isha = sunset + nightDuration * fraction, higher fraction means later time.
            // Fraction: Seventh (1/7 ~= 0.1429) < AngleBased (17/60 = 0.2833) < Middle (1/2 = 0.5000)
            // Therefore: tSeventhIsha < tAngleIsha < tMiddleIsha
            expect(tSeventhIsha).toBeLessThan(tAngleIsha);
            expect(tAngleIsha).toBeLessThan(tMiddleIsha);
          }

          // 5. Significant gap: difference between Middle and Angle must be substantial (> 20 min in high latitudes)
          const fajrDiffMin = Math.abs(tAngleFajr - tMiddleFajr) / 60000;
          expect(fajrDiffMin).toBeGreaterThan(20);
        });
      }
    }
  });

  // ==========================================================================
  // Challenge Domain 2: Multiple Conventions with AngleBased Rule
  // ==========================================================================
  describe('C03.2: Dynamic AngleBased Proportions Across Calculation Conventions', () => {
    it('evaluates varying fractions according to configured convention angles in Oslo (where all conventions lack twilight)', () => {
      const date = new Date('2026-06-21T12:00:00Z');
      const lat = 59.9139; // Oslo (nadir altitude is -6.66 deg, so 15, 18, and 19.5 deg all lack twilight)
      const lon = 10.7522;

      // North America: fajrAngle = 15.0 deg -> fraction = 15/60 = 0.25
      const schedNA = calculatePrayerTimes(lat, lon, date, {
        convention: 'NorthAmerica',
        highLatitudeRule: 'AngleBased',
      });

      // MWL: fajrAngle = 18.0 deg -> fraction = 18/60 = 0.30
      const schedMWL = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });

      // Egyptian: fajrAngle = 19.5 deg -> fraction = 19.5/60 = 0.325
      const schedEgy = calculatePrayerTimes(lat, lon, date, {
        convention: 'Egyptian',
        highLatitudeRule: 'AngleBased',
      });

      expect(schedNA.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(schedMWL.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(schedEgy.fajr.provenance).toBe('highLatitudeAdjustment');

      const tFajrNA = schedNA.fajr.date!.getTime();
      const tFajrMWL = schedMWL.fajr.date!.getTime();
      const tFajrEgy = schedEgy.fajr.date!.getTime();

      // Larger angle -> larger fraction subtracted -> earlier Fajr
      // Egyptian (0.325) should be earlier than MWL (0.30) which should be earlier than NA (0.25)
      expect(tFajrEgy).toBeLessThan(tFajrMWL);
      expect(tFajrMWL).toBeLessThan(tFajrNA);

      // Verify mathematical proportionality:
      // (tFajrNA - tFajrMWL) corresponds to (0.30 - 0.25) = 0.05 of night
      // (tFajrMWL - tFajrEgy) corresponds to (0.325 - 0.30) = 0.025 of night
      // Ratio should be exactly 2.0
      const diff1 = tFajrNA - tFajrMWL;
      const diff2 = tFajrMWL - tFajrEgy;
      expect(diff1 / diff2).toBeCloseTo(2.0, 1);
    });

    it('verifies that in London, 15 deg twilight physically crosses while 18 deg requires high-latitude adjustment (A10 integrity)', () => {
      const date = new Date('2026-06-21T12:00:00Z');
      const lat = 51.5074; // London: nadir is ~ -15.05 deg
      const lon = -0.1278;

      const schedNA = calculatePrayerTimes(lat, lon, date, {
        convention: 'NorthAmerica', // 15.0 deg
        highLatitudeRule: 'AngleBased',
      });
      const schedMWL = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague', // 18.0 deg
        highLatitudeRule: 'AngleBased',
      });

      // North America has genuine astronomical crossing at -15 deg
      expect(schedNA.fajr.provenance).toBe('astronomicalSign');
      expect(schedNA.fajr.ruleApplied).toBeUndefined();

      // MWL does not reach -18 deg, so it gets highLatitudeAdjustment
      expect(schedMWL.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(schedMWL.fajr.ruleApplied).toBe('AngleBased');
    });
  });

  // ==========================================================================
  // Challenge Domain 3: Asr Noon Shadow Validation & Madhab Comparison
  // ==========================================================================
  describe('C03.3: Asr Noon Shadow Validation & Madhab Comparison', () => {
    it('enforces Hanafi Asr strictly later than Shafi Asr across 10 global cities and 4 seasons', () => {
      const cities = [
        { name: 'Makkah', lat: 21.4225, lon: 39.8262 },
        { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
        { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
        { name: 'London', lat: 51.5074, lon: -0.1278 },
        { name: 'New York', lat: 40.7128, lon: -74.0060 },
        { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
        { name: 'Reykjavik', lat: 64.1466, lon: -21.9426 },
        { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
        { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
      ];

      const dates = [
        new Date('2026-03-20T12:00:00Z'), // Equinox
        new Date('2026-06-21T12:00:00Z'), // Solstice
        new Date('2026-09-22T12:00:00Z'), // Equinox
        new Date('2026-12-21T12:00:00Z'), // Solstice
      ];

      for (const city of cities) {
        for (const date of dates) {
          const shafi = calculatePrayerTimes(city.lat, city.lon, date, { madhab: 'Shafi' });
          const hanafi = calculatePrayerTimes(city.lat, city.lon, date, { madhab: 'Hanafi' });

          if (shafi.asr.date !== null) {
            expect(hanafi.asr.date).not.toBeNull();
            const tShafi = shafi.asr.date.getTime();
            const tHanafi = hanafi.asr.date!.getTime();

            // Hanafi Asr must occur strictly after Shafi Asr
            expect(tHanafi).toBeGreaterThan(tShafi);
            const diffMin = (tHanafi - tShafi) / 60000;
            // Strict positive gap across all seasons and latitudes (minimum 8 min in sub-arctic winter, > 30 min in tropics)
            expect(diffMin).toBeGreaterThan(5);

            if (Math.abs(city.lat) < 45) {
              expect(diffMin).toBeGreaterThan(25);
            }
          } else {
            // If Shafi is unresolved due to absence of noon shadow, Hanafi MUST also be unresolved
            expect(hanafi.asr.date).toBeNull();
          }
        }
      }
    });

    it('returns unresolved for non-positive noon shadow without falling back to Dhuhr + 2 hours', () => {
      // High arctic winter locations where noon solar altitude <= 0:
      const polarNightCases = [
        { name: 'Tromso Winter', lat: 69.6492, lon: 18.9553, date: new Date('2026-12-21T12:00:00Z') },
        { name: 'Longyearbyen Winter', lat: 78.2232, lon: 15.6267, date: new Date('2026-12-21T12:00:00Z') },
        { name: 'North Pole Winter', lat: 89.0, lon: 0.0, date: new Date('2026-12-21T12:00:00Z') },
        { name: 'McMurdo Antarctic Winter', lat: -77.8419, lon: 166.6863, date: new Date('2026-06-21T12:00:00Z') },
      ];

      for (const p of polarNightCases) {
        const sched = calculatePrayerTimes(p.lat, p.lon, p.date);

        // Asr must be unresolved
        expect(sched.asr.date).toBeNull();
        expect(sched.asr.provenance).toBe('unresolved');
        expect(sched.asr.note).toContain('No physical noon shadow');

        // Check helper directly
        const decl = getSolarDeclination(p.date);
        const noonShadow = calculateNoonShadowRatio(p.lat, decl);
        expect(noonShadow).toBeNull();

        const asrAlt = calculateAsrAltitude(p.lat, decl, 1);
        expect(asrAlt).toBeNull();

        // Verify no fallback: sched.asr.date must NEVER be Dhuhr + 2 hours
        if (sched.dhuhr.date !== null) {
          const fakeFallbackMs = sched.dhuhr.date.getTime() + 2 * 3600000;
          expect(sched.asr.date).toBeNull(); // it is null, definitely not fakeFallbackMs
        }
      }
    });

    it('verifies calculateNoonShadowRatio boundary at noon altitude = 0 deg', () => {
      // When zenith distance = 90 deg (altitude = 0 deg):
      // latitude - declination = 90
      expect(calculateNoonShadowRatio(70, -20)).toBeNull(); // altitude = 0 deg
      expect(calculateNoonShadowRatio(71, -20)).toBeNull(); // altitude = -1 deg
      expect(calculateNoonShadowRatio(69, -20)).not.toBeNull(); // altitude = +1 deg > 0
    });
  });

  // ==========================================================================
  // Challenge Domain 4: Date Boundary Lookahead & Non-Static Ephemeris
  // ==========================================================================
  describe('C03.4: Date Boundary Lookahead & Ephemeris Drift', () => {
    it('computes next day Fajr using true ephemeris rather than static +24h across all month rollovers', () => {
      const monthBoundaries = [
        new Date('2026-01-31T23:00:00Z'), // Jan 31 -> Feb 1
        new Date('2026-02-28T23:00:00Z'), // Feb 28 -> Mar 1 (non-leap)
        new Date('2026-04-30T23:00:00Z'), // Apr 30 -> May 1
        new Date('2026-06-30T23:00:00Z'), // Jun 30 -> Jul 1
        new Date('2026-10-31T23:00:00Z'), // Oct 31 -> Nov 1
        new Date('2026-12-31T23:00:00Z'), // Dec 31 -> Jan 1 (year rollover)
      ];

      for (const lateDate of monthBoundaries) {
        // Evaluate at Makkah
        const sched = calculatePrayerTimes(21.4225, 39.8262, lateDate, {
          convention: 'UmmAlQura',
        });

        expect(sched.currentPrayer).toBe('isha');
        expect(sched.nextPrayer).toBe('fajr');
        expect(sched.nextPrayerTime).not.toBeNull();

        // Today's schedule evaluated at noon
        const todayNoon = new Date(Date.UTC(lateDate.getUTCFullYear(), lateDate.getUTCMonth(), lateDate.getUTCDate(), 12, 0, 0));
        const todaySched = calculatePrayerTimes(21.4225, 39.8262, todayNoon, {
          convention: 'UmmAlQura',
        });

        const fakeNextFajrMs = todaySched.fajr.date!.getTime() + 86400000;
        const actualNextFajrMs = sched.nextPrayerTime!.getTime();

        // Ephemeris changes daily; true next Fajr is NOT exactly today + 86400000 ms
        expect(actualNextFajrMs).not.toBe(fakeNextFajrMs);

        // But it should match the tomorrow schedule evaluated at tomorrow noon
        const tomorrowNoon = new Date(todayNoon.getTime() + 86400000);
        const tomorrowSched = calculatePrayerTimes(21.4225, 39.8262, tomorrowNoon, {
          convention: 'UmmAlQura',
        });

        expect(Math.abs(actualNextFajrMs - tomorrowSched.fajr.date!.getTime())).toBeLessThan(1000);
      }
    });

    it('handles leap year transition (2028-02-28 to 2028-02-29 and 2028-02-29 to 2028-03-01)', () => {
      const feb28Leap = new Date('2028-02-28T23:00:00Z');
      const sched1 = calculatePrayerTimes(21.4225, 39.8262, feb28Leap);
      expect(sched1.nextPrayer).toBe('fajr');
      expect(sched1.nextPrayerTime?.getUTCDate()).toBe(29); // Rolls to Feb 29

      const feb29Leap = new Date('2028-02-29T23:00:00Z');
      const sched2 = calculatePrayerTimes(21.4225, 39.8262, feb29Leap);
      expect(sched2.nextPrayer).toBe('fajr');
      expect(sched2.nextPrayerTime?.getUTCDate()).toBe(1); // Rolls to Mar 1
      expect(sched2.nextPrayerTime?.getUTCMonth()).toBe(2); // March
    });
  });

  // ==========================================================================
  // Challenge Domain 5: Edge Input Fuzzing & Boundary Invariants
  // ==========================================================================
  describe('C03.5: Edge Inputs & Boundary Invariants', () => {
    it('returns typed unresolved entries without throwing on extreme or NaN inputs', () => {
      const badInputs = [
        { lat: NaN, lon: 0 },
        { lat: 0, lon: NaN },
        { lat: Infinity, lon: 0 },
        { lat: 90.0001, lon: 0 },
        { lat: -90.0001, lon: 0 },
        { lat: 0, lon: Infinity },
      ];

      for (const inp of badInputs) {
        const res = calculatePrayerTimes(inp.lat, inp.lon, new Date('2026-06-21T12:00:00Z'));
        expect(res.fajr.date).toBeNull();
        expect(res.fajr.provenance).toBe('unresolved');
        expect(res.sunrise.date).toBeNull();
        expect(res.dhuhr.date).toBeNull();
        expect(res.asr.date).toBeNull();
        expect(res.maghrib.date).toBeNull();
        expect(res.isha.date).toBeNull();
        expect(res.currentPrayer).toBe('none');
        expect(res.nextPrayer).toBe('none');
      }
    });

    it('verifies exact latitude extremes +/- 90 degrees do not throw', () => {
      const northPole = calculatePrayerTimes(90, 0, new Date('2026-06-21T12:00:00Z'));
      expect(northPole).toBeDefined();

      const southPole = calculatePrayerTimes(-90, 0, new Date('2026-06-21T12:00:00Z'));
      expect(southPole).toBeDefined();
    });
  });

  // ==========================================================================
  // Challenge Domain 6: Midnight Sun Policy Disambiguation (Tromso Summer)
  // ==========================================================================
  describe('C03.6: Tromso Summer Solstice Midnight Sun Disambiguation', () => {
    const tromsoLat = 69.6492;
    const tromsoLon = 18.9553;
    const solstice = new Date('2026-06-21T12:00:00Z');

    it('returns typed unresolved when no high-latitude policy is provided', () => {
      const sched = calculatePrayerTimes(tromsoLat, tromsoLon, solstice, {
        convention: 'MuslimWorldLeague',
      });

      expect(sched.sunrise.date).toBeNull();
      expect(sched.sunset.date).toBeNull();
      expect(sched.maghrib.date).toBeNull();
      expect(sched.fajr.date).toBeNull();
      expect(sched.isha.date).toBeNull();

      expect(sched.fajr.provenance).toBe('unresolved');
      expect(sched.maghrib.provenance).toBe('unresolved');
      expect(sched.isha.provenance).toBe('unresolved');

      // But Dhuhr and Asr are astronomical signs because noon altitude is positive
      expect(sched.dhuhr.date).not.toBeNull();
      expect(sched.dhuhr.provenance).toBe('astronomicalSign');
      expect(sched.asr.date).not.toBeNull();
      expect(sched.asr.provenance).toBe('astronomicalSign');
    });

    it('evaluates virtual night when explicit high-latitude policy is passed', () => {
      const angleSched = calculatePrayerTimes(tromsoLat, tromsoLon, solstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const middleSched = calculatePrayerTimes(tromsoLat, tromsoLon, solstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const seventhSched = calculatePrayerTimes(tromsoLat, tromsoLon, solstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });

      expect(angleSched.fajr.date).not.toBeNull();
      expect(angleSched.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(angleSched.fajr.ruleApplied).toBe('AngleBased');

      expect(middleSched.fajr.date).not.toBeNull();
      expect(middleSched.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(middleSched.fajr.ruleApplied).toBe('MiddleOfTheNight');

      expect(seventhSched.fajr.date).not.toBeNull();
      expect(seventhSched.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(seventhSched.fajr.ruleApplied).toBe('SeventhOfTheNight');

      const tAngle = angleSched.fajr.date!.getTime();
      const tMiddle = middleSched.fajr.date!.getTime();
      const tSeventh = seventhSched.fajr.date!.getTime();

      // Distinct times across rules in midnight sun
      expect(tAngle).not.toBe(tMiddle);
      expect(tAngle).not.toBe(tSeventh);
      expect(tMiddle).toBeLessThan(tAngle);
      expect(tAngle).toBeLessThan(tSeventh);
    });
  });

  // ==========================================================================
  // Challenge Domain 7: Southern Hemisphere High Latitude & Antimeridian
  // ==========================================================================
  describe('C03.7: Southern Hemisphere High Latitude & Antimeridian Coordinates', () => {
    it('evaluates Ushuaia (-54.80 S) in Southern summer solstice (December 21)', () => {
      const decSolstice = new Date('2026-12-21T12:00:00Z');
      const angle = calculatePrayerTimes(-54.8019, -68.3030, decSolstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const middle = calculatePrayerTimes(-54.8019, -68.3030, decSolstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const seventh = calculatePrayerTimes(-54.8019, -68.3030, decSolstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });

      // Twilight absence at -54.8 S in December
      expect(angle.fajr.provenance).toBe('highLatitudeAdjustment');
      expect(angle.fajr.date).not.toBeNull();
      expect(middle.fajr.date).not.toBeNull();
      expect(seventh.fajr.date).not.toBeNull();

      expect(angle.fajr.date!.getTime()).not.toBe(middle.fajr.date!.getTime());
      expect(middle.fajr.date!.getTime()).toBeLessThan(angle.fajr.date!.getTime());
      expect(angle.fajr.date!.getTime()).toBeLessThan(seventh.fajr.date!.getTime());
    });

    it('evaluates antimeridian locations without NaN or sign flip glitches', () => {
      const antimeridianCities = [
        { name: 'Suva, Fiji', lat: -18.1416, lon: 178.4419 },
        { name: 'Apia, Samoa', lat: -13.8333, lon: -171.7500 },
        { name: 'Kamchatka', lat: 53.0452, lon: 158.6510 },
      ];

      const testDate = new Date('2026-06-21T12:00:00Z');
      for (const city of antimeridianCities) {
        const sched = calculatePrayerTimes(city.lat, city.lon, testDate);
        expect(sched.fajr.date).not.toBeNull();
        expect(sched.sunrise.date).not.toBeNull();
        expect(sched.dhuhr.date).not.toBeNull();
        expect(sched.asr.date).not.toBeNull();
        expect(sched.maghrib.date).not.toBeNull();
        expect(sched.isha.date).not.toBeNull();

        const tFajr = sched.fajr.date!.getTime();
        const tSunrise = sched.sunrise.date!.getTime();
        const tDhuhr = sched.dhuhr.date!.getTime();
        const tAsr = sched.asr.date!.getTime();
        const tMaghrib = sched.maghrib.date!.getTime();
        const tIsha = sched.isha.date!.getTime();

        expect(tFajr).toBeLessThan(tSunrise);
        expect(tSunrise).toBeLessThan(tDhuhr);
        expect(tDhuhr).toBeLessThan(tAsr);
        expect(tAsr).toBeLessThan(tMaghrib);
        expect(tMaghrib).toBeLessThan(tIsha);
      }
    });
  });
});
