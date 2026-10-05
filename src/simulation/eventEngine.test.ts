import { describe, it, expect } from 'vitest';
import { SimulationClock } from './clock';
import { AdhanEventEngine, buildScheduleCacheKey } from './eventEngine';
import { Settlement, parseSettlements } from '../population/loader';
import { calculatePrayerTimes } from '../prayer/calculator';
import rawCities from '../../public/data/cities-core.json';

describe('Simulation Clock', () => {
  it('advances time according to speed multiplier', () => {
    const start = new Date('2026-10-04T12:00:00Z');
    const clock = new SimulationClock(start);
    clock.setSpeed(60); // 60x speed

    // Tick 1 real second
    const newTime = clock.tick(1.0);
    expect(newTime.getTime() - start.getTime()).toBe(60000); // 60 simulated seconds = 1 minute
  });

  it('pauses when speed is 0', () => {
    const start = new Date('2026-10-04T12:00:00Z');
    const clock = new SimulationClock(start);
    clock.setSpeed(0);

    const newTime = clock.tick(5.0);
    expect(newTime.getTime()).toBe(start.getTime());
  });
});

describe('Adhan Event Engine', () => {
  const sampleSettlements: Settlement[] = [
    {
      name: 'Mecca',
      nameAr: 'مكة المكرمة',
      latitude: 21.42,
      longitude: 39.83,
      countryCode: 'SA',
      population: 2000000,
      timezone: 'Asia/Riyadh',
    },
    {
      name: 'Jakarta',
      nameAr: 'جاكرتا',
      latitude: -6.21,
      longitude: 106.85,
      countryCode: 'ID',
      population: 11000000,
      timezone: 'Asia/Jakarta',
    },
    {
      name: 'Tokyo',
      nameAr: 'طوكيو',
      latitude: 35.68,
      longitude: 139.76,
      countryCode: 'JP',
      population: 14000000,
      timezone: 'Asia/Tokyo',
    },
    {
      name: 'Honolulu',
      nameAr: 'هونولولو',
      latitude: 21.31,
      longitude: -157.86,
      countryCode: 'US',
      population: 350000,
      timezone: 'Pacific/Honolulu',
    },
  ];

  const engine = new AdhanEventEngine(sampleSettlements, {
    adhanDurationMinutes: 4,
  });

  it('marks settlement active at exact prayer time', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const meccaSched = calculatePrayerTimes(21.42, 39.83, date);

    expect(meccaSched.dhuhr.date).not.toBeNull();
    // Test exactly at Dhuhr
    const activeAtDhuhr = engine.getActiveEvents(meccaSched.dhuhr.date!);
    const meccaEvent = activeAtDhuhr.find((e) => e.settlementIndex === 0);

    expect(meccaEvent).toBeDefined();
    expect(meccaEvent?.prayer).toBe('dhuhr');
    expect(meccaEvent?.progress).toBeCloseTo(0.0, 2);
    expect(meccaEvent?.eventId).toBeDefined();
  });

  it('marks settlement inactive after adhan duration ends', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const meccaSched = calculatePrayerTimes(21.42, 39.83, date);

    expect(meccaSched.dhuhr.date).not.toBeNull();
    // 5 minutes after Dhuhr (duration is 4 min)
    const afterDhuhr = new Date(meccaSched.dhuhr.date!.getTime() + 5 * 60000);
    const activeAfter = engine.getActiveEvents(afterDhuhr);
    const meccaEvent = activeAfter.find((e) => e.settlementIndex === 0);

    expect(meccaEvent).toBeUndefined();
  });

  it('resolves Tokyo W06: 5 October schedule Fajr at 2026-10-04T19:12:01.579Z returns active event', () => {
    // Tokyo (35.68, 139.76): 5 October schedule Fajr occurs at 2026-10-04T19:12:01.579Z.
    // At this UTC instant, the UTC date is 4 October, but candidate date enumeration includes 5 October.
    const queryInstant = new Date('2026-10-04T19:12:01.579Z');
    const activeEvents = engine.getActiveEvents(queryInstant);
    const tokyoEvent = activeEvents.find((e) => e.settlementIndex === 2);

    expect(tokyoEvent).toBeDefined();
    expect(tokyoEvent?.prayer).toBe('fajr');
    expect(tokyoEvent?.progress).toBeGreaterThanOrEqual(0.0);
    expect(tokyoEvent?.progress).toBeLessThan(1.0);
    expect(tokyoEvent?.eventId).toContain('2:fajr:');
  });

  it('captures adjoining western date: Honolulu 4 October schedule Isha on UTC 5 October', () => {
    // Honolulu (21.31, -157.86): 4 October schedule Isha falls into early UTC hours of 5 October
    const schedOct4 = calculatePrayerTimes(21.31, -157.86, new Date('2026-10-04T12:00:00Z'));
    expect(schedOct4.isha.date).not.toBeNull();
    const ishaTime = schedOct4.isha.date!;

    // Query at exact Isha time (which is on UTC date 5 October)
    const activeEvents = engine.getActiveEvents(ishaTime);
    const honoluluEvent = activeEvents.find((e) => e.settlementIndex === 3);

    expect(honoluluEvent).toBeDefined();
    expect(honoluluEvent?.prayer).toBe('isha');
  });

  it('verifies strict half-open interval boundaries [start, start + duration)', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const meccaSched = calculatePrayerTimes(21.42, 39.83, date);
    const dhuhrMs = meccaSched.dhuhr.date!.getTime();
    const durationMs = 4 * 60 * 1000;

    // Boundary 1: Exact start instant (t = start) -> active with progress = 0.0
    const atStart = engine.getActiveEvents(new Date(dhuhrMs));
    const evStart = atStart.find((e) => e.settlementIndex === 0);
    expect(evStart).toBeDefined();
    expect(evStart?.progress).toBe(0.0);

    // Boundary 2: Midpoint instant (t = start + duration / 2) -> active with progress = 0.5
    const atMid = engine.getActiveEvents(new Date(dhuhrMs + durationMs / 2));
    const evMid = atMid.find((e) => e.settlementIndex === 0);
    expect(evMid).toBeDefined();
    expect(evMid?.progress).toBeCloseTo(0.5, 3);

    // Boundary 3: Final millisecond before expiry (t = start + duration - 1ms) -> active
    const atLastMs = engine.getActiveEvents(new Date(dhuhrMs + durationMs - 1));
    const evLastMs = atLastMs.find((e) => e.settlementIndex === 0);
    expect(evLastMs).toBeDefined();
    expect(evLastMs?.progress).toBeLessThan(1.0);

    // Boundary 4: Exact end instant (t = start + duration) -> inactive
    const atEnd = engine.getActiveEvents(new Date(dhuhrMs + durationMs));
    const evEnd = atEnd.find((e) => e.settlementIndex === 0);
    expect(evEnd).toBeUndefined();
  });

  it('recomputes exact solar ephemeris in getNextEvent without static +24h additions', () => {
    // Query after Isha on 2026-10-04 to trigger next-day Fajr lookahead
    const lateNight = new Date('2026-10-04T22:00:00Z');
    const nextEvent = engine.getNextEvent(0, lateNight);

    expect(nextEvent).not.toBeNull();
    expect(nextEvent?.prayer).toBe('fajr');

    // Compare nextEvent date against tomorrow's calculated Fajr vs static +24h
    const schedTomorrow = calculatePrayerTimes(21.42, 39.83, new Date('2026-10-05T12:00:00Z'));
    const exactTomorrowFajr = schedTomorrow.fajr.date!;

    expect(nextEvent?.date.getTime()).toBe(exactTomorrowFajr.getTime());

    // Verify that static +24h from today's Fajr has non-zero drift vs exact ephemeris
    const schedToday = calculatePrayerTimes(21.42, 39.83, new Date('2026-10-04T12:00:00Z'));
    const staticFajrMs = schedToday.fajr.date!.getTime() + 86400000;
    const ephemerisDiffSec = Math.abs(exactTomorrowFajr.getTime() - staticFajrMs) / 1000;

    expect(ephemerisDiffSec).toBeGreaterThan(5.0);
  });

  it('invalidates schedule cache upon configuration update', () => {
    const testEngine = new AdhanEventEngine(sampleSettlements, {
      convention: 'MuslimWorldLeague',
      madhab: 'Shafi',
    });

    const testDate = new Date('2026-10-04T12:00:00Z');

    // Populate cache with Shafi Asr
    const shafiSched = testEngine.getSchedule(0, testDate);
    expect(testEngine.getCacheSize()).toBeGreaterThan(0);

    // Switch to Hanafi -> cache must be cleared and new Asr must be later
    testEngine.setMadhab('Hanafi');
    expect(testEngine.getCacheSize()).toBe(0);

    const hanafiSched = testEngine.getSchedule(0, testDate);
    expect(testEngine.getCacheSize()).toBeGreaterThan(0);

    expect(hanafiSched.asr.date!.getTime()).toBeGreaterThan(shafiSched.asr.date!.getTime());
  });

  it('enumerates events in multi-day window with getEventsInWindow', () => {
    const windowStart = new Date('2026-10-04T00:00:00Z');
    const windowEnd = new Date('2026-10-06T00:00:00Z'); // 48 hours

    // Only Mecca (index 0)
    const events = engine.getEventsInWindow(windowStart, windowEnd, 0);

    // Over 48 hours, Mecca should experience 10 prayer events (5 per day)
    expect(events.length).toBe(10);
    expect(events.every((ev) => ev.settlementIndex === 0)).toBe(true);

    // Events must be chronologically ordered
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date.getTime()).toBeGreaterThan(events[i - 1].date.getTime());
    }
  });

  it('builds unique composite cache keys based on calculation parameters', () => {
    const k1 = buildScheduleCacheKey(21.42, 39.83, 1000, 'UmmAlQura', 'Shafi', 'MiddleOfTheNight');
    const k2 = buildScheduleCacheKey(21.42, 39.83, 1000, 'UmmAlQura', 'Hanafi', 'MiddleOfTheNight');
    const k3 = buildScheduleCacheKey(21.42, 39.83, 1000, 'MuslimWorldLeague', 'Shafi', 'MiddleOfTheNight');
    const k4 = buildScheduleCacheKey(21.42, 39.83, 2000, 'UmmAlQura', 'Shafi', 'MiddleOfTheNight');

    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1).not.toBe(k4);
  });

  it('eliminates dead lonBins facade from engine instance', () => {
    expect((engine as unknown as { lonBins?: unknown }).lonBins).toBeUndefined();
    expect((engine as unknown as { buildSpatialBins?: unknown }).buildSpatialBins).toBeUndefined();
  });

  it(
    'achieves warm-cache latency < 150ms across full 15,000 settlements dataset',
    { timeout: 30000 },
    () => {
      const settlements = parseSettlements(rawCities as any);

      expect(settlements.length).toBe(15000);

      const largeEngine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        adhanDurationMinutes: 4,
        maxCacheSize: 60000,
      });

      const queryInstant = new Date('2026-10-04T19:12:01.579Z');

      // Pass 1: Cold cache pass
      const activeCold = largeEngine.getActiveEvents(queryInstant);
      expect(activeCold.length).toBeGreaterThan(0);

      // Verify cache contains populated entries and does not exceed maxCacheSize
      const cacheSizeCold = largeEngine.getCacheSize();
      expect(cacheSizeCold).toBeGreaterThan(0);
      expect(cacheSizeCold).toBeLessThanOrEqual(60000);

      // Pass 2: Warm cache latency pass
      const tStart = performance.now();
      const activeWarm = largeEngine.getActiveEvents(queryInstant);
      const dtWarm = performance.now() - tStart;

      expect(activeWarm.length).toBe(activeCold.length);
      expect(dtWarm).toBeLessThan(150); // Under 150ms budget

      // Cache size must remain bounded and stable without eviction thrash
      expect(largeEngine.getCacheSize()).toBe(cacheSizeCold);
    }
  );
});
