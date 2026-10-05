import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AdhanEventEngine,
  buildScheduleCacheKey,
} from '../src/simulation/eventEngine';
import {
  calculatePrayerTimes,
  PrayerTimesSchedule,
} from '../src/prayer/calculator';
import {
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from '../src/prayer/conventions';
import {
  getEquationOfTime,
  getSolarDeclination,
} from '../src/astronomy/solar';
import {
  parseSettlements,
  CompactSettlementRow,
  Settlement,
} from '../src/population/loader';

describe('Challenger M3 Suite 1: Tokyo Witness W06 Temporal Crossing Oracle', () => {
  const tokyoSettlement: Settlement = {
    name: 'Tokyo',
    nameAr: 'طوكيو',
    latitude: 35.68,
    longitude: 139.76,
    countryCode: 'JP',
    population: 14000000,
    timezone: 'Asia/Tokyo',
  };

  const engine = new AdhanEventEngine([tokyoSettlement], {
    convention: 'UmmAlQura',
    madhab: 'Shafi',
    adhanDurationMinutes: 4,
  });

  const queryInstant = new Date('2026-10-04T19:12:01.579Z');
  const durationMs = 4 * 60 * 1000;

  it('empirically verifies Tokyo W06: 2026-10-04T19:12:01.579Z MUST return active Fajr with progress ~0', () => {
    // Independent ground-truth computation for Tokyo on civil date 2026-10-05
    const schedOct5 = calculatePrayerTimes(
      tokyoSettlement.latitude,
      tokyoSettlement.longitude,
      new Date('2026-10-05T12:00:00Z'),
      { convention: 'UmmAlQura', madhab: 'Shafi' }
    );

    expect(schedOct5.fajr.date).not.toBeNull();
    const expectedFajrTime = schedOct5.fajr.date!;

    // Query engine at witness instant 2026-10-04T19:12:01.579Z
    const activeEvents = engine.getActiveEvents(queryInstant);
    expect(activeEvents.length).toBe(1);

    const ev = activeEvents[0];
    expect(ev.settlementIndex).toBe(0);
    expect(ev.prayer).toBe('fajr');
    // Witness instant is within the initial minute of Fajr (progress ~0)
    expect(ev.progress).toBeGreaterThanOrEqual(0.0);
    expect(ev.progress).toBeLessThan(0.2);
    expect(ev.startTime.getTime()).toBe(expectedFajrTime.getTime());
    expect(ev.endTime.getTime()).toBe(expectedFajrTime.getTime() + durationMs);
    expect(ev.eventId).toBe(`0:fajr:${expectedFajrTime.getTime()}`);
  });

  it('empirically stress-tests strict half-open interval boundaries [tStart, tStart + duration)', () => {
    const schedOct5 = calculatePrayerTimes(
      tokyoSettlement.latitude,
      tokyoSettlement.longitude,
      new Date('2026-10-05T12:00:00Z'),
      { convention: 'UmmAlQura', madhab: 'Shafi' }
    );
    const tStart = schedOct5.fajr.date!.getTime();

    // 1. Boundary: 1 ms prior to Fajr instant -> MUST be inactive
    const atTMinus1 = engine.getActiveEvents(new Date(tStart - 1));
    expect(atTMinus1.length).toBe(0);

    // 2. Boundary: Exact start instant -> active with progress = 0.0
    const atT0 = engine.getActiveEvents(new Date(tStart));
    expect(atT0.length).toBe(1);
    expect(atT0[0].progress).toBe(0.0);

    // 3. Midpoint: tStart + 2 minutes -> active with progress = 0.5
    const atMid = engine.getActiveEvents(new Date(tStart + 2 * 60 * 1000));
    expect(atMid.length).toBe(1);
    expect(atMid[0].progress).toBeCloseTo(0.5, 5);

    // 4. Final millisecond: tStart + 4 minutes - 1 ms -> active with progress ~ 0.99999
    const atLastMs = engine.getActiveEvents(new Date(tStart + durationMs - 1));
    expect(atLastMs.length).toBe(1);
    expect(atLastMs[0].progress).toBe((durationMs - 1) / durationMs);
    expect(atLastMs[0].progress).toBeLessThan(1.0);

    // 5. Exact expiry instant: tStart + 4 minutes -> MUST be inactive
    const atEnd = engine.getActiveEvents(new Date(tStart + durationMs));
    expect(atEnd.length).toBe(0);

    // 6. Post expiry: tStart + 4 minutes + 1 ms -> MUST be inactive
    const atEndPlus1 = engine.getActiveEvents(new Date(tStart + durationMs + 1));
    expect(atEndPlus1.length).toBe(0);
  });

  it('empirically verifies multi-city eastern longitudes crossing UTC date boundary', () => {
    const easternCities: Settlement[] = [
      {
        name: 'Sydney',
        nameAr: 'سيدني',
        latitude: -33.87,
        longitude: 151.21,
        countryCode: 'AU',
        population: 5300000,
        timezone: 'Australia/Sydney',
      },
      {
        name: 'Auckland',
        nameAr: 'أوكلاند',
        latitude: -36.85,
        longitude: 174.76,
        countryCode: 'NZ',
        population: 1650000,
        timezone: 'Pacific/Auckland',
      },
      {
        name: 'Suva',
        nameAr: 'سوفا',
        latitude: -18.14,
        longitude: 178.44,
        countryCode: 'FJ',
        population: 93000,
        timezone: 'Pacific/Fiji',
      },
    ];

    const easternEngine = new AdhanEventEngine(easternCities, {
      convention: 'UmmAlQura',
      madhab: 'Shafi',
      adhanDurationMinutes: 4,
    });

    // For civil date 2026-10-05, all these cities have Fajr on UTC date 2026-10-04
    for (let i = 0; i < easternCities.length; i++) {
      const city = easternCities[i];
      const sched = calculatePrayerTimes(
        city.latitude,
        city.longitude,
        new Date('2026-10-05T12:00:00Z'),
        { convention: 'UmmAlQura', madhab: 'Shafi' }
      );

      const fajrDate = sched.fajr.date!;
      expect(fajrDate.getUTCDate()).toBe(4); // Falls on UTC 4 October

      // Query engine at exact Fajr instant
      const active = easternEngine.getActiveEvents(fajrDate);
      const match = active.find((e) => e.settlementIndex === i);
      expect(match).toBeDefined();
      expect(match?.prayer).toBe('fajr');
      expect(match?.progress).toBe(0.0);
    }
  });
});

describe('Challenger M3 Suite 2: Western Longitudes Crossing UTC Midnight Oracle', () => {
  const honolulu: Settlement = {
    name: 'Honolulu',
    nameAr: 'هونولولو',
    latitude: 21.30,
    longitude: -157.85,
    countryCode: 'US',
    population: 350000,
    timezone: 'Pacific/Honolulu',
  };

  const engine = new AdhanEventEngine([honolulu], {
    convention: 'UmmAlQura',
    madhab: 'Shafi',
    adhanDurationMinutes: 4,
  });

  it('empirically verifies Honolulu 2026-10-04 civil schedule Maghrib and Isha cross into UTC 2026-10-05', () => {
    // On civil date 2026-10-04:
    const schedOct4 = calculatePrayerTimes(
      honolulu.latitude,
      honolulu.longitude,
      new Date('2026-10-04T12:00:00Z'),
      { convention: 'UmmAlQura', madhab: 'Shafi' }
    );

    const maghribDate = schedOct4.maghrib.date!;
    const ishaDate = schedOct4.isha.date!;

    // Both Maghrib and Isha must have crossed into UTC date 5 October
    expect(maghribDate.getUTCDate()).toBe(5);
    expect(ishaDate.getUTCDate()).toBe(5);

    // Test Maghrib activation on UTC 5 October
    const activeMaghrib = engine.getActiveEvents(maghribDate);
    expect(activeMaghrib.length).toBe(1);
    expect(activeMaghrib[0].prayer).toBe('maghrib');
    expect(activeMaghrib[0].progress).toBe(0.0);
    expect(activeMaghrib[0].startTime.getTime()).toBe(maghribDate.getTime());

    // Test Isha activation on UTC 5 October
    const activeIsha = engine.getActiveEvents(ishaDate);
    expect(activeIsha.length).toBe(1);
    expect(activeIsha[0].prayer).toBe('isha');
    expect(activeIsha[0].progress).toBe(0.0);
    expect(activeIsha[0].startTime.getTime()).toBe(ishaDate.getTime());
  });

  it('empirically stress-tests western longitudes across half-open window boundary [isha, isha + 4m)', () => {
    const schedOct4 = calculatePrayerTimes(
      honolulu.latitude,
      honolulu.longitude,
      new Date('2026-10-04T12:00:00Z'),
      { convention: 'UmmAlQura', madhab: 'Shafi' }
    );
    const ishaTime = schedOct4.isha.date!.getTime();
    const durationMs = 4 * 60 * 1000;

    // t - 1ms
    expect(engine.getActiveEvents(new Date(ishaTime - 1)).length).toBe(0);

    // t
    const atStart = engine.getActiveEvents(new Date(ishaTime));
    expect(atStart.length).toBe(1);
    expect(atStart[0].progress).toBe(0.0);

    // t + 2m
    const atMid = engine.getActiveEvents(new Date(ishaTime + 2 * 60 * 1000));
    expect(atMid.length).toBe(1);
    expect(atMid[0].progress).toBeCloseTo(0.5, 5);

    // t + 4m - 1ms
    const atLastMs = engine.getActiveEvents(new Date(ishaTime + durationMs - 1));
    expect(atLastMs.length).toBe(1);
    expect(atLastMs[0].progress).toBe((durationMs - 1) / durationMs);

    // t + 4m
    expect(engine.getActiveEvents(new Date(ishaTime + durationMs)).length).toBe(0);
  });

  it('empirically verifies getNextEvent for western longitudes queried from UTC date D+1 before previous civil evening prayers', () => {
    // At UTC 2026-10-05T01:00:00Z:
    // In Honolulu, local time is 2026-10-04 15:00 HST (afternoon of Oct 4).
    // Asr or Maghrib is still pending on civil date Oct 4!
    const queryInstant = new Date('2026-10-05T01:00:00Z');
    const nextEvent = engine.getNextEvent(0, queryInstant);

    expect(nextEvent).not.toBeNull();
    // Maghrib occurs at ~04:18 UTC on Oct 5. It must NOT skip directly to Oct 5 Fajr!
    expect(['asr', 'maghrib']).toContain(nextEvent?.prayer);
    expect(nextEvent!.date.getTime()).toBeGreaterThan(queryInstant.getTime());

    // Next event after Maghrib (e.g. at 2026-10-05T04:30:00Z) MUST be Isha from the Oct 4 civil schedule
    const postMaghrib = new Date('2026-10-05T04:30:00Z');
    const nextAfterMaghrib = engine.getNextEvent(0, postMaghrib);
    expect(nextAfterMaghrib).not.toBeNull();
    expect(nextAfterMaghrib?.prayer).toBe('isha');
  });

  it('empirically verifies getEventsInWindow captures Honolulu Maghrib and Isha across UTC midnight', () => {
    // Window on UTC 5 October: 03:00 to 07:00 UTC
    const winStart = new Date('2026-10-05T03:00:00Z');
    const winEnd = new Date('2026-10-05T07:00:00Z');

    const windowEvents = engine.getEventsInWindow(winStart, winEnd, 0);

    // Must capture both Maghrib (~04:18 UTC) and Isha (~05:48 UTC) from Oct 4 civil schedule
    expect(windowEvents.length).toBe(2);
    expect(windowEvents[0].prayer).toBe('maghrib');
    expect(windowEvents[1].prayer).toBe('isha');
    expect(windowEvents[0].date.getTime()).toBeLessThan(windowEvents[1].date.getTime());
  });

  it('empirically verifies multi-city western longitudes crossing UTC midnight (Pago Pago, Anchorage, Papeete)', () => {
    const westernCities: Settlement[] = [
      {
        name: 'Pago Pago',
        nameAr: 'باغو باغو',
        latitude: -14.28,
        longitude: -170.70,
        countryCode: 'AS',
        population: 3600,
        timezone: 'Pacific/Pago_Pago',
      },
      {
        name: 'Anchorage',
        nameAr: 'أنكوريج',
        latitude: 61.22,
        longitude: -149.90,
        countryCode: 'US',
        population: 290000,
        timezone: 'America/Anchorage',
      },
      {
        name: 'Papeete',
        nameAr: 'بابيتي',
        latitude: -17.54,
        longitude: -149.57,
        countryCode: 'PF',
        population: 26000,
        timezone: 'Pacific/Tahiti',
      },
    ];

    const westernEngine = new AdhanEventEngine(westernCities, {
      convention: 'MuslimWorldLeague',
      madhab: 'Shafi',
      adhanDurationMinutes: 4,
    });

    for (let i = 0; i < westernCities.length; i++) {
      const city = westernCities[i];
      const sched = calculatePrayerTimes(
        city.latitude,
        city.longitude,
        new Date('2026-10-04T12:00:00Z'),
        { convention: 'MuslimWorldLeague', madhab: 'Shafi' }
      );

      const ishaDate = sched.isha.date!;
      expect(ishaDate.getUTCDate()).toBe(5); // Crossed into UTC 5 October

      const active = westernEngine.getActiveEvents(ishaDate);
      const match = active.find((e) => e.settlementIndex === i);
      expect(match).toBeDefined();
      expect(match?.prayer).toBe('isha');
      expect(match?.progress).toBe(0.0);
    }
  });
});

describe('Challenger M3 Suite 3: Lookahead getNextEvent Across Date Boundaries and Equation of Time Oracle', () => {
  const mecca: Settlement = {
    name: 'Mecca',
    nameAr: 'مكة المكرمة',
    latitude: 21.42,
    longitude: 39.83,
    countryCode: 'SA',
    population: 2000000,
    timezone: 'Asia/Riyadh',
  };

  const engine = new AdhanEventEngine([mecca], {
    convention: 'UmmAlQura',
    madhab: 'Shafi',
    adhanDurationMinutes: 4,
  });

  it('empirically verifies lookahead recomputes exact solar ephemeris differing from static 24h by non-zero ephemeris drift', () => {
    // Query after Isha on 2026-10-04
    const lateNight = new Date('2026-10-04T22:00:00Z');
    const nextEvent = engine.getNextEvent(0, lateNight);

    expect(nextEvent).not.toBeNull();
    expect(nextEvent?.prayer).toBe('fajr');

    // Independent ground-truth calculation for 2026-10-05
    const schedTomorrow = calculatePrayerTimes(
      mecca.latitude,
      mecca.longitude,
      new Date('2026-10-05T12:00:00Z'),
      { convention: 'UmmAlQura', madhab: 'Shafi' }
    );
    const exactTomorrowFajr = schedTomorrow.fajr.date!;

    // getNextEvent must match exact astronomical calculation with 0 ms error
    expect(nextEvent?.date.getTime()).toBe(exactTomorrowFajr.getTime());

    // Compare against naive static +24h addition
    const schedToday = calculatePrayerTimes(
      mecca.latitude,
      mecca.longitude,
      new Date('2026-10-04T12:00:00Z'),
      { convention: 'UmmAlQura', madhab: 'Shafi' }
    );
    const staticFajrMs = schedToday.fajr.date!.getTime() + 86400000;
    const diffMs = Math.abs(exactTomorrowFajr.getTime() - staticFajrMs);

    // Ephemeris difference must be physically non-zero (exceeds 5000 ms)
    expect(diffMs).toBeGreaterThan(5000);
  });

  it('empirically verifies Dhuhr difference across date boundary strictly equals the physical Equation of Time difference', () => {
    // Dhuhr is purely astronomical solar noon plus safety offset.
    // solarNoon = utcMidnight + (12 - lon/15 - eot/60) * 3600000.
    // Therefore: dhuhr(D+1) - (dhuhr(D) + 86400000) === -(eot(D+1) - eot(D)) * 60000.
    const date1 = new Date('2026-10-04T12:00:00Z');
    const date2 = new Date('2026-10-05T12:00:00Z');

    const sched1 = calculatePrayerTimes(mecca.latitude, mecca.longitude, date1);
    const sched2 = calculatePrayerTimes(mecca.latitude, mecca.longitude, date2);

    const dhuhr1Ms = sched1.dhuhr.date!.getTime();
    const dhuhr2Ms = sched2.dhuhr.date!.getTime();

    const actualDhuhrDeltaMs = dhuhr2Ms - (dhuhr1Ms + 86400000);

    const eot1 = getEquationOfTime(date1);
    const eot2 = getEquationOfTime(date2);
    const expectedDeltaMs = -(eot2 - eot1) * 60000;

    // Must match within 100 milliseconds (numerical precision of solar ephemeris)
    expect(Math.abs(actualDhuhrDeltaMs - expectedDeltaMs)).toBeLessThan(100);
  });

  it('empirically verifies continuous multi-day event progression maintains strict monotonicity and prayer sequence', () => {
    let currentInstant = new Date('2026-10-04T00:00:00Z');
    const expectedCycle: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    let previousTime = currentInstant.getTime();
    let cycleIndex = 0; // First expected prayer on Oct 4 morning is Fajr

    // Step through 15 consecutive prayers (3 full days)
    for (let step = 0; step < 15; step++) {
      const next = engine.getNextEvent(0, currentInstant);
      expect(next).not.toBeNull();

      // 1. Strict monotonicity
      expect(next!.date.getTime()).toBeGreaterThan(previousTime);

      // 2. Expected cyclic prayer name
      expect(next!.prayer).toBe(expectedCycle[cycleIndex % 5]);

      previousTime = next!.date.getTime();
      cycleIndex++;

      // Advance clock 1 millisecond past the event to find the subsequent prayer
      currentInstant = new Date(next!.date.getTime() + 1);
    }
  });

  it('empirically verifies getNextEvent returns null when all events are exhausted or unresolvable', () => {
    // Empty engine
    const emptyEngine = new AdhanEventEngine([]);
    expect(emptyEngine.getNextEvent(0, new Date())).toBeNull();

    // Out of range settlement index
    expect(engine.getNextEvent(999, new Date())).toBeNull();
  });
});

describe('Challenger M3 Suite 4: Schedule Cache Consistency, Invalidation, and Eviction Stress Test', () => {
  const cairo: Settlement = {
    name: 'Cairo',
    nameAr: 'القاهرة',
    latitude: 30.04,
    longitude: 31.24,
    countryCode: 'EG',
    population: 10000000,
    timezone: 'Africa/Cairo',
  };

  it('empirically verifies cache key uniqueness across all permutation dimensions', () => {
    const lat = 30.04;
    const lon = 31.24;
    const midnight = 1791072000000;

    const base = buildScheduleCacheKey(lat, lon, midnight, 'UmmAlQura', 'Shafi', 'MiddleOfTheNight');
    const diffMadhab = buildScheduleCacheKey(lat, lon, midnight, 'UmmAlQura', 'Hanafi', 'MiddleOfTheNight');
    const diffConv = buildScheduleCacheKey(lat, lon, midnight, 'Egyptian', 'Shafi', 'MiddleOfTheNight');
    const diffRule = buildScheduleCacheKey(lat, lon, midnight, 'UmmAlQura', 'Shafi', 'AngleBased');
    const diffDate = buildScheduleCacheKey(lat, lon, midnight + 86400000, 'UmmAlQura', 'Shafi', 'MiddleOfTheNight');
    const diffLat = buildScheduleCacheKey(lat + 0.01, lon, midnight, 'UmmAlQura', 'Shafi', 'MiddleOfTheNight');
    const diffLon = buildScheduleCacheKey(lat, lon + 0.01, midnight, 'UmmAlQura', 'Shafi', 'MiddleOfTheNight');

    const set = new Set([base, diffMadhab, diffConv, diffRule, diffDate, diffLat, diffLon]);
    expect(set.size).toBe(7);
  });

  it('empirically verifies madhab mutation clears cache and updates Asr calculation without stale leakage', () => {
    const engine = new AdhanEventEngine([cairo], {
      convention: 'Egyptian',
      madhab: 'Shafi',
    });
    const queryDate = new Date('2026-10-04T12:00:00Z');

    // 1. Shafi query
    const shafiSched = engine.getSchedule(0, queryDate);
    expect(engine.getCacheSize()).toBe(1);
    const shafiAsrMs = shafiSched.asr.date!.getTime();

    // 2. Mutate to Hanafi
    engine.setMadhab('Hanafi');
    expect(engine.getCacheSize()).toBe(0); // Cache must be cleared immediately

    // 3. Hanafi query
    const hanafiSched = engine.getSchedule(0, queryDate);
    expect(engine.getCacheSize()).toBe(1);
    const hanafiAsrMs = hanafiSched.asr.date!.getTime();

    // Hanafi Asr must be strictly later than Shafi Asr by > 30 minutes
    expect(hanafiAsrMs - shafiAsrMs).toBeGreaterThan(30 * 60 * 1000);

    // 4. Mutate back to Shafi -> must recompute pure Shafi and not leak Hanafi
    engine.setMadhab('Shafi');
    expect(engine.getCacheSize()).toBe(0);

    const reloadedShafi = engine.getSchedule(0, queryDate);
    expect(reloadedShafi.asr.date!.getTime()).toBe(shafiAsrMs);
  });

  it('empirically verifies convention mutation clears cache and updates twilight angles without stale leakage', () => {
    const engine = new AdhanEventEngine([cairo], {
      convention: 'UmmAlQura',
      madhab: 'Shafi',
    });
    const queryDate = new Date('2026-10-04T12:00:00Z');

    const uaqSched = engine.getSchedule(0, queryDate);
    const uaqFajrMs = uaqSched.fajr.date!.getTime();
    const uaqIshaMs = uaqSched.isha.date!.getTime();

    // Switch to Egyptian (Fajr 19.5 deg, Isha 17.5 deg)
    engine.setConvention('Egyptian');
    expect(engine.getCacheSize()).toBe(0);

    const egSched = engine.getSchedule(0, queryDate);
    const egFajrMs = egSched.fajr.date!.getTime();
    const egIshaMs = egSched.isha.date!.getTime();

    // Egyptian Fajr (19.5 deg) is earlier than Umm Al Qura (18.5 deg)
    expect(egFajrMs).toBeLessThan(uaqFajrMs);
    // Egyptian Isha (17.5 deg) is earlier than Umm Al Qura (90 min after Maghrib)
    expect(egIshaMs).toBeLessThan(uaqIshaMs);

    // Switch to Muslim World League (Fajr 18 deg, Isha 17 deg)
    engine.setConvention('MuslimWorldLeague');
    expect(engine.getCacheSize()).toBe(0);

    const mwlSched = engine.getSchedule(0, queryDate);
    // MWL Fajr (18 deg) is later than Egyptian (19.5 deg)
    expect(mwlSched.fajr.date!.getTime()).toBeGreaterThan(egFajrMs);
  });

  it('empirically verifies high-latitude rule mutation clears cache and modifies summer twilights', () => {
    const oslo: Settlement = {
      name: 'Oslo',
      nameAr: 'أوسلو',
      latitude: 59.91,
      longitude: 10.75,
      countryCode: 'NO',
      population: 700000,
      timezone: 'Europe/Oslo',
    };

    const engine = new AdhanEventEngine([oslo], {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    const summerSolstice = new Date('2026-06-21T12:00:00Z');

    const motnSched = engine.getSchedule(0, summerSolstice);
    expect(engine.getCacheSize()).toBe(1);

    engine.setHighLatitudeRule('SeventhOfTheNight');
    expect(engine.getCacheSize()).toBe(0);

    const sotnSched = engine.getSchedule(0, summerSolstice);
    expect(engine.getCacheSize()).toBe(1);

    engine.setHighLatitudeRule('AngleBased');
    expect(engine.getCacheSize()).toBe(0);

    const angleSched = engine.getSchedule(0, summerSolstice);
    expect(engine.getCacheSize()).toBe(1);

    // AngleBased fractional night is (18/60 = 0.3) of night, differing from MiddleOfTheNight (0.5)
    expect(angleSched.fajr.date!.getTime()).not.toBe(motnSched.fajr.date!.getTime());
    expect(sotnSched.fajr.date!.getTime()).not.toBe(motnSched.fajr.date!.getTime());
  });

  it('empirically verifies bounded cache capacity eviction avoids memory unbounded growth', () => {
    const engine = new AdhanEventEngine([cairo], {
      maxCacheSize: 50,
    });

    // Populate 75 distinct days into the cache
    for (let day = 1; day <= 75; day++) {
      const date = new Date(Date.UTC(2026, 0, day, 12, 0, 0));
      engine.getSchedule(0, date);
      expect(engine.getCacheSize()).toBeLessThanOrEqual(50);
    }

    // Cache size must remain bounded at <= 50
    expect(engine.getCacheSize()).toBeLessThanOrEqual(50);
    expect(engine.getCacheSize()).toBeGreaterThan(30);

    // Re-querying an evicted day works cleanly and returns accurate results
    const day1Date = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
    const day1Sched = engine.getSchedule(0, day1Date);
    expect(day1Sched.dhuhr.date).not.toBeNull();
  });

  it('adversarially fuzzes cache with 300 random parameter combinations against independent ground-truth oracle', () => {
    const testSettlements: Settlement[] = [
      { name: 'Mecca', nameAr: 'مكة', latitude: 21.42, longitude: 39.83, countryCode: 'SA', population: 2000000, timezone: 'Asia/Riyadh' },
      { name: 'Tokyo', nameAr: 'طوكيو', latitude: 35.68, longitude: 139.76, countryCode: 'JP', population: 14000000, timezone: 'Asia/Tokyo' },
      { name: 'Honolulu', nameAr: 'هونولولو', latitude: 21.30, longitude: -157.85, countryCode: 'US', population: 350000, timezone: 'Pacific/Honolulu' },
      { name: 'London', nameAr: 'لندن', latitude: 51.51, longitude: -0.13, countryCode: 'GB', population: 9000000, timezone: 'Europe/London' },
    ];

    const engine = new AdhanEventEngine(testSettlements, { maxCacheSize: 100 });
    const conventions: CalculationConventionName[] = ['UmmAlQura', 'MuslimWorldLeague', 'Egyptian', 'Karachi'];
    const madhabs: Madhab[] = ['Shafi', 'Hanafi'];
    const rules: HighLatitudeRule[] = ['MiddleOfTheNight', 'SeventhOfTheNight', 'AngleBased'];

    // Deterministic pseudo-random sequence
    let seed = 987654321;
    function rand() {
      seed = (1103515245 * seed + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    for (let iter = 0; iter < 300; iter++) {
      const sIdx = Math.floor(rand() * testSettlements.length);
      const conv = conventions[Math.floor(rand() * conventions.length)];
      const mad = madhabs[Math.floor(rand() * madhabs.length)];
      const rule = rules[Math.floor(rand() * rules.length)];
      const dayOffset = Math.floor(rand() * 60) - 30; // +/- 30 days
      const date = new Date(Date.UTC(2026, 9, 4 + dayOffset, 12, 0, 0));

      engine.setConvention(conv);
      engine.setMadhab(mad);
      engine.setHighLatitudeRule(rule);

      const cachedSched = engine.getSchedule(sIdx, date);

      // Independent Oracle calculation without using engine
      const oracleSched = calculatePrayerTimes(
        testSettlements[sIdx].latitude,
        testSettlements[sIdx].longitude,
        date,
        { convention: conv, madhab: mad, highLatitudeRule: rule }
      );

      // Assert 0 ms discrepancy on every prayer time
      const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
      for (const p of prayers) {
        if (oracleSched[p].date === null) {
          expect(cachedSched[p].date).toBeNull();
        } else {
          expect(cachedSched[p].date?.getTime()).toBe(oracleSched[p].date?.getTime());
        }
      }
    }
  });
});

describe('Challenger M3 Suite 5: Calendar Edge Cases, Polar Robustness, and 15,000 Settlements Stress Test', () => {
  it('empirically verifies leap year rollover (2024-02-28 through 2024-03-01)', () => {
    const mecca: Settlement = {
      name: 'Mecca',
      nameAr: 'مكة',
      latitude: 21.42,
      longitude: 39.83,
      countryCode: 'SA',
      population: 2000000,
      timezone: 'Asia/Riyadh',
    };
    const engine = new AdhanEventEngine([mecca]);

    const leapDay = new Date('2024-02-29T12:00:00Z');
    const sched = engine.getSchedule(0, leapDay);
    expect(sched.dhuhr.date).not.toBeNull();
    expect(sched.dhuhr.date!.getUTCFullYear()).toBe(2024);
    expect(sched.dhuhr.date!.getUTCMonth()).toBe(1); // February
    expect(sched.dhuhr.date!.getUTCDate()).toBe(29);

    // Lookahead from 2024-02-28 evening must find 2024-02-29 Fajr
    const lateFeb28 = new Date('2024-02-28T22:00:00Z');
    const nextEvent = engine.getNextEvent(0, lateFeb28);
    expect(nextEvent?.prayer).toBe('fajr');
    expect(nextEvent?.date.getUTCDate()).toBe(29);
  });

  it('empirically verifies calendar year boundary (2026-12-31 to 2027-01-01)', () => {
    const tokyo: Settlement = {
      name: 'Tokyo',
      nameAr: 'طوكيو',
      latitude: 35.68,
      longitude: 139.76,
      countryCode: 'JP',
      population: 14000000,
      timezone: 'Asia/Tokyo',
    };
    const engine = new AdhanEventEngine([tokyo]);

    // In Tokyo, 2027-01-01 Fajr occurs on 2026-12-31 UTC
    const schedJan1 = calculatePrayerTimes(35.68, 139.76, new Date('2027-01-01T12:00:00Z'));
    const fajrTime = schedJan1.fajr.date!;
    expect(fajrTime.getUTCFullYear()).toBe(2026);
    expect(fajrTime.getUTCMonth()).toBe(11); // December
    expect(fajrTime.getUTCDate()).toBe(31);

    const active = engine.getActiveEvents(fajrTime);
    expect(active.length).toBe(1);
    expect(active[0].prayer).toBe('fajr');
    expect(active[0].progress).toBe(0.0);
  });

  it('empirically verifies polar night robustness: Tromsø winter (unresolved twilight produces zero active events)', () => {
    const tromso: Settlement = {
      name: 'Tromsø',
      nameAr: 'ترومسو',
      latitude: 69.65,
      longitude: 18.96,
      countryCode: 'NO',
      population: 75000,
      timezone: 'Europe/Oslo',
    };

    const engine = new AdhanEventEngine([tromso], {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });

    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const sched = engine.getSchedule(0, winterSolstice);

    // In deep polar night with standard rules, sunrise and sunset are unresolved
    expect(sched.sunrise.provenance).toBe('unresolved');
    expect(sched.sunset.provenance).toBe('unresolved');

    // Query active events during winter solstice midnight: must not crash or activate fake events
    const midnightQuery = new Date('2026-12-21T00:00:00Z');
    const active = engine.getActiveEvents(midnightQuery);
    expect(active.length).toBe(0);
  });

  it(
    'empirically stress-tests full 15,000 settlements dataset at Tokyo W06 query instant',
    { timeout: 30000 },
    () => {
      const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
      const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
      const settlements = parseSettlements(rawData);

      expect(settlements.length).toBe(15000);

      const largeEngine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        adhanDurationMinutes: 4,
      });

      const queryInstant = new Date('2026-10-04T19:12:01.579Z');

      // Execute on all 15,000 settlements
      const t0 = performance.now();
      const active = largeEngine.getActiveEvents(queryInstant);
      const dt = performance.now() - t0;

      // Must complete without error
      expect(active.length).toBeGreaterThan(0);

      // Verify Tokyo is present in active events
      const tokyo = settlements.findIndex((s) => s.name === 'Tokyo');
      expect(tokyo).toBeGreaterThanOrEqual(0);

      const tokyoActive = active.find((e) => e.settlementIndex === tokyo);
      expect(tokyoActive).toBeDefined();
      expect(tokyoActive?.prayer).toBe('fajr');
      expect(tokyoActive?.progress).toBeGreaterThanOrEqual(0.0);
      expect(tokyoActive?.progress).toBeLessThan(0.2);

      // Subsequent query should hit cache and run substantially faster
      const tWarm = performance.now();
      const activeWarm = largeEngine.getActiveEvents(queryInstant);
      const dtWarm = performance.now() - tWarm;

      expect(activeWarm.length).toBe(active.length);
      expect(dtWarm).toBeLessThan(dt);
    }
  );
});
