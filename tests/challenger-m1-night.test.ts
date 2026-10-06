import { describe, it, expect } from 'vitest';
import {
  calculateIslamicNight,
  calculatePrayerTimes,
  IslamicNightInfo,
} from '../src/prayer/calculator';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  HighLatitudeRule,
} from '../src/prayer/conventions';

describe('Challenger M1 Suite 1: Mathematical Invariance across 1,000 Randomized Nights', () => {
  it('empirically verifies mathematical properties across 1,000 randomized night intervals', () => {
    // PRNG seed for deterministic stress testing
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const iterations = 1000;
    const baseEpoch = new Date('2026-01-01T00:00:00Z').getTime();

    for (let i = 0; i < iterations; i++) {
      // Random Maghrib between 2026 and 2030
      const maghribOffsetMs = Math.floor(rnd() * 365 * 4 * 86400000);
      const maghribMs = baseEpoch + maghribOffsetMs;
      // Random night duration between 1 ms and 24h - 1ms
      const durationMs = Math.floor(rnd() * (24 * 3600000 - 1)) + 1;
      const fajrMs = maghribMs + durationMs;

      const maghrib = new Date(maghribMs);
      const nextFajr = new Date(fajrMs);

      const night = calculateIslamicNight(maghrib, nextFajr);
      expect(night).not.toBeNull();
      if (!night) continue;

      // Invariant 1: duration == fajr - maghrib
      expect(night.durationMs).toBe(durationMs);

      // Invariant 2: midnight == maghrib + duration/2
      const expectedMidnightMs = Math.round(maghribMs + durationMs / 2);
      expect(night.midnight.getTime()).toBe(expectedMidnightMs);
      expect(Math.abs(night.midnight.getTime() - (maghribMs + fajrMs) / 2)).toBeLessThanOrEqual(0.5);

      // Invariant 3: firstThirdEnd == maghrib + duration/3
      const expectedFirstThirdEndMs = Math.round(maghribMs + durationMs / 3);
      expect(night.firstThirdEnd?.getTime()).toBe(expectedFirstThirdEndMs);

      // Invariant 4: lastThirdStart == maghrib + (2 * duration) / 3 == fajr - duration/3
      const expectedLastThirdStartMs = Math.round(maghribMs + (durationMs * 2) / 3);
      expect(night.lastThirdStart.getTime()).toBe(expectedLastThirdStartMs);

      // Verification of dual equivalence: maghrib + 2/3 * D === fajr - round(D / 3)
      const dualStartMs = fajrMs - Math.round(durationMs / 3);
      expect(night.lastThirdStart.getTime()).toBe(dualStartMs);

      // Invariant 5: lastThirdEnd == fajr
      expect(night.lastThirdEnd.getTime()).toBe(fajrMs);

      // Invariant 6: Strict ordering for durations >= 3ms
      if (durationMs >= 3) {
        expect(maghribMs).toBeLessThanOrEqual(night.firstThirdEnd!.getTime());
        expect(night.firstThirdEnd!.getTime()).toBeLessThanOrEqual(night.midnight.getTime());
        expect(night.midnight.getTime()).toBeLessThanOrEqual(night.lastThirdStart.getTime());
        expect(night.lastThirdStart.getTime()).toBeLessThanOrEqual(night.lastThirdEnd.getTime());
      }

      // Invariant 7: Partitions sum to exactly durationMs
      const part1 = night.firstThirdEnd!.getTime() - maghribMs;
      const part2 = night.lastThirdStart.getTime() - night.firstThirdEnd!.getTime();
      const part3 = night.lastThirdEnd.getTime() - night.lastThirdStart.getTime();
      expect(part1 + part2 + part3).toBe(durationMs);

      // And part1, part2, part3 differ by at most 1ms
      expect(Math.abs(part1 - part2)).toBeLessThanOrEqual(1);
      expect(Math.abs(part2 - part3)).toBeLessThanOrEqual(1);
      expect(Math.abs(part1 - part3)).toBeLessThanOrEqual(1);
    }
  });
});

describe('Challenger M1 Suite 2: Point-in-Time Fuzzing Across 2,000 Timestamps', () => {
  it('fuzzes timestamps across the night ensuring state coherence and mutual exclusion', () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const maghrib = new Date('2026-10-04T18:15:30.000Z');
    const durationMs = 11 * 3600000 + 45 * 60000 + 12000; // 11h 45m 12s
    const nextFajr = new Date(maghrib.getTime() + durationMs);

    const maghribMs = maghrib.getTime();
    const fajrMs = nextFajr.getTime();
    const lastThirdStartMs = Math.round(maghribMs + (durationMs * 2) / 3);

    // Sample 2,000 timestamps from 3 hours before Maghrib to 3 hours after Fajr
    const windowStartMs = maghribMs - 3 * 3600000;
    const windowEndMs = fajrMs + 3 * 3600000;
    const spanMs = windowEndMs - windowStartMs;

    for (let i = 0; i < 2000; i++) {
      const sampleMs = Math.floor(windowStartMs + rnd() * spanMs);
      const sampleDate = new Date(sampleMs);

      const night = calculateIslamicNight(maghrib, nextFajr, sampleDate);
      expect(night).not.toBeNull();
      if (!night) continue;

      const inActiveSpan = sampleMs >= maghribMs && sampleMs < fajrMs;
      const inLastThirdSpan = sampleMs >= lastThirdStartMs && sampleMs < fajrMs;

      // Invariant 2.1: isActive reflects [maghrib, fajr)
      expect(night.isActive).toBe(inActiveSpan);

      // Invariant 2.2: isCurrentlyLastThird reflects [lastThirdStart, fajr)
      expect(night.isCurrentlyLastThird).toBe(inLastThirdSpan);

      // Invariant 2.3: isCurrentlyLastThird implies isActive
      if (night.isCurrentlyLastThird) {
        expect(night.isActive).toBe(true);
      }

      // Invariant 2.4: If sample is before lastThirdStart, isCurrentlyLastThird must be false
      if (sampleMs < lastThirdStartMs) {
        expect(night.isCurrentlyLastThird).toBe(false);
      }

      // Invariant 2.5: If sample is at or after Fajr, both must be false
      if (sampleMs >= fajrMs) {
        expect(night.isActive).toBe(false);
        expect(night.isCurrentlyLastThird).toBe(false);
      }
    }
  });
});

describe('Challenger M1 Suite 3: Exact Millisecond Boundary Transitions', () => {
  it('tests transition behavior at exact -1ms, 0ms, and +1ms offsets', () => {
    const maghrib = new Date('2026-10-04T18:00:00.000Z');
    const durationMs = 12 * 3600000; // exactly 12 hours
    const nextFajr = new Date(maghrib.getTime() + durationMs);

    const maghribMs = maghrib.getTime();
    const fajrMs = nextFajr.getTime();
    const midnightMs = maghribMs + durationMs / 2;
    const lastThirdStartMs = maghribMs + (durationMs * 2) / 3;

    // Boundary 1: Maghrib
    const b1Minus = calculateIslamicNight(maghrib, nextFajr, new Date(maghribMs - 1));
    expect(b1Minus?.isActive).toBe(false);
    expect(b1Minus?.isCurrentlyLastThird).toBe(false);

    const b1Exact = calculateIslamicNight(maghrib, nextFajr, new Date(maghribMs));
    expect(b1Exact?.isActive).toBe(true);
    expect(b1Exact?.isCurrentlyLastThird).toBe(false);

    const b1Plus = calculateIslamicNight(maghrib, nextFajr, new Date(maghribMs + 1));
    expect(b1Plus?.isActive).toBe(true);
    expect(b1Plus?.isCurrentlyLastThird).toBe(false);

    // Boundary 2: Midnight
    const b2Minus = calculateIslamicNight(maghrib, nextFajr, new Date(midnightMs - 1));
    expect(b2Minus?.isActive).toBe(true);
    expect(b2Minus?.isCurrentlyLastThird).toBe(false);

    const b2Exact = calculateIslamicNight(maghrib, nextFajr, new Date(midnightMs));
    expect(b2Exact?.isActive).toBe(true);
    expect(b2Exact?.isCurrentlyLastThird).toBe(false);

    const b2Plus = calculateIslamicNight(maghrib, nextFajr, new Date(midnightMs + 1));
    expect(b2Plus?.isActive).toBe(true);
    expect(b2Plus?.isCurrentlyLastThird).toBe(false);

    // Boundary 3: Last Third Start (inclusive threshold)
    const b3Minus = calculateIslamicNight(maghrib, nextFajr, new Date(lastThirdStartMs - 1));
    expect(b3Minus?.isActive).toBe(true);
    expect(b3Minus?.isCurrentlyLastThird).toBe(false);

    const b3Exact = calculateIslamicNight(maghrib, nextFajr, new Date(lastThirdStartMs));
    expect(b3Exact?.isActive).toBe(true);
    expect(b3Exact?.isCurrentlyLastThird).toBe(true);

    const b3Plus = calculateIslamicNight(maghrib, nextFajr, new Date(lastThirdStartMs + 1));
    expect(b3Plus?.isActive).toBe(true);
    expect(b3Plus?.isCurrentlyLastThird).toBe(true);

    // Boundary 4: Fajr Athan (exclusive end threshold)
    const b4Minus = calculateIslamicNight(maghrib, nextFajr, new Date(fajrMs - 1));
    expect(b4Minus?.isActive).toBe(true);
    expect(b4Minus?.isCurrentlyLastThird).toBe(true);

    const b4Exact = calculateIslamicNight(maghrib, nextFajr, new Date(fajrMs));
    expect(b4Exact?.isActive).toBe(false);
    expect(b4Exact?.isCurrentlyLastThird).toBe(false);

    const b4Plus = calculateIslamicNight(maghrib, nextFajr, new Date(fajrMs + 1));
    expect(b4Plus?.isActive).toBe(false);
    expect(b4Plus?.isCurrentlyLastThird).toBe(false);
  });
});

describe('Challenger M1 Suite 4: Degenerate, Unphysical, and Extreme Inputs', () => {
  it('handles degenerate and unphysical durations', () => {
    const base = new Date('2026-03-21T18:00:00.000Z');

    // 0ms duration (Fajr == Maghrib)
    expect(calculateIslamicNight(base, base)).toBeNull();

    // Negative duration (Fajr before Maghrib)
    expect(calculateIslamicNight(base, new Date(base.getTime() - 1))).toBeNull();
    expect(calculateIslamicNight(base, new Date(base.getTime() - 3600000))).toBeNull();

    // 1ms duration (minimal valid positive duration)
    const minNight = calculateIslamicNight(base, new Date(base.getTime() + 1));
    expect(minNight).not.toBeNull();
    expect(minNight?.durationMs).toBe(1);

    // Exactly 24 hours duration (maximum allowable limit)
    const exact24hNight = calculateIslamicNight(base, new Date(base.getTime() + 24 * 3600000));
    expect(exact24hNight).not.toBeNull();
    expect(exact24hNight?.durationMs).toBe(24 * 3600000);

    // 24 hours + 1 ms (exceeds physical night span)
    const over24hNight = calculateIslamicNight(base, new Date(base.getTime() + 24 * 3600000 + 1));
    expect(over24hNight).toBeNull();

    // 100 days
    expect(calculateIslamicNight(base, new Date(base.getTime() + 100 * 86400000))).toBeNull();
  });

  it('handles malformed types and non-dates without throwing exceptions', () => {
    const valid = new Date('2026-03-21T18:00:00.000Z');
    const validNext = new Date('2026-03-22T05:00:00.000Z');

    // Nulls and undefined
    expect(calculateIslamicNight(null, validNext)).toBeNull();
    expect(calculateIslamicNight(valid, null)).toBeNull();
    expect(calculateIslamicNight(undefined, undefined)).toBeNull();

    // Non-finite Date instances
    expect(calculateIslamicNight(new Date(NaN), validNext)).toBeNull();
    expect(calculateIslamicNight(valid, new Date('invalid date string'))).toBeNull();
    expect(calculateIslamicNight(new Date(Infinity), validNext)).toBeNull();

    // Primitives cast to Date
    expect(calculateIslamicNight(123456 as unknown as Date, validNext)).toBeNull();
    expect(calculateIslamicNight('2026-03-21' as unknown as Date, validNext)).toBeNull();
    expect(calculateIslamicNight({} as unknown as Date, validNext)).toBeNull();

    // Null or invalid current parameter
    const resWithNullCurrent = calculateIslamicNight(valid, validNext, null);
    expect(resWithNullCurrent).not.toBeNull();
    expect(resWithNullCurrent?.isActive).toBe(false);
    expect(resWithNullCurrent?.isCurrentlyLastThird).toBe(false);

    const resWithNaNCurrent = calculateIslamicNight(valid, validNext, new Date(NaN));
    expect(resWithNaNCurrent).not.toBeNull();
    expect(resWithNaNCurrent?.isActive).toBe(false);
    expect(resWithNaNCurrent?.isCurrentlyLastThird).toBe(false);
  });
});

describe('Challenger M1 Suite 5: Global Settlement and Astronomical Cross-Product', () => {
  const globalCities = [
    { name: 'Quito (Equator)', lat: -0.1807, lon: -78.4678 },
    { name: 'Pontianak (Equator)', lat: 0.0, lon: 109.3333 },
    { name: 'Nairobi (Equator)', lat: -1.2921, lon: 36.8219 },
    { name: 'Makkah (Subtropics)', lat: 21.4225, lon: 39.8262 },
    { name: 'Madinah (Subtropics)', lat: 24.4672, lon: 39.6111 },
    { name: 'Cairo (Temperate North)', lat: 30.0444, lon: 31.2357 },
    { name: 'Amman (Temperate North)', lat: 31.9454, lon: 35.9284 },
    { name: 'Istanbul (Temperate North)', lat: 41.0082, lon: 28.9784 },
    { name: 'London (High Temperate)', lat: 51.5074, lon: -0.1278 },
    { name: 'Paris (High Temperate)', lat: 48.8566, lon: 2.3522 },
    { name: 'Tokyo (East)', lat: 35.6762, lon: 139.6503 },
    { name: 'Beijing (East)', lat: 39.9042, lon: 116.4074 },
    { name: 'Kuala Lumpur (Equatorial)', lat: 3.139, lon: 101.6869 },
    { name: 'Jakarta (South Tropics)', lat: -6.2088, lon: 106.8456 },
    { name: 'Sydney (Southern Temperate)', lat: -33.8688, lon: 151.2093 },
    { name: 'Cape Town (Southern Temperate)', lat: -33.9249, lon: 18.4241 },
    { name: 'Buenos Aires (Southern Temperate)', lat: -34.6037, lon: -58.3816 },
    { name: 'Ushuaia (Deep South)', lat: -54.8019, lon: -68.303 },
    { name: 'Reykjavik (Sub-Arctic)', lat: 64.1466, lon: -21.9426 },
    { name: 'Fairbanks (Sub-Arctic)', lat: 64.8378, lon: -147.7164 },
    { name: 'Suva (Antimeridian Fiji)', lat: -18.1416, lon: 178.4419 },
    { name: 'Apia (Antimeridian Samoa)', lat: -13.8333, lon: -171.7667 },
  ];

  const seasonalDates = [
    new Date('2026-03-20T12:00:00Z'), // Equinox
    new Date('2026-06-21T12:00:00Z'), // Solstice
    new Date('2026-09-22T12:00:00Z'), // Equinox
    new Date('2026-12-21T12:00:00Z'), // Solstice
  ];

  const conventions: CalculationConventionName[] = [
    'UmmAlQura',
    'MuslimWorldLeague',
    'Egyptian',
    'Karachi',
    'Dubai',
  ];

  it('validates astronomical night properties across 22 cities, 4 seasons, and 5 conventions (440 combinations)', () => {
    let checkedCount = 0;

    for (const city of globalCities) {
      for (const date of seasonalDates) {
        for (const convention of conventions) {
          const sched = calculatePrayerTimes(city.lat, city.lon, date, {
            convention,
            highLatitudeRule: 'MiddleOfTheNight',
          });

          // In non-polar regions, Maghrib and Fajr must resolve
          if (sched.maghrib.date !== null && sched.fajr.date !== null) {
            expect(sched.islamicNight).toBeDefined();
            const night = sched.islamicNight!;

            // Property 1: Night duration is positive and physically bounded (< 24h)
            // Note: At high latitudes near Arctic Circle (e.g. Fairbanks at lat 64.84° N on summer solstice),
            // sunset to sunrise is under 3 hours, so MiddleOfTheNight yields an Islamic night of ~1.43 hours.
            expect(night.durationMs).toBeGreaterThan(1 * 3600000);
            expect(night.durationMs).toBeLessThan(22 * 3600000);

            const nowMs = date.getTime();
            const isPreDawn = nowMs < sched.fajr.date.getTime();

            if (isPreDawn) {
              // Pre-dawn night: ends at today's Fajr, started at yesterday's Maghrib
              expect(night.lastThirdEnd.getTime()).toBe(sched.fajr.date.getTime());
              expect(night.lastThirdStart.getTime()).toBeLessThan(night.lastThirdEnd.getTime());
              expect(night.midnight.getTime()).toBeLessThan(night.lastThirdStart.getTime());

              // Verify mathematical midpoint and last third from end
              const derivedStart = night.lastThirdEnd.getTime() - night.durationMs;
              expect(night.midnight.getTime()).toBe(
                Math.round(derivedStart + night.durationMs / 2),
              );
              expect(night.lastThirdStart.getTime()).toBe(
                Math.round(derivedStart + (night.durationMs * 2) / 3),
              );
            } else {
              // Daytime or evening: starts at today's Maghrib, ends at tomorrow's Fajr
              expect(sched.maghrib.date.getTime()).toBeLessThan(night.midnight.getTime());
              expect(night.midnight.getTime()).toBeLessThan(night.lastThirdStart.getTime());
              expect(night.lastThirdStart.getTime()).toBeLessThan(night.lastThirdEnd.getTime());

              // Verify mathematical midpoint and last third from start
              const expectedStart = Math.round(
                sched.maghrib.date.getTime() + (night.durationMs * 2) / 3,
              );
              expect(night.lastThirdStart.getTime()).toBe(expectedStart);
            }

            checkedCount++;
          }
        }
      }
    }

    expect(checkedCount).toBeGreaterThan(400);
  });
});

describe('Challenger M1 Suite 6: Continuous 24-Hour Timeline Sweep and Flawless State Transitions', () => {
  it('sweeps 288 consecutive 5-minute ticks across Makkah verifying continuous state integrity', () => {
    // Oct 4, 2026 in Makkah (lat 21.4225, lon 39.8262)
    // Maghrib on Oct 4 is ~15:05 UTC (18:05 AST)
    // Fajr on Oct 5 is ~01:48 UTC (04:48 AST)
    const baseDay = new Date('2026-10-04T00:00:00Z');

    // Get initial state at step 0
    const initialSched = calculatePrayerTimes(21.4225, 39.8262, baseDay);
    expect(initialSched.islamicNight).toBeDefined();

    let wasLastThird = initialSched.islamicNight!.isCurrentlyLastThird;
    let transitionIntoLastThirdCount = 0;
    let transitionOutOfLastThirdCount = 0;

    // Sweep 288 steps (5 minute increments across the 24 hours, starting from step 1)
    for (let step = 1; step < 288; step++) {
      const now = new Date(baseDay.getTime() + step * 5 * 60000);
      const sched = calculatePrayerTimes(21.4225, 39.8262, now);

      expect(sched.islamicNight).toBeDefined();
      const night = sched.islamicNight!;

      if (!wasLastThird && night.isCurrentlyLastThird) {
        transitionIntoLastThirdCount++;
      }
      if (wasLastThird && !night.isCurrentlyLastThird) {
        transitionOutOfLastThirdCount++;
      }

      // If in last third, night MUST be active
      if (night.isCurrentlyLastThird) {
        expect(night.isActive).toBe(true);
      }

      wasLastThird = night.isCurrentlyLastThird;
    }

    // In a continuous sweep starting at 00:00 UTC (which is pre-dawn on Oct 4, already inside last third):
    // 1. Initially inside last third (wasLastThird = true)
    // 2. Exits last third at Fajr (~01:48 UTC) -> transitionOutOfLastThirdCount = 1
    // 3. Daytime (neither active nor last third)
    // 4. Enters active night at Maghrib (~15:05 UTC)
    // 5. Enters last third of Oct 4-5 night at ~22:13 UTC -> transitionIntoLastThirdCount = 1
    // 6. Finishes 24h still in last third
    // Exactly 1 exit (morning) and 1 entry (late night) occur over the 24h cycle. Zero spurious transitions!
    expect(transitionIntoLastThirdCount).toBe(1);
    expect(transitionOutOfLastThirdCount).toBe(1);
  });
});

describe('Challenger M1 Suite 7: Civil Midnight Crossing Continuity', () => {
  it('ensures identical night division across civil UTC midnight (23:59:59.999 vs 00:00:00.001)', () => {
    // In Makkah:
    // At 2026-10-04T23:59:59.999Z, civil date is Oct 4.
    // At 2026-10-05T00:00:00.001Z, civil date is Oct 5.
    // Both timestamps belong to the exact same Islamic night: from Maghrib on Oct 4 to Fajr on Oct 5.
    const tBeforeMidnight = new Date('2026-10-04T23:59:59.999Z');
    const tAfterMidnight = new Date('2026-10-05T00:00:00.001Z');

    const schedBefore = calculatePrayerTimes(21.4225, 39.8262, tBeforeMidnight);
    const schedAfter = calculatePrayerTimes(21.4225, 39.8262, tAfterMidnight);

    expect(schedBefore.islamicNight).toBeDefined();
    expect(schedAfter.islamicNight).toBeDefined();

    const nightBefore = schedBefore.islamicNight!;
    const nightAfter = schedAfter.islamicNight!;

    // Both must point to the exact same night interval!
    expect(nightBefore.durationMs).toBe(nightAfter.durationMs);
    expect(nightBefore.midnight.getTime()).toBe(nightAfter.midnight.getTime());
    expect(nightBefore.lastThirdStart.getTime()).toBe(nightAfter.lastThirdStart.getTime());
    expect(nightBefore.lastThirdEnd.getTime()).toBe(nightAfter.lastThirdEnd.getTime());

    // Both must be active
    expect(nightBefore.isActive).toBe(true);
    expect(nightAfter.isActive).toBe(true);
  });
});

describe('Challenger M1 Suite 8: Polar Day and Polar Night High-Latitude Extremes', () => {
  it('handles Tromso and Hammerfest polar night gracefully without crashes', () => {
    // Tromso: 69.6492, 18.9553
    // Hammerfest: 70.6634, 23.6821
    const winterSolstice = new Date('2026-12-21T12:00:00Z');

    const tromsoWinter = calculatePrayerTimes(69.6492, 18.9553, winterSolstice);
    expect(tromsoWinter.maghrib.date).toBeNull();
    // In complete polar night when sunset does not occur, islamicNight must be cleanly undefined
    expect(tromsoWinter.islamicNight).toBeUndefined();

    const hammerfestWinter = calculatePrayerTimes(70.6634, 23.6821, winterSolstice);
    expect(hammerfestWinter.maghrib.date).toBeNull();
    expect(hammerfestWinter.islamicNight).toBeUndefined();
  });

  it('handles Tromso midnight sun with high-latitude virtual night rules', () => {
    const summerSolstice = new Date('2026-06-21T12:00:00Z');

    // Without rule: no sunset -> undefined
    const noRule = calculatePrayerTimes(69.6492, 18.9553, summerSolstice, {
      convention: 'MuslimWorldLeague',
    });
    expect(noRule.islamicNight).toBeUndefined();

    // With MiddleOfTheNight rule: virtual night is established
    const withRule = calculatePrayerTimes(69.6492, 18.9553, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    expect(withRule.islamicNight).toBeDefined();
    const polarNight = withRule.islamicNight!;

    // Virtual night is <= 8 hours
    expect(polarNight.durationMs).toBeGreaterThan(0);
    expect(polarNight.durationMs).toBeLessThanOrEqual(8 * 3600000);

    // Verify mathematical division of virtual night
    expect(polarNight.midnight.getTime()).toBe(
      Math.round(withRule.maghrib.date!.getTime() + polarNight.durationMs / 2),
    );
    expect(polarNight.lastThirdStart.getTime()).toBe(
      Math.round(withRule.maghrib.date!.getTime() + (polarNight.durationMs * 2) / 3),
    );
    expect(polarNight.lastThirdEnd.getTime()).toBe(withRule.fajr.date!.getTime());
  });
});

describe('Challenger M1 Suite 9: Antimeridian and Extreme Southern Hemisphere Latitude Rigor', () => {
  it('verifies correct night division for extreme southern latitudes (Ushuaia, Punta Arenas)', () => {
    // Ushuaia (lat -54.8019, lon -68.303)
    // June 21 is Southern Winter: very long night (> 16 hours)
    const winterDate = new Date('2026-06-21T12:00:00Z');
    const winterSched = calculatePrayerTimes(-54.8019, -68.303, winterDate);

    expect(winterSched.islamicNight).toBeDefined();
    const wNight = winterSched.islamicNight!;
    expect(wNight.durationMs).toBeGreaterThan(14 * 3600000);
    expect(wNight.durationMs).toBeLessThan(18 * 3600000);

    // December 21 is Southern Summer: short night (< 8 hours)
    const summerDate = new Date('2026-12-21T12:00:00Z');
    const summerSched = calculatePrayerTimes(-54.8019, -68.303, summerDate);

    expect(summerSched.islamicNight).toBeDefined();
    const sNight = summerSched.islamicNight!;
    expect(sNight.durationMs).toBeGreaterThan(3 * 3600000);
    expect(sNight.durationMs).toBeLessThan(8 * 3600000);

    // Winter night is at least 8 hours longer than summer night (seasonal difference ~11 hours)
    expect((wNight.durationMs - sNight.durationMs) / 3600000).toBeGreaterThan(8);
  });

  it('verifies Antimeridian settlement night calculations (Fiji, Samoa, Petropavlovsk)', () => {
    const dates = [
      new Date('2026-03-20T12:00:00Z'),
      new Date('2026-06-21T12:00:00Z'),
      new Date('2026-09-22T12:00:00Z'),
      new Date('2026-12-21T12:00:00Z'),
    ];

    const antimeridianCities = [
      { name: 'Suva (lon +178.44)', lat: -18.1416, lon: 178.4419 },
      { name: 'Apia (lon -171.77)', lat: -13.8333, lon: -171.7667 },
      { name: 'Petropavlovsk (lon +158.65)', lat: 53.0452, lon: 158.6511 },
      { name: 'Nome (lon -165.41)', lat: 64.5011, lon: -165.4064 },
    ];

    for (const city of antimeridianCities) {
      for (const d of dates) {
        const sched = calculatePrayerTimes(city.lat, city.lon, d);
        if (sched.maghrib.date && sched.fajr.date) {
          expect(sched.islamicNight).toBeDefined();
          const n = sched.islamicNight!;
          expect(n.durationMs).toBeGreaterThan(0);
          expect(n.durationMs).toBeLessThan(24 * 3600000);
          expect(n.midnight.getTime()).toBeLessThan(n.lastThirdStart.getTime());
          expect(n.lastThirdStart.getTime()).toBeLessThan(n.lastThirdEnd.getTime());
        }
      }
    }
  });
});

describe('Challenger M1 Suite 10: Explicit options.now Parameter Behavior', () => {
  it('correctly uses options.now while preserving base date astronomical schedule', () => {
    const baseDate = new Date('2026-10-04T12:00:00Z');
    // Makkah: Maghrib is ~15:05 UTC, tomorrow Fajr is ~01:48 UTC (Oct 5).
    // Last third starts at ~22:13 UTC on Oct 4.

    // 1. options.now in daytime (13:00 UTC): not active, not last third
    const daySched = calculatePrayerTimes(21.4225, 39.8262, baseDate, {
      now: new Date('2026-10-04T13:00:00Z'),
    });
    expect(daySched.islamicNight?.isActive).toBe(false);
    expect(daySched.islamicNight?.isCurrentlyLastThird).toBe(false);

    // 2. options.now in early evening (18:00 UTC): active, not last third
    const eveningSched = calculatePrayerTimes(21.4225, 39.8262, baseDate, {
      now: new Date('2026-10-04T18:00:00Z'),
    });
    expect(eveningSched.islamicNight?.isActive).toBe(true);
    expect(eveningSched.islamicNight?.isCurrentlyLastThird).toBe(false);

    // 3. options.now in last third (23:30 UTC): active, IS last third
    const tahajjudSched = calculatePrayerTimes(21.4225, 39.8262, baseDate, {
      now: new Date('2026-10-04T23:30:00Z'),
    });
    expect(tahajjudSched.islamicNight?.isActive).toBe(true);
    expect(tahajjudSched.islamicNight?.isCurrentlyLastThird).toBe(true);

    // 4. options.now at tomorrow 02:00 UTC (after tomorrow Fajr at 01:48 UTC): not active
    const postFajrSched = calculatePrayerTimes(21.4225, 39.8262, baseDate, {
      now: new Date('2026-10-05T02:00:00Z'),
    });
    expect(postFajrSched.islamicNight?.isActive).toBe(false);
    expect(postFajrSched.islamicNight?.isCurrentlyLastThird).toBe(false);
  });
});

describe('Challenger M1 Suite 11: Computational Performance & Allocation Stress', () => {
  it('executes 10,000 pure calculateIslamicNight calls in under 50ms without garbage collection stutter', () => {
    const maghrib = new Date('2026-10-04T18:00:00Z');
    const fajr = new Date('2026-10-05T05:00:00Z');
    const now = new Date('2026-10-05T02:00:00Z');

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const res = calculateIslamicNight(maghrib, fajr, now);
      if (!res) throw new Error('Unexpected null');
    }
    const elapsed = performance.now() - start;

    // 10,000 calls must run in under 50ms (< 5 microseconds per call)
    expect(elapsed).toBeLessThan(50);
  });

  it('executes 500 complete calculatePrayerTimes calls including multi-day lookaheads in under 200ms', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const sched = calculatePrayerTimes(21.4225, 39.8262, date);
      if (!sched.islamicNight) throw new Error('Unexpected undefined');
    }
    const elapsed = performance.now() - start;

    // 500 full multi-day astronomical evaluations in under 200ms (< 400 microseconds each)
    expect(elapsed).toBeLessThan(200);
  });
});

