import { describe, it, expect } from 'vitest';
import { calculatePrayerTimes, PrayerEntry } from '../src/prayer/calculator';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  HighLatitudeRule,
} from '../src/prayer/conventions';

describe('Empirical Challenger: M1 It2 Stress Testing Harness', () => {
  const highLatCities = [
    { name: 'Tromso', lat: 69.6492, lon: 18.9553 },
    { name: 'Hammerfest', lat: 70.6634, lon: 23.6821 },
    { name: 'Longyearbyen', lat: 78.2232, lon: 15.6267 },
    { name: 'Murmansk', lat: 68.9585, lon: 33.0827 },
    { name: 'Reykjavik', lat: 64.1466, lon: -21.9426 },
    { name: 'Fairbanks', lat: 64.8378, lon: -147.7164 },
    { name: 'Nuuk', lat: 64.1814, lon: -51.6941 },
    { name: 'Bodo', lat: 67.2804, lon: 14.4049 },
    { name: 'Oulu', lat: 65.0121, lon: 25.4651 },
    { name: 'Rovaniemi', lat: 66.5039, lon: 25.7294 },
    { name: 'Ushuaia', lat: -54.8019, lon: -68.303 },
  ];

  const rules: HighLatitudeRule[] = [
    'MiddleOfTheNight',
    'SeventhOfTheNight',
    'AngleBased',
  ];

  const allConventions = Object.keys(
    CALCULATION_CONVENTIONS,
  ) as CalculationConventionName[];

  // =========================================================================
  // 1. Stress Test: High-latitude Isha ordering when Maghrib is present
  // =========================================================================
  describe('Invariant 1: High-latitude Isha is strictly after Maghrib (ishaMs > maghribMs)', () => {
    it('verifies ishaMs > maghribMs across all summer dates and conventions where Maghrib is present', () => {
      // Test dates spanning the summer transition period (late July to August)
      // in Tromso, Hammerfest, Bodo, etc.
      const transitionDates: Date[] = [];
      for (let day = 15; day <= 31; day++) {
        transitionDates.push(
          new Date(`2026-07-${String(day).padStart(2, '0')}T12:00:00Z`),
        );
      }
      for (let day = 1; day <= 15; day++) {
        transitionDates.push(
          new Date(`2026-08-${String(day).padStart(2, '0')}T12:00:00Z`),
        );
      }

      let evaluatedCount = 0;

      for (const city of highLatCities) {
        for (const date of transitionDates) {
          for (const rule of rules) {
            for (const conv of allConventions) {
              const sched = calculatePrayerTimes(city.lat, city.lon, date, {
                convention: conv,
                highLatitudeRule: rule,
              });

              if (sched.maghrib.date !== null && sched.isha.date !== null) {
                evaluatedCount++;
                const maghribMs = sched.maghrib.date.getTime();
                const ishaMs = sched.isha.date.getTime();

                // Non-inversion invariant: Isha must be strictly greater than Maghrib
                expect(ishaMs).toBeGreaterThan(maghribMs);

                // Gap must be strictly positive (e.g. 7.3 min for 51 min night in SeventhOfTheNight)
                const gapMinutes = (ishaMs - maghribMs) / 60000;
                expect(gapMinutes).toBeGreaterThan(5);
              }
            }
          }
        }
      }

      expect(evaluatedCount).toBeGreaterThan(500);
    });

    it('specifically verifies Tromso on July 25, 2026 (exact witness case for midnight sun end)', () => {
      const testDate = new Date('2026-07-25T12:00:00Z');
      const lat = 69.6492;
      const lon = 18.9553;

      for (const rule of rules) {
        const sched = calculatePrayerTimes(lat, lon, testDate, {
          convention: 'MuslimWorldLeague',
          highLatitudeRule: rule,
        });

        expect(sched.maghrib.date).not.toBeNull();
        expect(sched.maghrib.provenance).toBe('astronomicalSign');
        expect(sched.isha.date).not.toBeNull();
        expect(sched.isha.provenance).toBe('highLatitudeAdjustment');

        const maghribMs = sched.maghrib.date!.getTime();
        const ishaMs = sched.isha.date!.getTime();

        expect(ishaMs).toBeGreaterThan(maghribMs);

        // For MWL (ishaAngle = 17):
        // SeventhOfTheNight: virtualNight (8h) * 1/7 = 1.1428h (68.5 min)
        // AngleBased: virtualNight (8h) * 17/60 = 2.2667h (136 min)
        // MiddleOfTheNight: virtualNight (8h) * 1/2 = 4h (240 min)
        const gapMinutes = (ishaMs - maghribMs) / 60000;
        if (rule === 'SeventhOfTheNight') {
          expect(gapMinutes).toBeCloseTo((8 * 60) / 7, 1);
        } else if (rule === 'AngleBased') {
          expect(gapMinutes).toBeCloseTo(8 * 17, 1);
        } else if (rule === 'MiddleOfTheNight') {
          expect(gapMinutes).toBeCloseTo(4 * 60, 1);
        }
      }
    });
  });

  // =========================================================================
  // 2. Stress Test: determineCurrentPrayer when now is after Maghrib & Isha is null
  // =========================================================================
  describe('Invariant 2: determineCurrentPrayer = maghrib when now > Maghrib and Isha is null', () => {
    it('accurately identifies currentPrayer as maghrib across multiple post-sunset intervals', () => {
      // In Tromso on July 25, 2026 without highLatitudeRule:
      // Sunset is ~22:37:35 UTC. Isha is null because twilight is absent.
      const baseDateNoon = new Date('2026-07-25T12:00:00Z');
      const noonSched = calculatePrayerTimes(69.6492, 18.9553, baseDateNoon, {
        convention: 'MuslimWorldLeague',
      });

      expect(noonSched.maghrib.date).not.toBeNull();
      expect(noonSched.isha.date).toBeNull();
      const sunsetMs = noonSched.maghrib.date!.getTime();

      // Test multiple time points after Maghrib:
      // +10 seconds, +5 minutes, +30 minutes, +1 hour, +1 hour 20 minutes (before UTC midnight)
      const postOffsetsMs = [
        10 * 1000,
        5 * 60 * 1000,
        30 * 60 * 1000,
        60 * 60 * 1000,
        80 * 60 * 1000,
      ];

      // 1. Immediately after sunset before tomorrow's Fajr (22:37:45 UTC vs tomorrow Fajr 22:39:03 UTC):
      const timeBeforeNextFajr = new Date(sunsetMs + 10 * 1000); // 22:37:45 UTC
      const sched1 = calculatePrayerTimes(69.6492, 18.9553, timeBeforeNextFajr, {
        convention: 'MuslimWorldLeague',
      });
      expect(sched1.maghrib.date).not.toBeNull();
      expect(sched1.isha.date).toBeNull();
      expect(sched1.currentPrayer).toBe('maghrib');
      expect(sched1.nextPrayer).toBe('fajr');
      expect(sched1.nextPrayerTime).not.toBeNull();
      expect(sched1.nextPrayerTime!.getTime()).toBeGreaterThan(timeBeforeNextFajr.getTime());
      expect(sched1.countdownMs).toBeGreaterThan(0);

      // 2. Later post-sunset times (22:42, 22:45, 23:00 UTC) where tomorrow's Fajr (22:39 UTC) has elapsed:
      // Verifies that determineCurrentPrayer remains 'maghrib'
      const laterTimes = [
        new Date(sunsetMs + 5 * 60 * 1000), // 22:42:35 UTC
        new Date(sunsetMs + 15 * 60 * 1000), // 22:52:35 UTC
        new Date(sunsetMs + 30 * 60 * 1000), // 23:07:35 UTC
      ];

      for (const t of laterTimes) {
        const sched = calculatePrayerTimes(69.6492, 18.9553, t, {
          convention: 'MuslimWorldLeague',
        });
        expect(sched.maghrib.date).not.toBeNull();
        expect(sched.isha.date).toBeNull();
        expect(sched.currentPrayer).toBe('maghrib');
      }
    });

    it('verifies behavior when both Maghrib and Isha are null (polar night or summer midnight sun without rule)', () => {
      // Midnight sun: Tromso on June 21 without rule
      const solsticeNoon = new Date('2026-06-21T12:00:00Z');
      const schedNoon = calculatePrayerTimes(69.6492, 18.9553, solsticeNoon, {
        convention: 'MuslimWorldLeague',
      });

      expect(schedNoon.maghrib.date).toBeNull();
      expect(schedNoon.isha.date).toBeNull();

      // At 23:00 UTC (after daytime Asr)
      const lateTime = new Date('2026-06-21T23:00:00Z');
      const lateSched = calculatePrayerTimes(69.6492, 18.9553, lateTime, {
        convention: 'MuslimWorldLeague',
      });

      // Both maghrib and isha are null, so fallback is 'none'
      expect(lateSched.currentPrayer).toBe('none');
    });
  });

  // =========================================================================
  // 3. Stress Test: Multi-day lookahead and tomorrow ephemeris computation
  // =========================================================================
  describe('Invariant 3: Multi-day lookahead computes true next-day ephemeris', () => {
    it('resolves tomorrow schedule correctly across 12 consecutive months at high latitudes', () => {
      // Mid-month dates across all 12 months in Oslo (lat 59.9139)
      for (let m = 0; m < 12; m++) {
        const dateStr = `2026-${String(m + 1).padStart(2, '0')}-15T23:30:00Z`;
        const testDate = new Date(dateStr);

        const sched = calculatePrayerTimes(59.9139, 10.7522, testDate, {
          convention: 'MuslimWorldLeague',
          highLatitudeRule: 'AngleBased',
        });

        // At 23:30, after today's Isha, next prayer must be Fajr
        expect(sched.currentPrayer).toBe('isha');
        expect(sched.nextPrayer).toBe('fajr');
        expect(sched.nextPrayerTime).not.toBeNull();

        const actualNextFajrMs = sched.nextPrayerTime!.getTime();
        expect(actualNextFajrMs).toBeGreaterThan(testDate.getTime());

        // Compare against tomorrow's standalone calculation
        const tomorrowNoon = new Date(
          Date.UTC(2026, m, 16, 12, 0, 0),
        );
        const tomorrowSched = calculatePrayerTimes(59.9139, 10.7522, tomorrowNoon, {
          convention: 'MuslimWorldLeague',
          highLatitudeRule: 'AngleBased',
        });

        expect(tomorrowSched.fajr.date).not.toBeNull();
        expect(
          Math.abs(actualNextFajrMs - tomorrowSched.fajr.date!.getTime()),
        ).toBeLessThan(1000);

        // Invariance against naive +24h addition
        const todayNoon = new Date(Date.UTC(2026, m, 15, 12, 0, 0));
        const todaySched = calculatePrayerTimes(59.9139, 10.7522, todayNoon, {
          convention: 'MuslimWorldLeague',
          highLatitudeRule: 'AngleBased',
        });
        const naiveFajrMs = todaySched.fajr.date!.getTime() + 86400000;
        expect(actualNextFajrMs).not.toBe(naiveFajrMs);
      }
    });

    it('examines candidate lookahead behavior when tomorrow Fajr occurs before current time', () => {
      // Tromso summer transition: July 25 at 22:45 UTC
      // Sunset was at 22:37 UTC.
      // Lookahead computes July 26 schedule:
      // July 26 has sunrise at 23:04 UTC, and calculated Fajr at 22:39 UTC.
      const testDate = new Date('2026-07-25T22:45:00Z');
      const sched = calculatePrayerTimes(69.6492, 18.9553, testDate, {
        convention: 'MuslimWorldLeague',
      });

      // The current prayer is correctly identified as maghrib
      expect(sched.currentPrayer).toBe('maghrib');

      // Tomorrow schedule computed by lookahead contains Fajr at 22:39 UTC
      const tomorrowDate = new Date(Date.UTC(2026, 6, 26, 12, 0, 0));
      const tomSched = calculatePrayerTimes(69.6492, 18.9553, tomorrowDate, {
        convention: 'MuslimWorldLeague',
      });
      expect(tomSched.fajr.date).not.toBeNull();
      expect(tomSched.fajr.date!.toISOString()).toBe('2026-07-25T22:39:03.866Z');

      // Note: Because lookahead assigns tomorrowSchedule.fajr without checking > nowMs,
      // nextPrayerTime is set to tomorrowSchedule.fajr (which is 22:39 UTC, in the past relative to 22:45 UTC).
      // countdownMs is clamped to 0.
      expect(sched.nextPrayer).toBe('fajr');
      expect(sched.nextPrayerTime?.toISOString()).toBe('2026-07-25T22:39:03.866Z');
      expect(sched.countdownMs).toBe(0);
    });
  });

  // =========================================================================
  // 4. Stress Test: AngleBased fractional night calculations
  // =========================================================================
  describe('Invariant 4: AngleBased fractional night scaling and proportionality', () => {
    it('scales fraction strictly linearly with twilight angle across all conventions in polar twilight absence', () => {
      // Use Oslo on summer solstice where twilight (-15° to -20°) never reaches nadir (~ -6.66°)
      const solstice = new Date('2026-06-21T12:00:00Z');
      const lat = 59.9139;
      const lon = 10.7522;

      // Conventions with distinct twilight angles:
      // NorthAmerica: fajr 15.0°, isha 15.0°
      // MWL: fajr 18.0°, isha 17.0°
      // Kuwait: fajr 18.0°, isha 17.5°
      // Egyptian: fajr 19.5°, isha 17.5°
      // Singapore: fajr 20.0°, isha 18.0°

      const schedNA = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'NorthAmerica',
        highLatitudeRule: 'AngleBased',
      });
      const schedMWL = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const schedKuwait = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'Kuwait',
        highLatitudeRule: 'AngleBased',
      });
      const schedEgy = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'Egyptian',
        highLatitudeRule: 'AngleBased',
      });
      const schedSing = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'Singapore',
        highLatitudeRule: 'AngleBased',
      });

      const tFajrNA = schedNA.fajr.date!.getTime();
      const tFajrMWL = schedMWL.fajr.date!.getTime();
      const tFajrKuwait = schedKuwait.fajr.date!.getTime();
      const tFajrEgy = schedEgy.fajr.date!.getTime();
      const tFajrSing = schedSing.fajr.date!.getTime();

      // Check Fajr monotonicity: larger angle -> earlier Fajr
      expect(tFajrNA).toBeGreaterThan(tFajrMWL);
      expect(tFajrMWL).toBe(tFajrKuwait); // Both 18.0°
      expect(tFajrMWL).toBeGreaterThan(tFajrEgy);
      expect(tFajrEgy).toBeGreaterThan(tFajrSing);

      // Check Isha monotonicity: larger angle -> later Isha
      const tIshaNA = schedNA.isha.date!.getTime();
      const tIshaMWL = schedMWL.isha.date!.getTime();
      const tIshaKuwait = schedKuwait.isha.date!.getTime();
      const tIshaEgy = schedEgy.isha.date!.getTime();
      const tIshaSing = schedSing.isha.date!.getTime();

      expect(tIshaNA).toBeLessThan(tIshaMWL); // 15.0 < 17.0
      expect(tIshaMWL).toBeLessThan(tIshaKuwait); // 17.0 < 17.5
      expect(tIshaKuwait).toBe(tIshaEgy); // Both 17.5
      expect(tIshaEgy).toBeLessThan(tIshaSing); // 17.5 < 18.0

      // Proportionality check:
      // (tFajrMWL - tFajrEgy) / (tFajrNA - tFajrMWL) should equal (19.5 - 18) / (18 - 15) = 1.5 / 3.0 = 0.5
      const span1 = tFajrMWL - tFajrEgy;
      const span2 = tFajrNA - tFajrMWL;
      expect(span1 / span2).toBeCloseTo(0.5, 2);
    });

    it('respects fixed interval override for Umm Al-Qura and Qatar even when AngleBased rule is passed', () => {
      const solstice = new Date('2026-06-21T12:00:00Z');
      const lat = 59.9139; // Oslo
      const lon = 10.7522;

      const schedUQ = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'UmmAlQura',
        highLatitudeRule: 'AngleBased',
      });
      const schedQatar = calculatePrayerTimes(lat, lon, solstice, {
        convention: 'Qatar',
        highLatitudeRule: 'AngleBased',
      });

      expect(schedUQ.isha.provenance).toBe('fixedInterval');
      expect(schedQatar.isha.provenance).toBe('fixedInterval');

      // In Umm Al-Qura and Qatar, Isha is exactly 90 minutes after Maghrib
      const diffUQ = (schedUQ.isha.date!.getTime() - schedUQ.maghrib.date!.getTime()) / 60000;
      const diffQatar = (schedQatar.isha.date!.getTime() - schedQatar.maghrib.date!.getTime()) / 60000;

      expect(diffUQ).toBeCloseTo(90, 1);
      expect(diffQatar).toBeCloseTo(90, 1);
    });
  });
});
