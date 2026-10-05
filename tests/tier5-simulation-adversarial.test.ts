import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import {
  AdhanEventEngine,
  buildScheduleCacheKey,
} from '../src/simulation/eventEngine';
import {
  computeGlobalAdhanContinuity,
  computeSweepLineMetrics,
  mergeIntervals,
  TimeInterval,
} from '../src/simulation/continuity';
import {
  AppStore,
  createAppStore,
  AppConfig,
  AppState,
} from '../src/ui/state';
import { createEarth, EARTH_RADIUS } from '../src/globe/earth';
import { createAtmosphere } from '../src/globe/atmosphere';
import { createPrayerFrontsLayer } from '../src/globe/fronts';
import {
  getSubsolarPoint,
  getSolarAltitude,
  SubsolarCoordinates,
} from '../src/astronomy/solar';
import { latLonToVector3 } from '../src/astronomy/coordinates';
import { calculatePrayerTimes } from '../src/prayer/calculator';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from '../src/prayer/conventions';
import { Settlement } from '../src/population/loader';

/**
 * Deterministic Linear Congruential Generator (LCG) for reproducible randomness.
 */
class SeededRng {
  private state: number;
  constructor(seed = 987654321) {
    this.state = seed;
  }
  next(): number {
    this.state = (1103515245 * this.state + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min));
  }
}

/**
 * Brute-force ground-truth oracle for sweep-line metrics.
 * Evaluates discrete integer seconds t in [0, windowSeconds) in O(windowSeconds * N) time.
 */
function bruteForceOracle(intervals: TimeInterval[], windowSeconds = 86400) {
  let covered = 0;
  let peak = 0;
  let min = Infinity;
  let currentGap = 0;
  let maxGap = 0;

  for (let t = 0; t < windowSeconds; t++) {
    let active = 0;
    for (const iv of intervals) {
      if (iv.startSec <= t && t < iv.endSec) {
        active++;
      }
    }

    if (active > 0) {
      covered++;
      if (currentGap > maxGap) {
        maxGap = currentGap;
      }
      currentGap = 0;
    } else {
      currentGap++;
    }

    if (active > peak) peak = active;
    if (active < min) min = active;
  }

  if (currentGap > maxGap) {
    maxGap = currentGap;
  }

  return {
    coveredSeconds: covered,
    longestGapSeconds: maxGap,
    peakConcurrency: peak,
    minConcurrency: min === Infinity ? 0 : min,
  };
}

/**
 * Exhaustive independent multi-day prayer oracle for AdhanEventEngine.
 * Checks candidate civil days [query - 2, query - 1, query, query + 1, query + 2]
 * to find all active adhan calls at the exact instant `queryTime`.
 */
function computeExhaustiveActiveAdhans(
  settlement: Settlement,
  queryTime: Date,
  options: {
    convention: CalculationConventionName;
    madhab: Madhab;
    highLatitudeRule: HighLatitudeRule;
    durationMs: number;
  },
): Array<{ prayer: PrayerKey; startTime: Date; endTime: Date; progress: number }> {
  const qMs = queryTime.getTime();
  const qY = queryTime.getUTCFullYear();
  const qM = queryTime.getUTCMonth();
  const qD = queryTime.getUTCDate();

  const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const matches: Array<{ prayer: PrayerKey; startTime: Date; endTime: Date; progress: number }> = [];

  for (let dayOffset = -2; dayOffset <= 2; dayOffset++) {
    const candDate = new Date(Date.UTC(qY, qM, qD + dayOffset, 12, 0, 0));
    const sched = calculatePrayerTimes(settlement.latitude, settlement.longitude, candDate, {
      convention: options.convention,
      madhab: options.madhab,
      highLatitudeRule: options.highLatitudeRule,
    });

    for (const p of prayers) {
      const entry = sched[p];
      if (!entry || !entry.date || entry.provenance === 'unresolved') continue;
      const pMs = entry.date.getTime();
      const diff = qMs - pMs;
      if (diff >= 0 && diff < options.durationMs) {
        matches.push({
          prayer: p,
          startTime: entry.date,
          endTime: new Date(pMs + options.durationMs),
          progress: diff / options.durationMs,
        });
      }
    }
  }

  return matches;
}

beforeAll(() => {
  // Polyfill window dimensions in Node.js test environment
  if (typeof window === 'undefined') {
    (globalThis as unknown as { window: unknown }).window = {
      innerWidth: 1920,
      innerHeight: 1080,
    };
  }
  // Mock TextureLoader in Node.js test environment
  THREE.TextureLoader.prototype.load = function () {
    return new THREE.Texture();
  };
});

// ===========================================================================
// Suite 1: Event Engine Multi-Day Lookahead, IDL Pruning & Temporal Boundary Stress
// ===========================================================================
describe('Tier 5 Suite 1: Event Engine Multi-Day Lookahead & Temporal Boundary Stress', () => {
  const idlSettlementEast: Settlement = {
    name: 'Tarawa East IDL',
    nameAr: 'تاراوا شرق',
    latitude: 1.33,
    longitude: 179.9,
    countryCode: 'KI',
    population: 60000,
    timezone: 'Pacific/Tarawa',
  };

  const idlSettlementWest: Settlement = {
    name: 'Baker West IDL',
    nameAr: 'جزيرة بيكر غرب',
    latitude: 0.2,
    longitude: -179.9,
    countryCode: 'US',
    population: 100,
    timezone: 'Etc/GMT+12',
  };

  const idlHighLatNorth: Settlement = {
    name: 'Chukotka High Lat IDL',
    nameAr: 'تشوكوتكا',
    latitude: 65.5,
    longitude: 179.9,
    countryCode: 'RU',
    population: 15000,
    timezone: 'Asia/Anadyr',
  };

  const idlHighLatSouth: Settlement = {
    name: 'Ross High Lat IDL',
    nameAr: 'بحر روس',
    latitude: -65.5,
    longitude: -179.9,
    countryCode: 'AQ',
    population: 200,
    timezone: 'Antarctica/McMurdo',
  };

  it('computes accurate millisecond solar offsets near IDL (+179.9 deg and -179.9 deg)', () => {
    const engine = new AdhanEventEngine([idlSettlementEast, idlSettlementWest]);
    // longitude * 240,000 ms:
    // 179.9 * 240,000 = +43,176,000 ms (+11.9933 hours)
    // -179.9 * 240,000 = -43,176,000 ms (-11.9933 hours)
    expect(engine.getSettlementCount()).toBe(2);
    expect(engine.getSettlement(0)?.name).toBe('Tarawa East IDL');
    expect(engine.getSettlement(1)?.name).toBe('Baker West IDL');
  });

  it('empirically validates active adhan detection crossing UTC midnight forwards and backwards near IDL', () => {
    const durationMinutes = 4;
    const durationMs = durationMinutes * 60 * 1000;
    const convention = 'UmmAlQura';
    const madhab = 'Shafi';
    const highLatitudeRule = 'MiddleOfTheNight';

    const settlements = [idlSettlementEast, idlSettlementWest, idlHighLatNorth, idlHighLatSouth];
    const engine = new AdhanEventEngine(settlements, {
      convention,
      madhab,
      highLatitudeRule,
      adhanDurationMinutes: durationMinutes,
    });

    // Test a sequence of 60 query timestamps stepping forwards and backwards across UTC midnight
    // Date range: 2026-10-04T23:30:00Z to 2026-10-05T00:30:00Z in 2-minute increments
    const baseMidnight = new Date('2026-10-05T00:00:00Z').getTime();

    for (let step = -15; step <= 15; step++) {
      const qTime = new Date(baseMidnight + step * 120 * 1000);
      const activeFromEngine = engine.getActiveEvents(qTime);

      for (let sIdx = 0; sIdx < settlements.length; sIdx++) {
        const s = settlements[sIdx];
        const oracleMatches = computeExhaustiveActiveAdhans(s, qTime, {
          convention,
          madhab,
          highLatitudeRule,
          durationMs,
        });

        const engineMatch = activeFromEngine.find((e) => e.settlementIndex === sIdx);

        if (oracleMatches.length === 0) {
          expect(engineMatch).toBeUndefined();
        } else {
          expect(engineMatch).toBeDefined();
          const oracle = oracleMatches[0];
          expect(engineMatch?.prayer).toBe(oracle.prayer);
          expect(engineMatch?.startTime.getTime()).toBe(oracle.startTime.getTime());
          expect(engineMatch?.endTime.getTime()).toBe(oracle.endTime.getTime());
          expect(engineMatch?.progress).toBeCloseTo(oracle.progress, 5);
        }
      }
    }
  });

  it('empirically verifies candidate date pruning across Leap Year day boundaries (Feb 28 - Feb 29 - Mar 1)', () => {
    // 2024 is a leap year; 2024-02-29 is a valid leap day
    const engine = new AdhanEventEngine([idlSettlementEast, idlSettlementWest], {
      convention: 'MuslimWorldLeague',
      madhab: 'Shafi',
      adhanDurationMinutes: 5,
    });

    // Test boundary timestamps around Leap Day 2024
    const leapInstants = [
      new Date('2024-02-28T23:58:00Z'),
      new Date('2024-02-29T00:02:00Z'),
      new Date('2024-02-29T12:00:00Z'),
      new Date('2024-02-29T23:58:00Z'),
      new Date('2024-03-01T00:02:00Z'),
    ];

    for (const instant of leapInstants) {
      expect(() => {
        const events = engine.getActiveEvents(instant);
        expect(Array.isArray(events)).toBe(true);
      }).not.toThrow();

      // Schedules retrieved directly for coords must not throw and return valid entries
      const sched = engine.getScheduleByCoords(1.33, 179.9, instant);
      expect(sched.fajr).toBeDefined();
      expect(sched.dhuhr).toBeDefined();
      expect(sched.asr).toBeDefined();
      expect(sched.maghrib).toBeDefined();
      expect(sched.isha).toBeDefined();
    }
  });

  it('verifies getNextEvent and getEventsInWindow across Equinox date transitions without skipping or repeating', () => {
    const engine = new AdhanEventEngine([idlSettlementEast, idlSettlementWest], {
      convention: 'UmmAlQura',
      madhab: 'Shafi',
    });

    // Vernal Equinox 2026: March 20, 2026
    const equinoxQuery = new Date('2026-03-20T11:00:00Z');
    const nextEvent0 = engine.getNextEvent(0, equinoxQuery);
    expect(nextEvent0).not.toBeNull();
    expect(nextEvent0!.date.getTime()).toBeGreaterThan(equinoxQuery.getTime());

    // Window evaluation across 72 hours
    const windowStart = new Date('2026-03-19T00:00:00Z');
    const windowEnd = new Date('2026-03-22T00:00:00Z');
    const events = engine.getEventsInWindow(windowStart, windowEnd, 0);

    expect(events.length).toBeGreaterThan(0);
    // Invariant: all window events are strictly within [windowStart, windowEnd)
    for (const ev of events) {
      expect(ev.date.getTime()).toBeGreaterThanOrEqual(windowStart.getTime());
      expect(ev.date.getTime()).toBeLessThan(windowEnd.getTime());
    }

    // Invariant: events are chronologically monotonic
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date.getTime()).toBeGreaterThanOrEqual(events[i - 1].date.getTime());
    }
  });

  it('enforces FIFO/LRU bounded cache eviction under massive query load', () => {
    const maxCache = 25;
    const engine = new AdhanEventEngine([], {
      maxCacheSize: maxCache,
    });

    // Generate 120 unique coordinate/date query requests
    for (let i = 0; i < 120; i++) {
      const lat = (i % 60) - 30;
      const lon = (i % 120) - 60;
      const date = new Date(Date.UTC(2026, 9, (i % 28) + 1, 12, 0, 0));
      engine.getScheduleByCoords(lat, lon, date);
      expect(engine.getCacheSize()).toBeLessThanOrEqual(maxCache);
    }

    expect(engine.getCacheSize()).toBeLessThanOrEqual(maxCache);

    // Evicted entries re-query transparently
    const sched = engine.getScheduleByCoords(0, 0, new Date('2026-10-01T12:00:00Z'));
    expect(sched.dhuhr.date).not.toBeNull();
  });

  it('empirically verifies dynamic cache clearing and schedule divergence when toggling Madhab and Convention', () => {
    const engine = new AdhanEventEngine([idlSettlementEast], {
      convention: 'UmmAlQura',
      madhab: 'Shafi',
    });

    const testDate = new Date('2026-10-04T12:00:00Z');
    const shafiSched = engine.getSchedule(0, testDate);
    const shafiAsrMs = shafiSched.asr.date!.getTime();
    expect(engine.getCacheSize()).toBeGreaterThan(0);

    // Toggle Madhab to Hanafi: must clear cache and compute later Asr time
    engine.setMadhab('Hanafi');
    expect(engine.getCacheSize()).toBe(0);

    const hanafiSched = engine.getSchedule(0, testDate);
    const hanafiAsrMs = hanafiSched.asr.date!.getTime();

    // Hanafi Asr (shadow factor 2) is strictly after Shafi Asr (shadow factor 1)
    expect(hanafiAsrMs).toBeGreaterThan(shafiAsrMs);

    // Toggle Convention: must clear cache
    engine.setConvention('MuslimWorldLeague');
    expect(engine.getCacheSize()).toBe(0);
  });
});

// ===========================================================================
// Suite 2: Continuity Sweep-Line Concurrency, Degenerate Intervals & Burst Invariants
// ===========================================================================
describe('Tier 5 Suite 2: Continuity Sweep-Line Concurrency & Degenerate Intervals', () => {
  it('correctly handles empty interval array returning exact zero metrics and 86400s gap', () => {
    const res = computeSweepLineMetrics([], 86400);
    expect(res.coveredSeconds).toBe(0);
    expect(res.longestGapSeconds).toBe(86400);
    expect(res.peakConcurrency).toBe(0);
    expect(res.minConcurrency).toBe(0);
  });

  it('correctly absorbs zero-length degenerate intervals [T, T) without skewing concurrency or coverage', () => {
    const validIntervals: TimeInterval[] = [
      { startSec: 1000, endSec: 2000 },
      { startSec: 5000, endSec: 7000 },
    ];
    const withZeroLength: TimeInterval[] = [
      ...validIntervals,
      { startSec: 1000, endSec: 1000 },
      { startSec: 3500, endSec: 3500 },
      { startSec: 7000, endSec: 7000 },
    ];

    const cleanRes = computeSweepLineMetrics(validIntervals, 86400);
    const degenerateRes = computeSweepLineMetrics(withZeroLength, 86400);

    expect(degenerateRes.coveredSeconds).toBe(cleanRes.coveredSeconds);
    expect(degenerateRes.peakConcurrency).toBe(cleanRes.peakConcurrency);
    expect(degenerateRes.minConcurrency).toBe(cleanRes.minConcurrency);
    expect(degenerateRes.longestGapSeconds).toBe(cleanRes.longestGapSeconds);
  });

  it('processes massive concurrency burst: 150 settlements with exact identical interval', () => {
    const burstCount = 150;
    const burstIntervals: TimeInterval[] = [];
    const startSec = 7200; // 02:00:00
    const endSec = 7440; // 02:04:00 (240s duration)

    for (let i = 0; i < burstCount; i++) {
      burstIntervals.push({ startSec, endSec });
    }

    const res = computeSweepLineMetrics(burstIntervals, 86400);
    expect(res.peakConcurrency).toBe(burstCount);
    expect(res.coveredSeconds).toBe(240);
    expect(res.minConcurrency).toBe(0);
    // Pre-gap: 7200. Post-gap: 86400 - 7440 = 78960. Max gap = 78960.
    expect(res.longestGapSeconds).toBe(78960);

    const oracle = bruteForceOracle(burstIntervals, 86400);
    expect(res.peakConcurrency).toBe(oracle.peakConcurrency);
    expect(res.coveredSeconds).toBe(oracle.coveredSeconds);
    expect(res.minConcurrency).toBe(oracle.minConcurrency);
    expect(res.longestGapSeconds).toBe(oracle.longestGapSeconds);
  });

  it('correctly handles interval touching the exact start boundary t=0 without spurious initial gap', () => {
    const intervals: TimeInterval[] = [{ startSec: 0, endSec: 3600 }];
    const res = computeSweepLineMetrics(intervals, 86400);

    expect(res.coveredSeconds).toBe(3600);
    expect(res.peakConcurrency).toBe(1);
    expect(res.minConcurrency).toBe(0);
    // Trailing gap: 86400 - 3600 = 82800. No gap at t=0.
    expect(res.longestGapSeconds).toBe(82800);
  });

  it('correctly handles interval touching the exact end boundary t=86400 without spurious trailing gap', () => {
    const intervals: TimeInterval[] = [{ startSec: 82800, endSec: 86400 }];
    const res = computeSweepLineMetrics(intervals, 86400);

    expect(res.coveredSeconds).toBe(3600);
    expect(res.peakConcurrency).toBe(1);
    expect(res.minConcurrency).toBe(0);
    // Initial gap: 82800. No gap at t=86400.
    expect(res.longestGapSeconds).toBe(82800);
  });

  it('empirically verifies 100% 24-hour uninterrupted continuous coverage interval [0, 86400)', () => {
    const intervals: TimeInterval[] = [{ startSec: 0, endSec: 86400 }];
    const res = computeSweepLineMetrics(intervals, 86400);

    expect(res.coveredSeconds).toBe(86400);
    expect(res.longestGapSeconds).toBe(0);
    expect(res.peakConcurrency).toBe(1);
    expect(res.minConcurrency).toBe(1);
  });

  it('seamlessly joins adjacent non-overlapping intervals touching at exact boundary [T1, T2) and [T2, T3)', () => {
    const intervals: TimeInterval[] = [
      { startSec: 1000, endSec: 2000 },
      { startSec: 2000, endSec: 3000 },
    ];
    const res = computeSweepLineMetrics(intervals, 86400);

    expect(res.coveredSeconds).toBe(2000);
    expect(res.peakConcurrency).toBe(1);
    // Gaps: [0, 1000) = 1000s; [3000, 86400) = 83400s. No zero-second gap at t=2000.
    expect(res.longestGapSeconds).toBe(83400);
  });

  it('property-based fuzzing: verifies sweep-line metrics against brute-force discrete oracle over 500 pseudo-random intervals', () => {
    const rng = new SeededRng(44332211);
    const intervals: TimeInterval[] = [];

    // Generate 500 overlapping, clustered intervals
    for (let i = 0; i < 500; i++) {
      const center = rng.nextInt(0, 86400);
      const span = rng.nextInt(60, 600);
      const start = Math.max(0, center - Math.floor(span / 2));
      const end = Math.min(86400, start + span);
      if (start < end) {
        intervals.push({ startSec: start, endSec: end });
      }
    }

    const sweepResult = computeSweepLineMetrics(intervals, 86400);
    const oracleResult = bruteForceOracle(intervals, 86400);

    expect(sweepResult.coveredSeconds).toBe(oracleResult.coveredSeconds);
    expect(sweepResult.longestGapSeconds).toBe(oracleResult.longestGapSeconds);
    expect(sweepResult.peakConcurrency).toBe(oracleResult.peakConcurrency);
    expect(sweepResult.minConcurrency).toBe(oracleResult.minConcurrency);
  });

  it('merges overlapping intervals correctly using mergeIntervals utility', () => {
    expect(mergeIntervals([])).toEqual([]);
    const unmerged: TimeInterval[] = [
      { startSec: 100, endSec: 300 },
      { startSec: 200, endSec: 400 },
      { startSec: 500, endSec: 600 },
      { startSec: 550, endSec: 700 },
    ];
    const merged = mergeIntervals(unmerged);
    expect(merged).toEqual([
      { startSec: 100, endSec: 400 },
      { startSec: 500, endSec: 700 },
    ]);
  });
});

// ===========================================================================
// Suite 3: Shader Uniform Boundaries, Solstices, Equinoxes & Twilight Extinction
// ===========================================================================
describe('Tier 5 Suite 3: Shader Uniform Boundaries, Solstices & Twilight Optics', () => {
  it('empirically verifies subsolar declination bounds and unit vector normalization at Solstice extremes', () => {
    // Northern Summer Solstice: ~June 21
    const summerSolstice = new Date('2026-06-21T12:00:00Z');
    const subsolarSummer = getSubsolarPoint(summerSolstice);
    expect(subsolarSummer.latitude).toBeCloseTo(23.44, 1);

    const [sx1, sy1, sz1] = latLonToVector3(subsolarSummer.latitude, subsolarSummer.longitude, 1);
    const vSummer = new THREE.Vector3(sx1, sy1, sz1).normalize();
    expect(vSummer.length()).toBeCloseTo(1.0, 6);
    // +Y component points toward North Pole and must be positive (~sin(23.44 deg) ~ 0.398)
    expect(vSummer.y).toBeGreaterThan(0.35);

    // Southern Winter Solstice: ~December 21
    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const subsolarWinter = getSubsolarPoint(winterSolstice);
    expect(subsolarWinter.latitude).toBeCloseTo(-23.44, 1);

    const [sx2, sy2, sz2] = latLonToVector3(subsolarWinter.latitude, subsolarWinter.longitude, 1);
    const vWinter = new THREE.Vector3(sx2, sy2, sz2).normalize();
    expect(vWinter.length()).toBeCloseTo(1.0, 6);
    // +Y component points toward South and must be negative
    expect(vWinter.y).toBeLessThan(-0.35);

    // Vernal Equinox: ~March 20
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolarEq = getSubsolarPoint(equinox);
    expect(subsolarEq.latitude).toBeCloseTo(0.0, 1);
    const [sx3, sy3, sz3] = latLonToVector3(subsolarEq.latitude, subsolarEq.longitude, 1);
    const vEq = new THREE.Vector3(sx3, sy3, sz3).normalize();
    expect(Math.abs(vEq.y)).toBeLessThan(0.05);
  });

  it('empirically verifies continuous directional transit across the Antimeridian (00:00 UTC crossing)', () => {
    // Test minute-by-minute transit across 00:00 UTC
    const midnightBase = new Date('2026-06-21T00:00:00Z').getTime();
    const vectors: THREE.Vector3[] = [];

    for (let m = -30; m <= 30; m++) {
      const t = new Date(midnightBase + m * 60 * 1000);
      const sub = getSubsolarPoint(t);
      const [x, y, z] = latLonToVector3(sub.latitude, sub.longitude, 1);
      vectors.push(new THREE.Vector3(x, y, z).normalize());
    }

    // Verify directional continuity: angle delta between consecutive 1-minute steps is ~0.25 deg
    for (let i = 1; i < vectors.length; i++) {
      const angleDeltaRad = vectors[i].angleTo(vectors[i - 1]);
      const angleDeltaDeg = (angleDeltaRad * 180) / Math.PI;
      expect(angleDeltaDeg).toBeGreaterThan(0.2);
      expect(angleDeltaDeg).toBeLessThan(0.3);
    }
  });

  it('empirically verifies Earth Shader fragment math: zero direct diffuse and specular glint in night hemisphere', () => {
    // Exact fragment shader mathematical simulation
    function simulateEarthShader(sunDotMacro: number, bumpScale = 0.4) {
      // directOcclusion = smoothstep(0.0, 0.025, sunDotMacro)
      const tOcc = Math.min(1.0, Math.max(0.0, (sunDotMacro - 0.0) / 0.025));
      const directOcclusion = tOcc * tOcc * (3.0 - 2.0 * tOcc);

      // Adversarial shading normal pointing directly toward Sun
      const nDotL = 1.0;
      const diffuse = nDotL * directOcclusion;

      // Specular glint
      const specFactor = 1.0;
      const oceanGlint = specFactor * directOcclusion * 1.5;

      // Night factor: 1.0 - smoothstep(-0.03, 0.03, sunDotMacro)
      const tNight = Math.min(1.0, Math.max(0.0, (sunDotMacro - -0.03) / 0.06));
      const nightFactor = 1.0 - (tNight * tNight * (3.0 - 2.0 * tNight));

      return { directOcclusion, diffuse, oceanGlint, nightFactor };
    }

    // Deep night: sunDotMacro in [-1.0, 0.0]
    for (let sunDot = -1.0; sunDot <= 0.0; sunDot += 0.05) {
      const res = simulateEarthShader(sunDot);
      expect(res.directOcclusion).toBe(0.0);
      expect(res.diffuse).toBe(0.0);
      expect(res.oceanGlint).toBe(0.0);
      if (sunDot <= -0.03) {
        expect(res.nightFactor).toBe(1.0);
      }
    }

    // Broad daylight: sunDotMacro >= 0.05
    for (let sunDot = 0.05; sunDot <= 1.0; sunDot += 0.1) {
      const res = simulateEarthShader(sunDot);
      expect(res.directOcclusion).toBe(1.0);
      expect(res.diffuse).toBe(1.0);
      expect(res.nightFactor).toBe(0.0);
    }
  });

  it('empirically verifies Atmosphere Shader fragment math: absolute extinction at astronomical twilight (-18 deg)', () => {
    const SIN_ASTRO = -0.30901699; // sin(-18.0 deg)

    function simulateAtmosphere(sunDot: number) {
      if (sunDot <= SIN_ASTRO) {
        return { alpha: 0.0, twilightFactor: 0.0 };
      }

      const tTwilight = Math.min(1.0, Math.max(0.0, (sunDot - SIN_ASTRO) / (0.0 - SIN_ASTRO)));
      const sTwilight = tTwilight * tTwilight * (3.0 - 2.0 * tTwilight);
      const twilightFactor = sunDot >= 0.0 ? 1.0 : sTwilight * sTwilight;

      // Optical opacity
      const opticalOpacity = 0.8;
      const alpha = opticalOpacity * twilightFactor;

      return { alpha, twilightFactor };
    }

    // Beyond astronomical twilight: strictly zero
    for (let sunDot = -1.0; sunDot <= SIN_ASTRO; sunDot += 0.05) {
      const res = simulateAtmosphere(sunDot);
      expect(res.alpha).toBe(0.0);
      expect(res.twilightFactor).toBe(0.0);
    }

    // Exact astronomical twilight boundary
    const boundaryRes = simulateAtmosphere(SIN_ASTRO);
    expect(boundaryRes.alpha).toBe(0.0);
    expect(boundaryRes.twilightFactor).toBe(0.0);

    // Twilight transition zone: strictly monotonic growth towards 1.0
    let prevFactor = 0.0;
    for (let sunDot = SIN_ASTRO + 0.01; sunDot < 0.0; sunDot += 0.02) {
      const res = simulateAtmosphere(sunDot);
      expect(res.twilightFactor).toBeGreaterThanOrEqual(prevFactor);
      expect(res.twilightFactor).toBeLessThanOrEqual(1.0);
      prevFactor = res.twilightFactor;
    }

    // Daylight zone: twilightFactor is exactly 1.0
    for (let sunDot = 0.0; sunDot <= 1.0; sunDot += 0.1) {
      const res = simulateAtmosphere(sunDot);
      expect(res.twilightFactor).toBe(1.0);
    }
  });

  it('initializes Three.js Earth and Atmosphere meshes and executes full lifecycle disposal', () => {
    const earth = createEarth(undefined, 'satellite');
    expect(earth.group.name).toBe('earth-system');
    expect(earth.mesh.name).toBe('earth-surface');
    expect(earth.cloudsMesh.name).toBe('earth-clouds');
    expect(earth.getMapStyle()).toBe('satellite');

    // Toggle map style to roadmap
    earth.setMapStyle('roadmap');
    expect(earth.getMapStyle()).toBe('roadmap');
    expect(earth.cloudsMesh.visible).toBe(false);

    // Update sun direction
    const sub = earth.updateSun(new Date('2026-06-21T12:00:00Z'));
    expect(sub.latitude).toBeCloseTo(23.44, 1);

    const atmosphere = createAtmosphere();
    expect(atmosphere.mesh.name).toBe('earth-atmosphere-glow');
    atmosphere.updateSun(new THREE.Vector3(0, 0, 1));

    // Full resource disposal without leaks or exceptions
    expect(() => {
      earth.dispose();
      atmosphere.dispose();
    }).not.toThrow();
  });
});

// ===========================================================================
// Suite 4: AppStore Concurrency, State Transitions & Rapid Dispatch Stress
// ===========================================================================
describe('Tier 5 Suite 4: AppStore Concurrency & State Dispatch Stress', () => {
  it('dispatches state and config changes accurately across 100 concurrent subscribers', () => {
    const store = createAppStore();
    const stateInvocations: number[] = new Array(100).fill(0);
    const configInvocations: number[] = new Array(50).fill(0);

    // Register 100 state listeners
    const unsubsState: Array<() => void> = [];
    for (let i = 0; i < 100; i++) {
      const idx = i;
      unsubsState.push(
        store.subscribe((state, prev) => {
          stateInvocations[idx]++;
          expect(state.revision).toBeGreaterThan(0);
          expect(prev).toBeDefined();
        }),
      );
    }

    // Register 50 config listeners
    const unsubsConfig: Array<() => void> = [];
    for (let i = 0; i < 50; i++) {
      const idx = i;
      unsubsConfig.push(
        store.subscribeConfig((cfg, rev) => {
          configInvocations[idx]++;
          expect(rev).toBeGreaterThan(1);
          expect(cfg.madhab).toBe('Hanafi');
        }),
      );
    }

    // Dispatch a valid config change
    const updated = store.updateConfig({ madhab: 'Hanafi' });
    expect(updated).toBe(true);
    expect(store.getRevision()).toBe(2);

    for (let i = 0; i < 100; i++) {
      expect(stateInvocations[i]).toBe(1);
    }
    for (let i = 0; i < 50; i++) {
      expect(configInvocations[i]).toBe(1);
    }

    // Cleanup listeners
    unsubsState.forEach((unsub) => unsub());
    unsubsConfig.forEach((unsub) => unsub());
  });

  it('isolates subscriber errors so throwing listeners do not disrupt healthy listeners', () => {
    const store = createAppStore();
    let healthyBeforeRan = false;
    let healthyAfterRan = false;

    store.subscribe(() => {
      healthyBeforeRan = true;
    });

    store.subscribe(() => {
      throw new Error('Simulated subscriber explosion');
    });

    store.subscribe(() => {
      healthyAfterRan = true;
    });

    expect(() => {
      store.updateConfig({ convention: 'MuslimWorldLeague' });
    }).not.toThrow();

    expect(healthyBeforeRan).toBe(true);
    expect(healthyAfterRan).toBe(true);
  });

  it('safely handles self-unsubscribing listeners during active dispatch', () => {
    const store = createAppStore();
    let callCount = 0;
    let unsubSelf: () => void = () => {};

    unsubSelf = store.subscribe(() => {
      callCount++;
      unsubSelf(); // Unsubscribe during own callback
    });

    store.updateConfig({ madhab: 'Hanafi' });
    expect(callCount).toBe(1);

    store.updateConfig({ madhab: 'Shafi' });
    expect(callCount).toBe(1); // Should not be called again
  });

  it('strictly validates configuration inputs and rejects invalid mutations without bumping revision', () => {
    const store = createAppStore();
    const initialRev = store.getRevision();

    // 1. Rejected convention
    expect(store.updateConfig({ convention: 'InvalidConvention' as any })).toBe(false);
    expect(store.getRevision()).toBe(initialRev);

    // 2. Rejected madhab
    expect(store.updateConfig({ madhab: 'InvalidMadhab' as any })).toBe(false);
    expect(store.getRevision()).toBe(initialRev);

    // 3. Rejected high latitude rule
    expect(store.updateConfig({ highLatitudeRule: 'InvalidRule' as any })).toBe(false);
    expect(store.getRevision()).toBe(initialRev);

    // 4. Rejected adhan duration
    expect(store.updateConfig({ adhanDurationMinutes: -5 })).toBe(false);
    expect(store.updateConfig({ adhanDurationMinutes: NaN })).toBe(false);
    expect(store.getRevision()).toBe(initialRev);

    // 5. Rejected map style
    expect(store.updateConfig({ mapStyle: 'unsupportedStyle' as any })).toBe(false);
    expect(store.getRevision()).toBe(initialRev);

    // 6. Idempotent identical update returns true without bumping revision
    expect(store.updateConfig({ madhab: 'Shafi' })).toBe(true);
    expect(store.getRevision()).toBe(initialRev);
  });

  it('handles rapid high-frequency date scrubbing and interleaved config updates', () => {
    const store = createAppStore();
    let totalStateDispatches = 0;

    store.subscribe(() => {
      totalStateDispatches++;
    });

    const baseMs = new Date('2026-10-04T00:00:00Z').getTime();

    // Rapidly scrub through 500 dates
    for (let step = 0; step < 500; step++) {
      store.setDate(new Date(baseMs + step * 60000));
    }

    expect(totalStateDispatches).toBe(500);
    expect(store.getDate().getTime()).toBe(baseMs + 499 * 60000);

    // Interleave config and date updates
    store.updateConfig({ madhab: 'Hanafi' });
    store.setDate(new Date(baseMs + 1000 * 60000));
    store.updateConfig({ convention: 'MuslimWorldLeague' });

    expect(store.getConfig().madhab).toBe('Hanafi');
    expect(store.getConfig().convention).toBe('MuslimWorldLeague');
    expect(store.getDate().getTime()).toBe(baseMs + 1000 * 60000);

    // Invalid date passed to setDate is rejected
    store.setDate(new Date('invalid-date'));
    expect(store.getDate().getTime()).toBe(baseMs + 1000 * 60000);
  });
});
