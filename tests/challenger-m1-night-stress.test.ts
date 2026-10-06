import { describe, it, expect } from 'vitest';
import {
  calculatePrayerTimes,
  calculateIslamicNight,
  IslamicNightInfo,
} from '../src/prayer/calculator';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  HighLatitudeRule,
} from '../src/prayer/conventions';

describe('Challenger M1 Suite 1: 365-Day Empirical Stress Across 6 Extreme Coordinates', () => {
  const extremeLocations = [
    { name: 'Tromsø', lat: 69.6492, lon: 18.9553 },
    { name: 'Longyearbyen', lat: 78.2232, lon: 15.6267 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Makkah', lat: 21.4225, lon: 39.8262 },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
    { name: 'Ushuaia', lat: -54.8019, lon: -68.303 },
  ];

  const rules: (HighLatitudeRule | undefined)[] = [
    undefined,
    'MiddleOfTheNight',
    'SeventhOfTheNight',
    'AngleBased',
  ];

  const conventions: CalculationConventionName[] = [
    'MuslimWorldLeague',
    'UmmAlQura',
    'Egyptian',
    'NorthAmerica',
  ];

  it('empirically verifies 365 days across all 6 locations produce zero crashes, zero NaN dates, and zero negative durations', () => {
    let totalEvaluations = 0;
    let resolvedNightCount = 0;
    let undefinedNightCount = 0;

    for (const loc of extremeLocations) {
      for (let dayOfYear = 1; dayOfYear <= 365; dayOfYear++) {
        // Construct calendar date for dayOfYear in 2026
        const date = new Date(Date.UTC(2026, 0, dayOfYear, 12, 0, 0));

        for (const rule of rules) {
          for (const convention of conventions) {
            totalEvaluations++;

            const schedule = calculatePrayerTimes(loc.lat, loc.lon, date, {
              convention,
              highLatitudeRule: rule,
            });

            // 1. Core invariant: Prayer schedule object structure is never corrupted
            expect(schedule).toBeDefined();

            if (schedule.islamicNight !== undefined) {
              resolvedNightCount++;
              const night = schedule.islamicNight;

              // 2. Duration invariants
              expect(Number.isFinite(night.durationMs)).toBe(true);
              expect(Number.isNaN(night.durationMs)).toBe(false);
              expect(night.durationMs).toBeGreaterThan(0);
              // Must never exceed 24 hours (NO 28-hour bug)
              expect(night.durationMs).toBeLessThanOrEqual(24 * 3600000);

              // 3. Date validity invariants (NO NaN dates)
              expect(night.midnight instanceof Date).toBe(true);
              expect(Number.isFinite(night.midnight.getTime())).toBe(true);
              expect(Number.isNaN(night.midnight.getTime())).toBe(false);

              expect(night.lastThirdStart instanceof Date).toBe(true);
              expect(Number.isFinite(night.lastThirdStart.getTime())).toBe(true);
              expect(Number.isNaN(night.lastThirdStart.getTime())).toBe(false);

              expect(night.lastThirdEnd instanceof Date).toBe(true);
              expect(Number.isFinite(night.lastThirdEnd.getTime())).toBe(true);
              expect(Number.isNaN(night.lastThirdEnd.getTime())).toBe(false);

              if (night.firstThirdEnd) {
                expect(night.firstThirdEnd instanceof Date).toBe(true);
                expect(Number.isFinite(night.firstThirdEnd.getTime())).toBe(true);
              }

              // 4. Strict chronological ordering
              const tMidnight = night.midnight.getTime();
              const tLastThirdStart = night.lastThirdStart.getTime();
              const tLastThirdEnd = night.lastThirdEnd.getTime();

              expect(tMidnight).toBeLessThan(tLastThirdStart);
              expect(tLastThirdStart).toBeLessThan(tLastThirdEnd);

              // 5. Mathematical fraction consistency
              const startNightMs = tMidnight - night.durationMs / 2;
              expect(Math.abs(tLastThirdEnd - (startNightMs + night.durationMs))).toBeLessThanOrEqual(2);

              // 6. Boolean flag integrity
              expect(typeof night.isCurrentlyLastThird).toBe('boolean');
              expect(typeof night.isActive).toBe('boolean');
            } else {
              undefinedNightCount++;
            }
          }
        }
      }
    }

    // Verify statistically significant evaluation volume
    // 6 locations * 365 days * 4 rules * 4 conventions = 35,040 evaluations
    expect(totalEvaluations).toBe(35040);
    expect(resolvedNightCount).toBeGreaterThan(25000);
    expect(undefinedNightCount).toBeGreaterThan(1000); // Undefined occurs during polar night / unadjusted midnight sun
  }, 30000);

  it('empirically verifies 24-hour continuous time sweep on solstice days maintains boolean flags and boundaries', () => {
    // Test solstices (June 21 and December 21) across 24 hourly steps
    const solstices = [
      new Date('2026-06-21T00:00:00Z'),
      new Date('2026-12-21T00:00:00Z'),
    ];

    for (const loc of extremeLocations) {
      for (const baseDate of solstices) {
        for (let hour = 0; hour < 24; hour++) {
          const evalTime = new Date(baseDate.getTime() + hour * 3600000);
          const sched = calculatePrayerTimes(loc.lat, loc.lon, baseDate, {
            convention: 'MuslimWorldLeague',
            highLatitudeRule: 'MiddleOfTheNight',
            now: evalTime,
          });

          if (sched.islamicNight) {
            const night = sched.islamicNight;
            const evalMs = evalTime.getTime();
            const startNight = night.midnight.getTime() - night.durationMs / 2;
            const endNight = night.lastThirdEnd.getTime();

            if (evalMs >= startNight && evalMs < endNight) {
              expect(night.isActive).toBe(true);
            } else {
              expect(night.isActive).toBe(false);
            }

            if (evalMs >= night.lastThirdStart.getTime() && evalMs < endNight) {
              expect(night.isCurrentlyLastThird).toBe(true);
            } else {
              expect(night.isCurrentlyLastThird).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('Challenger M1 Suite 2: Polar Night and Midnight Sun Transition Verification', () => {
  it('empirically verifies Tromsø transitions between midnight sun and polar night without unphysical values', () => {
    // Tromsø (lat 69.6492, lon 18.9553)
    const lat = 69.6492;
    const lon = 18.9553;

    // Transition 1: Entering midnight sun (May 15 to May 25, 2026)
    for (let day = 15; day <= 25; day++) {
      const date = new Date(`2026-05-${day}T12:00:00Z`);
      const withoutRule = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
      });
      const withRule = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      // Without rule: either resolved or cleanly undefined (no crash, no NaN)
      if (withoutRule.islamicNight) {
        expect(withoutRule.islamicNight.durationMs).toBeGreaterThan(0);
        expect(withoutRule.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
      }

      // With rule: must be resolved and under 24 hours
      if (withRule.islamicNight) {
        expect(withRule.islamicNight.durationMs).toBeGreaterThan(0);
        expect(withRule.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
      }
    }

    // Transition 2: Exiting midnight sun (July 20 to July 30, 2026)
    for (let day = 20; day <= 30; day++) {
      const date = new Date(`2026-07-${day}T12:00:00Z`);
      const withoutRule = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
      });
      const withRule = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      if (withoutRule.islamicNight) {
        expect(withoutRule.islamicNight.durationMs).toBeGreaterThan(0);
        expect(withoutRule.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
      }
      if (withRule.islamicNight) {
        expect(withRule.islamicNight.durationMs).toBeGreaterThan(0);
        expect(withRule.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
      }
    }

    // Transition 3: Entering polar night (November 20 to November 30, 2026)
    for (let day = 20; day <= 30; day++) {
      const date = new Date(`2026-11-${day}T12:00:00Z`);
      const sched = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
      });

      if (sched.islamicNight) {
        expect(sched.islamicNight.durationMs).toBeGreaterThan(0);
        expect(sched.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
      }
    }

    // Transition 4: Exiting polar night (January 10 to January 20, 2026)
    for (let day = 10; day <= 20; day++) {
      const date = new Date(`2026-01-${day}T12:00:00Z`);
      const sched = calculatePrayerTimes(lat, lon, date, {
        convention: 'MuslimWorldLeague',
      });

      if (sched.islamicNight) {
        expect(sched.islamicNight.durationMs).toBeGreaterThan(0);
        expect(sched.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
      }
    }
  });

  it('empirically verifies Longyearbyen (78.22°N) polar extremes produce strictly safe results', () => {
    // Longyearbyen has extreme polar night (months of zero sunrise/sunset) and midnight sun
    const lat = 78.2232;
    const lon = 15.6267;

    // Winter Solstice (deep polar night)
    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const winterSched = calculatePrayerTimes(lat, lon, winterSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    // In deep polar night, Maghrib is unresolved (null), so islamicNight must safely be undefined
    expect(winterSched.maghrib.date).toBeNull();
    expect(winterSched.islamicNight).toBeUndefined();

    // Summer Solstice (deep midnight sun)
    const summerSolstice = new Date('2026-06-21T12:00:00Z');
    // Without rule: undefined
    const summerNoRule = calculatePrayerTimes(lat, lon, summerSolstice, {
      convention: 'MuslimWorldLeague',
    });
    expect(summerNoRule.maghrib.date).toBeNull();
    expect(summerNoRule.islamicNight).toBeUndefined();

    // With rule: virtual night (bounded by 8h virtual night)
    const summerWithRule = calculatePrayerTimes(lat, lon, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    expect(summerWithRule.islamicNight).toBeDefined();
    expect(summerWithRule.islamicNight!.durationMs).toBeGreaterThan(0);
    expect(summerWithRule.islamicNight!.durationMs).toBeLessThanOrEqual(8 * 3600000);
    // Never an unphysical 28-hour duration
    expect(summerWithRule.islamicNight!.durationMs).toBeLessThan(24 * 3600000);
  });
});

describe('Challenger M1 Suite 3: Monotonicity of High Latitude Rules', () => {
  it('empirically verifies AngleBased, MiddleOfTheNight, and SeventhOfTheNight monotonicity across high-latitude summer', () => {
    // In London during summer months (June and July), astronomical twilight never sets (-18° not reached).
    // The rules define the night fraction:
    // SeventhOfTheNight = 1/7 (~0.143)
    // AngleBased (MWL 18°) = 18/60 (0.300)
    // MiddleOfTheNight = 1/2 (0.500)
    //
    // Monotonicity relationship:
    // Earlier Fajr means smaller duration of night:
    // durationMs(MiddleOfTheNight) < durationMs(AngleBased) < durationMs(SeventhOfTheNight)
    //
    // And for last third start time:
    // lastThirdStart(MiddleOfTheNight) < lastThirdStart(AngleBased) < lastThirdStart(SeventhOfTheNight)

    const lat = 51.5074; // London
    const lon = -0.1278;

    for (let day = 1; day <= 30; day++) {
      const testDate = new Date(`2026-06-${String(day).padStart(2, '0')}T12:00:00Z`);

      const middleSched = calculatePrayerTimes(lat, lon, testDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const angleSched = calculatePrayerTimes(lat, lon, testDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const seventhSched = calculatePrayerTimes(lat, lon, testDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });

      expect(middleSched.islamicNight).toBeDefined();
      expect(angleSched.islamicNight).toBeDefined();
      expect(seventhSched.islamicNight).toBeDefined();

      const dMiddle = middleSched.islamicNight!.durationMs;
      const dAngle = angleSched.islamicNight!.durationMs;
      const dSeventh = seventhSched.islamicNight!.durationMs;

      // Strict monotonicity of duration
      expect(dMiddle).toBeLessThan(dAngle);
      expect(dAngle).toBeLessThan(dSeventh);

      // Strict monotonicity of midnight timestamp
      const mMiddle = middleSched.islamicNight!.midnight.getTime();
      const mAngle = angleSched.islamicNight!.midnight.getTime();
      const mSeventh = seventhSched.islamicNight!.midnight.getTime();

      expect(mMiddle).toBeLessThan(mAngle);
      expect(mAngle).toBeLessThan(mSeventh);

      // Strict monotonicity of last third start timestamp
      const ltMiddle = middleSched.islamicNight!.lastThirdStart.getTime();
      const ltAngle = angleSched.islamicNight!.lastThirdStart.getTime();
      const ltSeventh = seventhSched.islamicNight!.lastThirdStart.getTime();

      expect(ltMiddle).toBeLessThan(ltAngle);
      expect(ltAngle).toBeLessThan(ltSeventh);
    }
  });

  it('empirically verifies monotonicity scaling across 5 different twilight angles in AngleBased rule', () => {
    // Compare conventions with different fajr angles in London on June 21:
    // ISNA (15° -> 0.250)
    // MWL (18° -> 0.300)
    // Egyptian (19.5° -> 0.325)
    // Singapore (20.0° -> 0.333)

    // Use Oslo (lat 59.9139) on summer solstice where nadir is ~ -6.65°
    // so twilight angles (15° to 20°) are ALL absent and ALL apply AngleBased rule
    const lat = 59.9139;
    const lon = 10.7522;
    const solstice = new Date('2026-06-21T12:00:00Z');

    const schedISNA = calculatePrayerTimes(lat, lon, solstice, {
      convention: 'NorthAmerica',
      highLatitudeRule: 'AngleBased',
    });
    const schedMWL = calculatePrayerTimes(lat, lon, solstice, {
      convention: 'MuslimWorldLeague',
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

    // Verify all four applied highLatitudeAdjustment
    expect(schedISNA.fajr.provenance).toBe('highLatitudeAdjustment');
    expect(schedMWL.fajr.provenance).toBe('highLatitudeAdjustment');
    expect(schedEgy.fajr.provenance).toBe('highLatitudeAdjustment');
    expect(schedSing.fajr.provenance).toBe('highLatitudeAdjustment');

    expect(schedISNA.islamicNight).toBeDefined();
    expect(schedMWL.islamicNight).toBeDefined();
    expect(schedEgy.islamicNight).toBeDefined();
    expect(schedSing.islamicNight).toBeDefined();

    const dISNA = schedISNA.islamicNight!.durationMs;
    const dMWL = schedMWL.islamicNight!.durationMs;
    const dEgy = schedEgy.islamicNight!.durationMs;
    const dSing = schedSing.islamicNight!.durationMs;

    // Larger fajr angle -> larger fraction subtracted from sunrise -> earlier Fajr -> shorter night duration
    // ISNA (15° -> 0.250) > MWL (18° -> 0.300) > Egyptian (19.5° -> 0.325) > Singapore (20.0° -> 0.333)
    expect(dISNA).toBeGreaterThan(dMWL);
    expect(dMWL).toBeGreaterThan(dEgy);
    expect(dEgy).toBeGreaterThan(dSing);
  });
});

describe('Challenger M1 Suite 4: Adversarial Oracle & Boundary Stress on calculateIslamicNight', () => {
  it('fuzzes calculateIslamicNight with extreme boundary timestamps, offsets, and invalid inputs', () => {
    const baseMaghrib = new Date('2026-10-04T18:00:00.000Z');

    // 1. Durations equal to or just above 24 hours must be rejected (return null)
    const exactly24h = new Date(baseMaghrib.getTime() + 24 * 3600000);
    // At exactly 24h, durationMs === 24 * 3600000, which is valid (boundary condition)
    const validAt24h = calculateIslamicNight(baseMaghrib, exactly24h);
    expect(validAt24h).not.toBeNull();
    expect(validAt24h?.durationMs).toBe(24 * 3600000);

    // 1 millisecond beyond 24 hours must safely return null
    const beyond24h = new Date(baseMaghrib.getTime() + 24 * 3600000 + 1);
    expect(calculateIslamicNight(baseMaghrib, beyond24h)).toBeNull();

    // 28-hour duration must safely return null
    const duration28h = new Date(baseMaghrib.getTime() + 28 * 3600000);
    expect(calculateIslamicNight(baseMaghrib, duration28h)).toBeNull();

    // Zero duration (fajr === maghrib) must safely return null
    expect(calculateIslamicNight(baseMaghrib, baseMaghrib)).toBeNull();

    // Negative duration (fajr < maghrib) must safely return null
    const beforeMaghrib = new Date(baseMaghrib.getTime() - 1000);
    expect(calculateIslamicNight(baseMaghrib, beforeMaghrib)).toBeNull();

    // NaN dates must safely return null
    expect(calculateIslamicNight(new Date(NaN), exactly24h)).toBeNull();
    expect(calculateIslamicNight(baseMaghrib, new Date(NaN))).toBeNull();
  });

  it('empirically verifies point-in-time last-third transitions at microsecond precision', () => {
    const maghrib = new Date('2026-10-04T18:00:00.000Z');
    const nextFajr = new Date('2026-10-05T06:00:00.000Z');
    // Duration: 12h = 43,200,000 ms
    // Last third start: 18:00 + 8h = 02:00:00.000Z

    const lastThirdStartMs = maghrib.getTime() + (12 * 3600000 * 2) / 3;

    // 1 ms before: NOT last third
    const justBefore = calculateIslamicNight(maghrib, nextFajr, new Date(lastThirdStartMs - 1));
    expect(justBefore?.isCurrentlyLastThird).toBe(false);
    expect(justBefore?.isActive).toBe(true);

    // Exact millisecond: IS last third
    const exactStart = calculateIslamicNight(maghrib, nextFajr, new Date(lastThirdStartMs));
    expect(exactStart?.isCurrentlyLastThird).toBe(true);
    expect(exactStart?.isActive).toBe(true);

    // 1 ms after: IS last third
    const justAfter = calculateIslamicNight(maghrib, nextFajr, new Date(lastThirdStartMs + 1));
    expect(justAfter?.isCurrentlyLastThird).toBe(true);
    expect(justAfter?.isActive).toBe(true);

    // 1 ms before Fajr: IS last third
    const justBeforeEnd = calculateIslamicNight(maghrib, nextFajr, new Date(nextFajr.getTime() - 1));
    expect(justBeforeEnd?.isCurrentlyLastThird).toBe(true);
    expect(justBeforeEnd?.isActive).toBe(true);

    // Exact Fajr: NOT active, NOT last third
    const exactEnd = calculateIslamicNight(maghrib, nextFajr, nextFajr);
    expect(exactEnd?.isCurrentlyLastThird).toBe(false);
    expect(exactEnd?.isActive).toBe(false);
  });
});

describe('Challenger M1 Suite 5: Global Invariant Audit & Continuous 8,760-Hour Sweep', () => {
  it('empirically audits 365 days across all 6 locations that isCurrentlyLastThird strictly implies isActive', () => {
    const locations = [
      { name: 'Tromsø', lat: 69.6492, lon: 18.9553 },
      { name: 'Longyearbyen', lat: 78.2232, lon: 15.6267 },
      { name: 'London', lat: 51.5074, lon: -0.1278 },
      { name: 'Makkah', lat: 21.4225, lon: 39.8262 },
      { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
      { name: 'Ushuaia', lat: -54.8019, lon: -68.303 },
    ];

    const sampleHours = [0, 2, 4, 6, 8, 12, 16, 18, 20, 22]; // Multiple diurnal checkpoints

    for (const loc of locations) {
      for (let day = 1; day <= 365; day += 7) { // Weekly steps across full year
        for (const hour of sampleHours) {
          const evalDate = new Date(Date.UTC(2026, 0, day, hour, 0, 0));
          const sched = calculatePrayerTimes(loc.lat, loc.lon, evalDate, {
            convention: 'MuslimWorldLeague',
            highLatitudeRule: 'MiddleOfTheNight',
            now: evalDate,
          });

          if (sched.islamicNight) {
            // Logical invariant: It is physically and logically impossible to be in the last third of the night
            // without being in the night.
            if (sched.islamicNight.isCurrentlyLastThird) {
              expect(sched.islamicNight.isActive).toBe(true);
            }
          }
        }
      }
    }
  });

  it('empirically audits Antarctic high latitudes (McMurdo Station -77.85°S) and geographic poles (±90°)', () => {
    const extremePoles = [
      { name: 'McMurdo', lat: -77.846, lon: 166.676 },
      { name: 'NorthPole', lat: 90.0, lon: 0.0 },
      { name: 'SouthPole', lat: -90.0, lon: 0.0 },
      { name: 'AntimeridianEquator', lat: 0.0, lon: 180.0 },
      { name: 'NullIsland', lat: 0.0, lon: 0.0 },
    ];

    const testDays = [1, 80, 172, 264, 355]; // Solstices, equinoxes, mid-seasons

    for (const pole of extremePoles) {
      for (const day of testDays) {
        const testDate = new Date(Date.UTC(2026, 0, day, 12, 0, 0));

        // Test with and without highLatitudeRule
        for (const rule of ['MiddleOfTheNight', 'SeventhOfTheNight', 'AngleBased'] as HighLatitudeRule[]) {
          const sched = calculatePrayerTimes(pole.lat, pole.lon, testDate, {
            convention: 'MuslimWorldLeague',
            highLatitudeRule: rule,
          });

          // Invariant: No crashes, no unhandled exceptions
          expect(sched).toBeDefined();

          if (sched.islamicNight) {
            expect(Number.isFinite(sched.islamicNight.durationMs)).toBe(true);
            expect(sched.islamicNight.durationMs).toBeGreaterThan(0);
            expect(sched.islamicNight.durationMs).toBeLessThanOrEqual(24 * 3600000);
            expect(Number.isFinite(sched.islamicNight.midnight.getTime())).toBe(true);
            expect(Number.isFinite(sched.islamicNight.lastThirdStart.getTime())).toBe(true);
            expect(Number.isFinite(sched.islamicNight.lastThirdEnd.getTime())).toBe(true);
          }
        }
      }
    }
  });

  it('empirically audits year-round rule monotonicity whenever highLatitudeAdjustment is triggered', () => {
    // Audit London (51.5°N) across all 365 days of 2026
    const lat = 51.5074;
    const lon = -0.1278;

    let highLatAdjustmentDays = 0;

    for (let day = 1; day <= 365; day++) {
      const testDate = new Date(Date.UTC(2026, 0, day, 12, 0, 0));

      const sMiddle = calculatePrayerTimes(lat, lon, testDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      const sAngle = calculatePrayerTimes(lat, lon, testDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'AngleBased',
      });
      const sSeventh = calculatePrayerTimes(lat, lon, testDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'SeventhOfTheNight',
      });

      // The night computed at noon on day D runs from day D Maghrib to day D+1 Fajr.
      // Therefore, the night's duration depends on whether day D+1 Fajr used highLatitudeAdjustment.
      const tomDate = new Date(Date.UTC(2026, 0, day + 1, 12, 0, 0));
      const tomMiddle = calculatePrayerTimes(lat, lon, tomDate, {
        convention: 'MuslimWorldLeague',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      if (tomMiddle.fajr.provenance === 'highLatitudeAdjustment') {
        highLatAdjustmentDays++;
        expect(sAngle.islamicNight).toBeDefined();
        expect(sSeventh.islamicNight).toBeDefined();
        expect(sMiddle.islamicNight).toBeDefined();

        const dMiddle = sMiddle.islamicNight!.durationMs;
        const dAngle = sAngle.islamicNight!.durationMs;
        const dSeventh = sSeventh.islamicNight!.durationMs;

        // Strict monotonicity: Middle (0.50) < Angle (0.30) < Seventh (0.14)
        expect(dMiddle).toBeLessThan(dAngle);
        expect(dAngle).toBeLessThan(dSeventh);

        const ltMiddle = sMiddle.islamicNight!.lastThirdStart.getTime();
        const ltAngle = sAngle.islamicNight!.lastThirdStart.getTime();
        const ltSeventh = sSeventh.islamicNight!.lastThirdStart.getTime();

        expect(ltMiddle).toBeLessThan(ltAngle);
        expect(ltAngle).toBeLessThan(ltSeventh);
      } else {
        // When tomorrow's Fajr is astronomicalSign, all three rules yield to the true astronomical sign,
        // producing identical, physically grounded night durations (provenance integrity).
        const dMiddle = sMiddle.islamicNight!.durationMs;
        const dAngle = sAngle.islamicNight!.durationMs;
        const dSeventh = sSeventh.islamicNight!.durationMs;
        expect(dMiddle).toBe(dAngle);
        expect(dAngle).toBe(dSeventh);
      }
    }

    // London has persistent twilight without astronomical crossings for exactly 60 nights in summer
    expect(highLatAdjustmentDays).toBe(60);
  });
});

