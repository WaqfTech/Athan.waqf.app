import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AdhanEventEngine } from '../src/simulation/eventEngine';
import { calculatePrayerTimes } from '../src/prayer/calculator';
import {
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from '../src/prayer/conventions';
import {
  parseSettlements,
  CompactSettlementRow,
  Settlement,
} from '../src/population/loader';
import { ActiveAdhanEvent } from '../src/globe/cities';

// Helper: load full 15,000 settlements dataset
function loadAllSettlements(): Settlement[] {
  const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
  return parseSettlements(rawData);
}

// Unpruned brute-force oracle: evaluates full 3-day candidate window [yesterday, today, tomorrow]
// for every settlement without any localHour pruning or spatial filtering.
function unpruned3DayOracle(
  settlements: Settlement[],
  date: Date,
  options: {
    convention?: CalculationConventionName;
    madhab?: Madhab;
    highLatitudeRule?: HighLatitudeRule;
    adhanDurationMs?: number;
  } = {}
): ActiveAdhanEvent[] {
  const activeEvents: ActiveAdhanEvent[] = [];
  const nowMs = date.getTime();
  const adhanDurationMs = options.adhanDurationMs ?? 4 * 60 * 1000;
  const convention = options.convention ?? 'UmmAlQura';
  const madhab = options.madhab ?? 'Shafi';
  const highLatitudeRule = options.highLatitudeRule ?? 'MiddleOfTheNight';
  const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  for (let i = 0; i < settlements.length; i++) {
    const s = settlements[i];
    const offset = Math.round(s.longitude * 240000);
    const tLocal = new Date(nowMs + offset);
    const localY = tLocal.getUTCFullYear();
    const localM = tLocal.getUTCMonth();
    const localD = tLocal.getUTCDate();

    // Pure unpruned 3-day candidate search: localD - 1, localD, localD + 1
    const candidateDays = [0, -1, 1];
    let matched = false;

    for (const dayOffset of candidateDays) {
      const candDate = new Date(Date.UTC(localY, localM, localD + dayOffset, 12, 0, 0));
      const sched = calculatePrayerTimes(s.latitude, s.longitude, candDate, {
        convention,
        madhab,
        highLatitudeRule,
      });

      for (const pKey of prayers) {
        const entry = sched[pKey];
        if (!entry || !entry.date || entry.provenance === 'unresolved') continue;
        const pTime = entry.date.getTime();
        const diff = nowMs - pTime;

        if (diff >= 0 && diff < adhanDurationMs) {
          const progress = diff / adhanDurationMs;
          activeEvents.push({
            settlementIndex: i,
            prayer: pKey as any,
            progress,
            eventId: `${i}:${pKey}:${pTime}`,
            startTime: entry.date,
            endTime: new Date(pTime + adhanDurationMs),
          });
          matched = true;
          break; // A city can only call one adhan at a time
        }
      }
      if (matched) break;
    }
  }

  return activeEvents;
}

// Fixed anchor settlements covering extreme eastern, western, polar, prime meridian, and equatorial locations
const anchorSettlements: Settlement[] = [
  { name: 'Tokyo', nameAr: 'طوكيو', latitude: 35.68, longitude: 139.76, countryCode: 'JP', population: 14000000, timezone: 'Asia/Tokyo' },
  { name: 'Sydney', nameAr: 'سيدني', latitude: -33.87, longitude: 151.21, countryCode: 'AU', population: 5300000, timezone: 'Australia/Sydney' },
  { name: 'Auckland', nameAr: 'أوكلاند', latitude: -36.85, longitude: 174.76, countryCode: 'NZ', population: 1650000, timezone: 'Pacific/Auckland' },
  { name: 'Suva', nameAr: 'سوفا', latitude: -18.14, longitude: 178.44, countryCode: 'FJ', population: 93000, timezone: 'Pacific/Fiji' },
  { name: 'Petropavlovsk', nameAr: 'بتروبافلوفسك', latitude: 53.05, longitude: 158.65, countryCode: 'RU', population: 180000, timezone: 'Asia/Kamchatka' },
  { name: 'Honolulu', nameAr: 'هونولولو', latitude: 21.31, longitude: -157.86, countryCode: 'US', population: 350000, timezone: 'Pacific/Honolulu' },
  { name: 'Pago Pago', nameAr: 'باغو باغو', latitude: -14.28, longitude: -170.70, countryCode: 'AS', population: 3600, timezone: 'Pacific/Pago_Pago' },
  { name: 'Anchorage', nameAr: 'أنكوريج', latitude: 61.22, longitude: -149.90, countryCode: 'US', population: 290000, timezone: 'America/Anchorage' },
  { name: 'Papeete', nameAr: 'بابيتي', latitude: -17.54, longitude: -149.57, countryCode: 'PF', population: 26000, timezone: 'Pacific/Tahiti' },
  { name: 'Longyearbyen', nameAr: 'لونغياربين', latitude: 78.22, longitude: 15.65, countryCode: 'SJ', population: 2400, timezone: 'Arctic/Longyearbyen' },
  { name: 'Tromsø', nameAr: 'ترومسو', latitude: 69.65, longitude: 18.96, countryCode: 'NO', population: 75000, timezone: 'Europe/Oslo' },
  { name: 'Murmansk', nameAr: 'مورمانسك', latitude: 68.97, longitude: 33.08, countryCode: 'RU', population: 295000, timezone: 'Europe/Moscow' },
  { name: 'Reykjavik', nameAr: 'ريكيافيك', latitude: 64.14, longitude: -21.94, countryCode: 'IS', population: 130000, timezone: 'Atlantic/Reykjavik' },
  { name: 'Fairbanks', nameAr: 'فيربانكس', latitude: 64.84, longitude: -147.72, countryCode: 'US', population: 31000, timezone: 'America/Anchorage' },
  { name: 'Ushuaia', nameAr: 'أوشوايا', latitude: -54.80, longitude: -68.30, countryCode: 'AR', population: 82000, timezone: 'America/Argentina/Ushuaia' },
  { name: 'London', nameAr: 'لندن', latitude: 51.51, longitude: -0.13, countryCode: 'GB', population: 9000000, timezone: 'Europe/London' },
  { name: 'Accra', nameAr: 'أكرا', latitude: 5.60, longitude: -0.19, countryCode: 'GH', population: 2500000, timezone: 'Africa/Accra' },
  { name: 'Mecca', nameAr: 'مكة المكرمة', latitude: 21.42, longitude: 39.83, countryCode: 'SA', population: 2000000, timezone: 'Asia/Riyadh' },
  { name: 'Cairo', nameAr: 'القاهرة', latitude: 30.04, longitude: 31.24, countryCode: 'EG', population: 10000000, timezone: 'Africa/Cairo' },
  { name: 'Jakarta', nameAr: 'جاكرتا', latitude: -6.21, longitude: 106.85, countryCode: 'ID', population: 11000000, timezone: 'Asia/Jakarta' },
  { name: 'Singapore', nameAr: 'سنغافورة', latitude: 1.35, longitude: 103.82, countryCode: 'SG', population: 5900000, timezone: 'Asia/Singapore' },
  { name: 'Nairobi', nameAr: 'نيروبي', latitude: -1.29, longitude: 36.82, countryCode: 'KE', population: 4400000, timezone: 'Africa/Nairobi' },
  { name: 'Quito', nameAr: 'كيتو', latitude: -0.18, longitude: -78.47, countryCode: 'EC', population: 2000000, timezone: 'America/Guayaquil' },
  { name: 'Pontianak', nameAr: 'بونتياناك', latitude: -0.03, longitude: 109.33, countryCode: 'ID', population: 670000, timezone: 'Asia/Pontianak' },
];

describe('Challenger M3 It2 Suite 1: Full 15,000 Settlements Warm-Cache Latency and Zero Eviction Benchmark', () => {
  it(
    'empirically verifies 15,000 settlements cold pass populates cache without evictions and warm pass runs in < 150ms under parallel test worker contention with ZERO cache evictions',
    { timeout: 30000 },
    () => {
      const allSettlements = loadAllSettlements();
      expect(allSettlements.length).toBe(15000);

      const engine = new AdhanEventEngine(allSettlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
        adhanDurationMinutes: 4,
        maxCacheSize: 60000,
      });

      // Spy on internal cache operations
      const cacheMap = (engine as unknown as { scheduleCache: Map<string, unknown> }).scheduleCache;
      const deleteSpy = vi.spyOn(cacheMap, 'delete');
      const setSpy = vi.spyOn(cacheMap, 'set');

      const queryInstant = new Date('2026-10-04T19:12:01.579Z');

      // --- Pass 1: Cold Cache ---
      deleteSpy.mockClear();
      setSpy.mockClear();

      const activeCold = engine.getActiveEvents(queryInstant);
      expect(activeCold.length).toBeGreaterThan(0);

      const coldCacheSize = engine.getCacheSize();
      // Candidate pruning ensures cold working set is ~18,750 entries, well below 60,000 capacity
      expect(coldCacheSize).toBeGreaterThan(10000);
      expect(coldCacheSize).toBeLessThan(35000);
      expect(coldCacheSize).toBeLessThanOrEqual(60000);

      // Cold pass MUST NOT trigger any cache evictions
      expect(deleteSpy).toHaveBeenCalledTimes(0);

      // --- Pass 2: Warm Cache Latency Benchmark ---
      deleteSpy.mockClear();
      setSpy.mockClear();

      const tWarmStart = performance.now();
      const activeWarm = engine.getActiveEvents(queryInstant);
      const dtWarm = performance.now() - tWarmStart;

      // Assert latency is under the warm budget under parallel test worker contention
      expect(dtWarm).toBeLessThan(150);

      // Assert exact identical active event count and payload
      expect(activeWarm.length).toBe(activeCold.length);

      // Assert ZERO cache evictions on warm pass
      expect(deleteSpy).toHaveBeenCalledTimes(0);

      // Assert ZERO cache misses (no new entries added to cache)
      expect(setSpy).toHaveBeenCalledTimes(0);

      // Assert cache size remained exactly constant
      expect(engine.getCacheSize()).toBe(coldCacheSize);
    }
  );

  it(
    'empirically verifies warm cache latency under continuous simulated animation frames (30 consecutive ticks)',
    { timeout: 30000 },
    () => {
      const allSettlements = loadAllSettlements();
      const engine = new AdhanEventEngine(allSettlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        maxCacheSize: 60000,
      });

      const cacheMap = (engine as unknown as { scheduleCache: Map<string, unknown> }).scheduleCache;
      const deleteSpy = vi.spyOn(cacheMap, 'delete');

      // Cold warm-up pass
      const baseInstant = new Date('2026-10-04T12:00:00.000Z');
      engine.getActiveEvents(baseInstant);

      deleteSpy.mockClear();

      const tickTimes: number[] = [];
      const numTicks = 30;

      // Simulate 30 animation frames advancing by 16ms each
      for (let tick = 1; tick <= numTicks; tick++) {
        const frameTime = new Date(baseInstant.getTime() + tick * 16);
        const t0 = performance.now();
        engine.getActiveEvents(frameTime);
        const elapsed = performance.now() - t0;
        tickTimes.push(elapsed);
      }

      const avgTick = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
      const maxTick = Math.max(...tickTimes);

      const sortedTicks = [...tickTimes].sort((a, b) => a - b);
      const medianTick = sortedTicks[Math.floor(sortedTicks.length / 2)];

      // Latency under parallel test worker contention (idle cores run in 5 - 15ms)
      expect(medianTick).toBeLessThan(60);
      expect(avgTick).toBeLessThan(70);
      expect(maxTick).toBeLessThan(150);

      // Zero evictions across all 30 frames
      expect(deleteSpy).toHaveBeenCalledTimes(0);
    }
  );

  it(
    'empirically verifies 24-hour simulation cycle on 15,000 settlements never exceeds maxCacheSize and experiences ZERO evictions',
    { timeout: 45000 },
    () => {
      const allSettlements = loadAllSettlements();
      const engine = new AdhanEventEngine(allSettlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        maxCacheSize: 60000,
      });

      const cacheMap = (engine as unknown as { scheduleCache: Map<string, unknown> }).scheduleCache;
      const deleteSpy = vi.spyOn(cacheMap, 'delete');

      const baseInstant = new Date('2026-10-04T00:00:00.000Z');

      // Sample every hour across 24 hours of simulation time
      for (let hour = 0; hour < 24; hour++) {
        const sampleTime = new Date(baseInstant.getTime() + hour * 3600000);
        const active = engine.getActiveEvents(sampleTime);
        expect(active.length).toBeGreaterThan(0);

        // Cache size must stay bounded within 60,000 capacity
        const currentSize = engine.getCacheSize();
        expect(currentSize).toBeLessThanOrEqual(60000);

        // Zero evictions must occur
        expect(deleteSpy).toHaveBeenCalledTimes(0);
      }

      // Final cache size after a full 24-hour cycle remains within capacity
      expect(engine.getCacheSize()).toBeLessThanOrEqual(60000);
      expect(deleteSpy).toHaveBeenCalledTimes(0);
    }
  );
});

describe('Challenger M3 It2 Suite 2: Candidate Date Pruning vs Unpruned Brute-Force Oracle across 200 Cities and 24 Hours', () => {
  // Construct 200 diverse world cities: 24 anchor cities + 176 sampled from dataset
  const allSettlements = loadAllSettlements();
  const sample200: Settlement[] = [...anchorSettlements];

  // Pick 176 evenly spaced settlements across the 15,000 cities
  const step = Math.floor(allSettlements.length / 176);
  for (let i = 0; i < 176; i++) {
    const s = allSettlements[i * step];
    if (s && !sample200.some((a) => a.name === s.name && a.countryCode === s.countryCode)) {
      sample200.push(s);
    }
  }

  // Ensure exact count of 200
  while (sample200.length < 200) {
    const s = allSettlements[sample200.length * 7];
    sample200.push(s);
  }
  const testCities = sample200.slice(0, 200);

  it('empirically verifies candidate date pruning matches unpruned 3-day oracle across 200 cities over 24 hours (zero missed events, zero false activations)', () => {
    expect(testCities.length).toBe(200);

    const options = {
      convention: 'UmmAlQura' as CalculationConventionName,
      madhab: 'Shafi' as Madhab,
      highLatitudeRule: 'MiddleOfTheNight' as HighLatitudeRule,
      adhanDurationMinutes: 4,
    };

    const engine = new AdhanEventEngine(testCities, options);

    const baseInstant = new Date('2026-10-04T00:00:00.000Z');
    let totalEventsObserved = 0;
    let missedEventsCount = 0;
    let falseActivationsCount = 0;

    // Sample every 30 minutes across 24 hours (48 sample points)
    for (let stepIdx = 0; stepIdx < 48; stepIdx++) {
      const sampleTime = new Date(baseInstant.getTime() + stepIdx * 30 * 60000);

      // Pruned result from engine
      const prunedEvents = engine.getActiveEvents(sampleTime);

      // Unpruned brute-force oracle result
      const oracleEvents = unpruned3DayOracle(testCities, sampleTime, {
        convention: options.convention,
        madhab: options.madhab,
        highLatitudeRule: options.highLatitudeRule,
        adhanDurationMs: 4 * 60 * 1000,
      });

      totalEventsObserved += oracleEvents.length;

      // 1. Length equality check
      if (prunedEvents.length !== oracleEvents.length) {
        if (prunedEvents.length < oracleEvents.length) {
          missedEventsCount += oracleEvents.length - prunedEvents.length;
        } else {
          falseActivationsCount += prunedEvents.length - oracleEvents.length;
        }
      }
      expect(prunedEvents.length).toBe(oracleEvents.length);

      // 2. Exact match of each active settlement, prayer name, progress, and startTime
      const prunedMap = new Map<number, ActiveAdhanEvent>();
      for (const ev of prunedEvents) {
        prunedMap.set(ev.settlementIndex, ev);
      }

      for (const oracleEv of oracleEvents) {
        const prunedEv = prunedMap.get(oracleEv.settlementIndex);
        expect(prunedEv).toBeDefined();

        if (prunedEv) {
          expect(prunedEv.prayer).toBe(oracleEv.prayer);
          expect(prunedEv.startTime.getTime()).toBe(oracleEv.startTime.getTime());
          expect(prunedEv.endTime.getTime()).toBe(oracleEv.endTime.getTime());
          expect(prunedEv.progress).toBeCloseTo(oracleEv.progress, 5);
          expect(prunedEv.eventId).toBe(oracleEv.eventId);
        }
      }
    }

    // Assert that active events actually occurred and zero errors were detected
    expect(totalEventsObserved).toBeGreaterThan(50);
    expect(missedEventsCount).toBe(0);
    expect(falseActivationsCount).toBe(0);
  });

  it('empirically stress-tests candidate date pruning at local solar time boundary thresholds (02:59, 03:00, 03:01 and 20:59, 21:00, 21:01)', () => {
    // For each anchor settlement, test query instants precisely around local 03:00 and 21:00 solar thresholds
    const engine = new AdhanEventEngine(anchorSettlements, {
      convention: 'UmmAlQura',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      adhanDurationMinutes: 4,
    });

    const baseDate = new Date('2026-10-04T00:00:00.000Z');

    for (let sIdx = 0; sIdx < anchorSettlements.length; sIdx++) {
      const s = anchorSettlements[sIdx];
      const offsetMs = Math.round(s.longitude * 240000);

      // Local solar hour 3.0 occurs when nowMs + offsetMs has hour = 3
      // nowMs = midnightUTC + targetHour * 3600000 - offsetMs
      const localMidnightUtc = baseDate.getTime() - offsetMs;

      // Threshold testing times:
      // Local 02:59:00 (localHour = 2.9833, 2 candidates: today and yesterday)
      // Local 03:00:00 (localHour = 3.0000, 1 candidate: today)
      // Local 03:01:00 (localHour = 3.0167, 1 candidate: today)
      // Local 20:59:00 (localHour = 20.9833, 1 candidate: today)
      // Local 21:00:00 (localHour = 21.0000, 2 candidates: today and tomorrow)
      // Local 21:01:00 (localHour = 21.0167, 2 candidates: today and tomorrow)
      const testLocalHours = [2.9833, 3.0000, 3.0167, 20.9833, 21.0000, 21.0167];

      for (const h of testLocalHours) {
        const queryInstant = new Date(localMidnightUtc + Math.round(h * 3600000));

        const prunedEvents = engine.getActiveEvents(queryInstant);
        const oracleEvents = unpruned3DayOracle(anchorSettlements, queryInstant, {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          highLatitudeRule: 'MiddleOfTheNight',
          adhanDurationMs: 4 * 60 * 1000,
        });

        const prunedCity = prunedEvents.find((e) => e.settlementIndex === sIdx);
        const oracleCity = oracleEvents.find((e) => e.settlementIndex === sIdx);

        if (oracleCity) {
          expect(prunedCity).toBeDefined();
          expect(prunedCity?.prayer).toBe(oracleCity.prayer);
          expect(prunedCity?.startTime.getTime()).toBe(oracleCity.startTime.getTime());
          expect(prunedCity?.progress).toBeCloseTo(oracleCity.progress, 5);
        } else {
          expect(prunedCity).toBeUndefined();
        }
      }
    }
  });

  it('empirically verifies candidate date pruning matches oracle across all calculation configurations (madhab, conventions, rules)', () => {
    const configPermutations: Array<{
      convention: CalculationConventionName;
      madhab: Madhab;
      highLatitudeRule: HighLatitudeRule;
    }> = [
      { convention: 'MuslimWorldLeague', madhab: 'Shafi', highLatitudeRule: 'SeventhOfTheNight' },
      { convention: 'Egyptian', madhab: 'Hanafi', highLatitudeRule: 'AngleBased' },
      { convention: 'Karachi', madhab: 'Hanafi', highLatitudeRule: 'MiddleOfTheNight' },
    ];

    const testInstants = [
      new Date('2026-10-04T05:30:00.000Z'),
      new Date('2026-10-04T12:00:00.000Z'),
      new Date('2026-10-04T19:12:01.579Z'), // Tokyo Fajr crossing
      new Date('2026-10-05T04:18:00.000Z'), // Honolulu Maghrib crossing
    ];

    for (const cfg of configPermutations) {
      const engine = new AdhanEventEngine(anchorSettlements, cfg);

      for (const instant of testInstants) {
        const pruned = engine.getActiveEvents(instant);
        const oracle = unpruned3DayOracle(anchorSettlements, instant, {
          convention: cfg.convention,
          madhab: cfg.madhab,
          highLatitudeRule: cfg.highLatitudeRule,
        });

        expect(pruned.length).toBe(oracle.length);

        for (const oEv of oracle) {
          const pEv = pruned.find((e) => e.settlementIndex === oEv.settlementIndex);
          expect(pEv).toBeDefined();
          expect(pEv?.prayer).toBe(oEv.prayer);
          expect(pEv?.startTime.getTime()).toBe(oEv.startTime.getTime());
          expect(pEv?.progress).toBeCloseTo(oEv.progress, 5);
        }
      }
    }
  });

  it('empirically verifies multi-season candidate pruning equivalence across summer solstice, winter solstice, and equinox', () => {
    // Challenge extreme seasonal sun trajectories in Tromsø, Reykjavik, Longyearbyen, Honolulu, and Tokyo
    const seasonalDates = [
      new Date('2026-06-21T12:00:00.000Z'), // Summer solstice (midnight sun in polar north)
      new Date('2026-12-21T12:00:00.000Z'), // Winter solstice (polar night in polar north)
      new Date('2026-09-22T12:00:00.000Z'), // Autumnal equinox
    ];

    const engine = new AdhanEventEngine(anchorSettlements, {
      convention: 'MuslimWorldLeague',
      madhab: 'Shafi',
      highLatitudeRule: 'AngleBased',
    });

    for (const sDate of seasonalDates) {
      // Test 4 distinct times of day for each season
      for (let hourOffset of [0, 6, 12, 18]) {
        const queryInstant = new Date(sDate.getTime() + hourOffset * 3600000);

        const pruned = engine.getActiveEvents(queryInstant);
        const oracle = unpruned3DayOracle(anchorSettlements, queryInstant, {
          convention: 'MuslimWorldLeague',
          madhab: 'Shafi',
          highLatitudeRule: 'AngleBased',
        });

        expect(pruned.length).toBe(oracle.length);

        for (const oEv of oracle) {
          const pEv = pruned.find((e) => e.settlementIndex === oEv.settlementIndex);
          expect(pEv).toBeDefined();
          expect(pEv?.prayer).toBe(oEv.prayer);
          expect(pEv?.startTime.getTime()).toBe(oEv.startTime.getTime());
          expect(pEv?.progress).toBeCloseTo(oEv.progress, 5);
        }
      }
    }
  });
});
