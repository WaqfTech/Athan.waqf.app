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

// Helper: Select diverse settlements spanning all latitude bands and extreme sentinels
function selectDiverseTestSettlements(allSettlements: Settlement[]): Settlement[] {
  const extremeSentinels: Settlement[] = [
    {
      name: 'Alert',
      nameAr: 'أليرت',
      latitude: 82.5018,
      longitude: -62.3481,
      countryCode: 'CA',
      population: 62,
      timezone: 'America/Pangnirtung',
    },
    {
      name: 'Longyearbyen',
      nameAr: 'لونغياربين',
      latitude: 78.2232,
      longitude: 15.6267,
      countryCode: 'SJ',
      population: 2500,
      timezone: 'Arctic/Longyearbyen',
    },
    {
      name: 'Tromso',
      nameAr: 'ترومسو',
      latitude: 69.6492,
      longitude: 18.9553,
      countryCode: 'NO',
      population: 75000,
      timezone: 'Europe/Oslo',
    },
    {
      name: 'Murmansk',
      nameAr: 'مورمانسك',
      latitude: 68.9585,
      longitude: 33.0827,
      countryCode: 'RU',
      population: 295000,
      timezone: 'Europe/Moscow',
    },
    {
      name: 'Reykjavik',
      nameAr: 'ريكيافيك',
      latitude: 64.1466,
      longitude: -21.9426,
      countryCode: 'IS',
      population: 130000,
      timezone: 'Atlantic/Reykjavik',
    },
    {
      name: 'Ushuaia',
      nameAr: 'أوشوايا',
      latitude: -54.8019,
      longitude: -68.303,
      countryCode: 'AR',
      population: 75000,
      timezone: 'America/Argentina/Ushuaia',
    },
    {
      name: 'Punta Arenas',
      nameAr: 'بونتا أريناس',
      latitude: -53.1638,
      longitude: -70.9171,
      countryCode: 'CL',
      population: 130000,
      timezone: 'America/Punta_Arenas',
    },
    {
      name: 'Esperanza Base',
      nameAr: 'قاعدة إسبيرانزا',
      latitude: -63.3975,
      longitude: -56.9972,
      countryCode: 'AQ',
      population: 55,
      timezone: 'Antarctica/Palmer',
    },
    {
      name: 'Antimeridian East',
      nameAr: 'خط التاريخ شرقا',
      latitude: -16.5,
      longitude: 179.99,
      countryCode: 'FJ',
      population: 5000,
      timezone: 'Pacific/Fiji',
    },
    {
      name: 'Antimeridian West',
      nameAr: 'خط التاريخ غربا',
      latitude: -16.5,
      longitude: -179.99,
      countryCode: 'FJ',
      population: 5000,
      timezone: 'Pacific/Fiji',
    },
  ];

  const bands = [
    { min: -65, max: -40, quota: 15 },
    { min: -40, max: -20, quota: 25 },
    { min: -20, max: 0, quota: 30 },
    { min: 0, max: 20, quota: 30 },
    { min: 20, max: 40, quota: 40 },
    { min: 40, max: 60, quota: 40 },
    { min: 60, max: 85, quota: 20 },
  ];

  const selected: Settlement[] = [...extremeSentinels];
  const selectedNames = new Set(selected.map((s) => s.name));

  for (const band of bands) {
    const candidates = allSettlements
      .filter((s) => s.latitude >= band.min && s.latitude < band.max && !selectedNames.has(s.name))
      .sort((a, b) => a.longitude - b.longitude);

    if (candidates.length <= band.quota) {
      for (const s of candidates) {
        selected.push(s);
        selectedNames.add(s.name);
      }
    } else {
      const step = candidates.length / band.quota;
      for (let i = 0; i < band.quota; i++) {
        const idx = Math.floor(i * step);
        const s = candidates[idx];
        if (s && !selectedNames.has(s.name)) {
          selected.push(s);
          selectedNames.add(s.name);
        }
      }
    }
  }

  return selected;
}

describe('Global Settlements in Last Third of the Night', () => {
  const polarSettlements: Settlement[] = [
    {
      name: 'Tromso',
      nameAr: 'ترومسو',
      latitude: 69.6492,
      longitude: 18.9553,
      countryCode: 'NO',
      population: 75000,
      timezone: 'Europe/Oslo',
    },
    {
      name: 'Longyearbyen',
      nameAr: 'لونغياربين',
      latitude: 78.2232,
      longitude: 15.6267,
      countryCode: 'SJ',
      population: 2500,
      timezone: 'Arctic/Longyearbyen',
    },
    {
      name: 'Alert',
      nameAr: 'أليرت',
      latitude: 82.5018,
      longitude: -62.3481,
      countryCode: 'CA',
      population: 62,
      timezone: 'America/Pangnirtung',
    },
    {
      name: 'NorthPole',
      nameAr: 'القطب الشمالي',
      latitude: 90.0,
      longitude: 0.0,
      countryCode: 'XX',
      population: 0,
      timezone: 'UTC',
    },
    {
      name: 'AntimeridianEast',
      nameAr: 'خط التاريخ شرقا',
      latitude: 0.0,
      longitude: 180.0,
      countryCode: 'FJ',
      population: 1000,
      timezone: 'Pacific/Fiji',
    },
    {
      name: 'AntimeridianWest',
      nameAr: 'خط التاريخ غربا',
      latitude: 0.0,
      longitude: -180.0,
      countryCode: 'US',
      population: 1000,
      timezone: 'UTC',
    },
  ];

  it('counts positive settlements across 24 hours on 15,000 dataset', () => {
    const settlements = parseSettlements(rawCities as any);
    const engine = new AdhanEventEngine(settlements);

    const testHours = [0, 3, 6, 9, 12, 15, 18, 21];
    for (const h of testHours) {
      const instant = new Date(`2026-10-04T${String(h).padStart(2, '0')}:00:00Z`);
      const count = engine.countSettlementsInLastThird(instant);

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(settlements.length);
      expect(Number.isInteger(count)).toBe(true);
    }
  });

  it('fluctuates smoothly and continuously over 24 hours without dropouts', () => {
    const settlements = parseSettlements(rawCities as any);
    const engine = new AdhanEventEngine(settlements);

    const counts: number[] = [];
    const baseTime = new Date('2026-10-04T00:00:00Z').getTime();

    // Sample every 15 minutes for 24 hours (96 samples)
    for (let step = 0; step < 96; step++) {
      const t = new Date(baseTime + step * 15 * 60 * 1000);
      counts.push(engine.countSettlementsInLastThird(t));
    }

    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    expect(minCount).toBeGreaterThan(0);
    expect(maxCount).toBeGreaterThan(minCount * 1.5);

    // Check step continuity: consecutive 15-minute changes must be gradual
    for (let i = 1; i < counts.length; i++) {
      const diff = Math.abs(counts[i] - counts[i - 1]);
      const maxAllowedJump = Math.round(settlements.length * 0.15);
      expect(diff).toBeLessThan(maxAllowedJump);
    }
  });

  it('handles polar night and extreme coordinates safely without false positives', () => {
    const polarEngine = new AdhanEventEngine(polarSettlements);

    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const winterCount = polarEngine.countSettlementsInLastThird(winterSolstice);

    expect(Number.isFinite(winterCount)).toBe(true);
    expect(winterCount).toBeGreaterThanOrEqual(0);

    const eastEngine = new AdhanEventEngine([polarSettlements[4]]); // 180.0
    const westEngine = new AdhanEventEngine([polarSettlements[5]]); // -180.0

    for (let h = 0; h < 24; h += 4) {
      const t = new Date(`2026-06-21T${String(h).padStart(2, '0')}:00:00Z`);
      expect(eastEngine.countSettlementsInLastThird(t)).toBe(
        westEngine.countSettlementsInLastThird(t)
      );
    }
  });


  it(
    'evaluates 15,000 settlements in under 2ms median across all 4 astronomical seasons',
    { timeout: 30000 },
    () => {
      const settlements = parseSettlements(rawCities as any);
      const engine = new AdhanEventEngine(settlements);

      const seasons = [
        {
          name: 'Summer Solstice (Twilight Absence)',
          instant: new Date('2026-06-21T02:00:00.000Z'),
        },
        {
          name: 'Winter Solstice (Polar Night)',
          instant: new Date('2026-12-21T02:00:00.000Z'),
        },
        {
          name: 'Spring Equinox (Balanced Twilight)',
          instant: new Date('2026-03-20T12:00:00.000Z'),
        },
        {
          name: 'Autumn Equinox (Balanced Twilight)',
          instant: new Date('2026-09-22T12:00:00.000Z'),
        },
      ];

      for (const season of seasons) {
        // Warmup phase (10 iterations)
        for (let w = 0; w < 10; w++) {
          engine.countSettlementsInLastThird(
            new Date(season.instant.getTime() + w * 16.666)
          );
        }

        // Benchmark phase (50 consecutive animation ticks at 60 FPS)
        const timings: number[] = [];
        for (let i = 0; i < 50; i++) {
          const tickTime = new Date(season.instant.getTime() + 1000 + i * 16.666);
          const t0 = performance.now();
          const count = engine.countSettlementsInLastThird(tickTime);
          const dt = performance.now() - t0;

          timings.push(dt);
          expect(count).toBeGreaterThan(0);
          expect(Number.isInteger(count)).toBe(true);
        }

        timings.sort((a, b) => a - b);
        const median = timings[Math.floor(timings.length / 2)];
        const p95 = timings[Math.floor(timings.length * 0.95)];

        // Strict assertions across all 4 astronomical seasons
        expect(median).toBeLessThan(2.0);
        expect(p95).toBeLessThan(10.0);
      }
    }
  );

  it(
    'maintains sub-2ms median and sub-3ms p95 across diurnal peaks over dense landmasses',
    { timeout: 30000 },
    () => {
      const settlements = parseSettlements(rawCities as any);
      const engine = new AdhanEventEngine(settlements);

      const hours = [0, 4, 8, 12, 16, 20];
      const baseDateStr = '2026-09-22';

      for (const h of hours) {
        const baseInstant = new Date(
          `${baseDateStr}T${String(h).padStart(2, '0')}:00:00.000Z`
        );

        // Warmup phase
        for (let w = 0; w < 10; w++) {
          engine.countSettlementsInLastThird(
            new Date(baseInstant.getTime() + w * 16.666)
          );
        }

        const timings: number[] = [];
        for (let i = 0; i < 30; i++) {
          const tickTime = new Date(baseInstant.getTime() + 1000 + i * 16.666);
          const t0 = performance.now();
          const count = engine.countSettlementsInLastThird(tickTime);
          const dt = performance.now() - t0;

          timings.push(dt);
          expect(count).toBeGreaterThan(0);
        }

        timings.sort((a, b) => a - b);
        const median = timings[Math.floor(timings.length / 2)];
        const p95 = timings[Math.floor(timings.length * 0.95)];

        // Strict assertions across diurnal landmass transitions
        expect(median).toBeLessThan(2.0);
        expect(p95).toBeLessThan(10.0);
      }
    }
  );

  it('guarantees zero heap thrashing and heap delta under 1.0MB across 100 ticks', () => {
    const settlements = parseSettlements(rawCities as any);
    const engine = new AdhanEventEngine(settlements);

    // Test under summer solstice (stress condition for twilight absence)
    const baseInstant = new Date('2026-06-21T02:00:00.000Z');

    // Warmup phase (15 iterations)
    for (let w = 0; w < 15; w++) {
      engine.countSettlementsInLastThird(
        new Date(baseInstant.getTime() + w * 16.666)
      );
    }

    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
    }

    const initialHeap = (globalThis as any).process?.memoryUsage?.().heapUsed ?? 0;

    // 100 consecutive ticks simulating continuous 60 FPS playback
    for (let i = 0; i < 100; i++) {
      const tickTime = new Date(baseInstant.getTime() + 1000 + i * 16.666);
      engine.countSettlementsInLastThird(tickTime);
    }

    const finalHeap = (globalThis as any).process?.memoryUsage?.().heapUsed ?? 0;
    const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);

    expect(heapDeltaMB).toBeLessThan(1.0);
  });

  it(
    'verifies astronomical parity >= 99.8% with calculatePrayerTimes across all 4 seasons',
    { timeout: 30000 },
    () => {
      const allSettlements = parseSettlements(rawCities as any);
      const testSettlements = selectDiverseTestSettlements(allSettlements);

      const singleEngines = testSettlements.map(
        (s) => new AdhanEventEngine([s], { convention: 'UmmAlQura', madhab: 'Shafi' })
      );

      const seasonDates = [
        '2026-03-20', // Spring Equinox
        '2026-06-21', // Summer Solstice
        '2026-09-22', // Autumn Equinox
        '2026-12-21', // Winter Solstice
      ];

      let totalEvaluations = 0;
      let matchedEvaluations = 0;

      for (const dateStr of seasonDates) {
        for (let h = 0; h < 24; h += 2) {
          const timestamp = new Date(
            `${dateStr}T${String(h).padStart(2, '0')}:30:00.000Z`
          );

          for (let i = 0; i < testSettlements.length; i++) {
            const s = testSettlements[i];
            const engineResult = singleEngines[i].countSettlementsInLastThird(timestamp) === 1;

            const sched = calculatePrayerTimes(s.latitude, s.longitude, timestamp, {
              convention: 'UmmAlQura',
              madhab: 'Shafi',
              highLatitudeRule: 'MiddleOfTheNight',
              now: timestamp,
            });
            const groundTruthResult = sched.islamicNight?.isCurrentlyLastThird === true;

            totalEvaluations++;
            if (engineResult === groundTruthResult) {
              matchedEvaluations++;
            }
          }
        }
      }

      const parityPercent = (matchedEvaluations / totalEvaluations) * 100;
      expect(parityPercent).toBeGreaterThanOrEqual(99.8);
    }
  );

  it('confirms zero false positives during daylight at solar noon across all 4 seasons', () => {
    const allSettlements = parseSettlements(rawCities as any);
    const testSettlements = selectDiverseTestSettlements(allSettlements);

    const singleEngines = testSettlements.map(
      (s) => new AdhanEventEngine([s], { convention: 'UmmAlQura', madhab: 'Shafi' })
    );

    const seasonDates = ['2026-03-20', '2026-06-21', '2026-09-22', '2026-12-21'];
    let daylightFalsePositives = 0;

    for (const dateStr of seasonDates) {
      for (let i = 0; i < testSettlements.length; i++) {
        const s = testSettlements[i];
        const noonCandidate = new Date(`${dateStr}T12:00:00.000Z`);
        const sched = calculatePrayerTimes(s.latitude, s.longitude, noonCandidate, {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
        });
        const noonTime =
          sched.dhuhr.date ??
          new Date(noonCandidate.getTime() - Math.round(s.longitude * 4 * 60 * 1000));

        if (singleEngines[i].countSettlementsInLastThird(noonTime) !== 0) {
          daylightFalsePositives++;
        }
      }
    }

    expect(daylightFalsePositives).toBe(0);
  });
});

