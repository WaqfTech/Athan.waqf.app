import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeGlobalAdhanContinuity,
  computeSweepLineMetrics,
  TimeInterval,
} from '../src/simulation/continuity';
import { parseSettlements, CompactSettlementRow, Settlement } from '../src/population/loader';
import { createAppStore, AppStore } from '../src/ui/state';
import { CalculationConventionName, Madhab, HighLatitudeRule } from '../src/prayer/conventions';

/**
 * Deterministic Linear Congruential Generator (LCG) for reproducible randomness.
 */
class SeededRng {
  private state: number;
  constructor(seed = 123456789) {
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
 * Independent ground-truth second-by-second brute-force oracle.
 * Evaluates discrete integer seconds t in [0, windowSeconds) in O(windowSeconds * N) time.
 * An interval [startSec, endSec) covers second t iff startSec <= t < endSec.
 */
function bruteForceOracle(intervals: TimeInterval[], windowSeconds: number) {
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

describe('Challenger M3 Suite 1: Empirical Verification of Witness W08 on 15,000 Settlements', () => {
  const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
  const settlements = parseSettlements(rawData);

  it('loads exactly 15,000 settlements from compact dataset', () => {
    expect(settlements.length).toBe(15000);
  });

  it(
    'empirically verifies W08: on 15,000 settlements for 2026-10-04, MuslimWorldLeague, Shafi, 4m duration, minConcurrentAdhans > 0 and strictly equals true bin minimum',
    { timeout: 30000 },
    () => {
      const queryDate = new Date('2026-10-04T12:00:00Z');
      const stats = computeGlobalAdhanContinuity(settlements, queryDate, {
        convention: 'MuslimWorldLeague',
        madhab: 'Shafi',
        adhanDurationMinutes: 4,
      });

      expect(stats.settlementCount).toBe(15000);
      expect(stats.timelineBins.length).toBe(288);

      const trueMinBin = Math.min(...stats.timelineBins);
      const trueMaxBin = Math.max(...stats.timelineBins);

      // Verify minConcurrentAdhans is strictly equal to the true minimum across all 288 bins
      expect(stats.minConcurrentAdhans).toBe(trueMinBin);
      expect(stats.peakConcurrentAdhans).toBe(trueMaxBin);

      // W08 core requirement: minConcurrentAdhans MUST be > 0 and not clamped to 0
      expect(stats.minConcurrentAdhans).toBeGreaterThan(0);
      expect(stats.minConcurrentAdhans).not.toBe(0);

      // In the new implementation with full multi-bin touching and multi-day candidate windows,
      // trueMinBin is 80 (in baseline with ceil(240/300)=1 it was 40, clamped to 0 by Math.min(..., 0)).
      expect(stats.minConcurrentAdhans).toBe(80);
      expect(stats.peakConcurrentAdhans).toBe(1297);

      // Coverage metrics
      expect(stats.coveredSeconds).toBe(86400);
      expect(stats.coveragePercent).toBe(100);
      expect(stats.longestGapSeconds).toBe(0);

      // Instantaneous metrics computed via sweep-line
      expect(stats.instantaneousMin).toBeDefined();
      expect(stats.instantaneousMin).toBeGreaterThan(0);
      expect(stats.instantaneousPeak).toBeDefined();
      expect(stats.instantaneousPeak).toBeGreaterThan(0);
    },
  );

  it(
    'empirically verifies that each of the 288 timeline bins has positive adhan count (> 0)',
    { timeout: 30000 },
    () => {
      const queryDate = new Date('2026-10-04T12:00:00Z');
      const stats = computeGlobalAdhanContinuity(settlements, queryDate, {
        convention: 'MuslimWorldLeague',
        madhab: 'Shafi',
        adhanDurationMinutes: 4,
      });

      // Verify no bin has zero active calls
      for (let binIdx = 0; binIdx < 288; binIdx++) {
        expect(stats.timelineBins[binIdx]).toBeGreaterThanOrEqual(40);
      }
    },
  );
});

describe('Challenger M3 Suite 2: Brute-Force Concurrency Oracle over Multi-Interval Sets', () => {
  it('matches brute-force oracle with zero error on 500 overlapping intervals across 10,000s window', () => {
    const rng = new SeededRng(42);
    const windowSeconds = 10000;
    const intervalCount = 500;
    const intervals: TimeInterval[] = [];

    for (let i = 0; i < intervalCount; i++) {
      const startSec = rng.nextInt(0, windowSeconds - 60);
      const durationSec = rng.nextInt(30, 600);
      const endSec = Math.min(windowSeconds, startSec + durationSec);
      intervals.push({ startSec, endSec });
    }

    const sweepResult = computeSweepLineMetrics(intervals, windowSeconds);
    const oracleResult = bruteForceOracle(intervals, windowSeconds);

    expect(sweepResult.coveredSeconds).toBe(oracleResult.coveredSeconds);
    expect(sweepResult.longestGapSeconds).toBe(oracleResult.longestGapSeconds);
    expect(sweepResult.peakConcurrency).toBe(oracleResult.peakConcurrency);
    expect(sweepResult.minConcurrency).toBe(oracleResult.minConcurrency);
  });

  it('matches brute-force oracle with zero error across multiple randomized workloads', () => {
    const rng = new SeededRng(999);
    const testCases = [
      { count: 100, window: 5000 },
      { count: 250, window: 8000 },
      { count: 500, window: 12000 },
      { count: 1000, window: 15000 },
    ];

    for (const tc of testCases) {
      const intervals: TimeInterval[] = [];
      for (let i = 0; i < tc.count; i++) {
        const startSec = rng.nextInt(0, tc.window - 10);
        const durationSec = rng.nextInt(10, 400);
        const endSec = Math.min(tc.window, startSec + durationSec);
        intervals.push({ startSec, endSec });
      }

      const sweep = computeSweepLineMetrics(intervals, tc.window);
      const oracle = bruteForceOracle(intervals, tc.window);

      expect(sweep.coveredSeconds).toBe(oracle.coveredSeconds);
      expect(sweep.longestGapSeconds).toBe(oracle.longestGapSeconds);
      expect(sweep.peakConcurrency).toBe(oracle.peakConcurrency);
      expect(sweep.minConcurrency).toBe(oracle.minConcurrency);
    }
  });

  it('handles edge cases: empty intervals', () => {
    const sweep = computeSweepLineMetrics([], 5000);
    const oracle = bruteForceOracle([], 5000);

    expect(sweep.coveredSeconds).toBe(oracle.coveredSeconds);
    expect(sweep.longestGapSeconds).toBe(oracle.longestGapSeconds);
    expect(sweep.peakConcurrency).toBe(oracle.peakConcurrency);
    expect(sweep.minConcurrency).toBe(oracle.minConcurrency);
    expect(sweep.coveredSeconds).toBe(0);
    expect(sweep.longestGapSeconds).toBe(5000);
    expect(sweep.minConcurrency).toBe(0);
  });

  it('handles edge cases: single interval with leading and trailing gaps', () => {
    const intervals: TimeInterval[] = [{ startSec: 100, endSec: 300 }];
    const sweep = computeSweepLineMetrics(intervals, 1000);
    const oracle = bruteForceOracle(intervals, 1000);

    expect(sweep.coveredSeconds).toBe(oracle.coveredSeconds);
    expect(sweep.longestGapSeconds).toBe(oracle.longestGapSeconds);
    expect(sweep.peakConcurrency).toBe(oracle.peakConcurrency);
    expect(sweep.minConcurrency).toBe(oracle.minConcurrency);
    expect(sweep.coveredSeconds).toBe(200);
    // Gaps: [0, 100) is 100s, [300, 1000) is 700s. Longest gap = 700.
    expect(sweep.longestGapSeconds).toBe(700);
    expect(sweep.minConcurrency).toBe(0);
    expect(sweep.peakConcurrency).toBe(1);
  });

  it('handles edge cases: completely full window with uniform concurrency', () => {
    const intervals: TimeInterval[] = [
      { startSec: 0, endSec: 1000 },
      { startSec: 0, endSec: 1000 },
      { startSec: 0, endSec: 1000 },
    ];
    const sweep = computeSweepLineMetrics(intervals, 1000);
    const oracle = bruteForceOracle(intervals, 1000);

    expect(sweep.coveredSeconds).toBe(1000);
    expect(sweep.longestGapSeconds).toBe(0);
    expect(sweep.peakConcurrency).toBe(3);
    expect(sweep.minConcurrency).toBe(3);
    expect(sweep.coveredSeconds).toBe(oracle.coveredSeconds);
    expect(sweep.longestGapSeconds).toBe(oracle.longestGapSeconds);
    expect(sweep.peakConcurrency).toBe(oracle.peakConcurrency);
    expect(sweep.minConcurrency).toBe(oracle.minConcurrency);
  });

  it('handles edge cases: identical start/end boundaries and nested intervals', () => {
    const intervals: TimeInterval[] = [
      { startSec: 100, endSec: 500 },
      { startSec: 200, endSec: 400 },
      { startSec: 200, endSec: 400 },
      { startSec: 250, endSec: 350 },
      { startSec: 500, endSec: 800 }, // contiguous boundary at 500
    ];
    const sweep = computeSweepLineMetrics(intervals, 1000);
    const oracle = bruteForceOracle(intervals, 1000);

    expect(sweep.coveredSeconds).toBe(oracle.coveredSeconds);
    expect(sweep.longestGapSeconds).toBe(oracle.longestGapSeconds);
    expect(sweep.peakConcurrency).toBe(oracle.peakConcurrency);
    expect(sweep.minConcurrency).toBe(oracle.minConcurrency);
  });

  it('handles massive concurrency spike at exact single second', () => {
    const spikeCount = 500;
    const intervals: TimeInterval[] = [];
    for (let i = 0; i < spikeCount; i++) {
      intervals.push({ startSec: 100, endSec: 200 });
    }
    const sweep = computeSweepLineMetrics(intervals, 300);
    const oracle = bruteForceOracle(intervals, 300);

    expect(sweep.peakConcurrency).toBe(spikeCount);
    expect(sweep.coveredSeconds).toBe(100);
    expect(sweep.longestGapSeconds).toBe(100);
    expect(sweep.coveredSeconds).toBe(oracle.coveredSeconds);
    expect(sweep.longestGapSeconds).toBe(oracle.longestGapSeconds);
    expect(sweep.peakConcurrency).toBe(oracle.peakConcurrency);
    expect(sweep.minConcurrency).toBe(oracle.minConcurrency);
  });
});

describe('Challenger M3 Suite 3: Reactive Store State Propagation & Coherence', () => {
  it('dispatches synchronously to subscribers and increments revision on madhab change', () => {
    const store = createAppStore();
    let stateCallOrder = 0;
    let configCallOrder = 0;
    let sequenceCounter = 0;

    const stateListener = vi.fn((newState, prevState) => {
      sequenceCounter++;
      stateCallOrder = sequenceCounter;
      expect(newState.config.madhab).toBe('Hanafi');
      expect(prevState.config.madhab).toBe('Shafi');
      expect(newState.revision).toBe(2);
      expect(prevState.revision).toBe(1);
    });

    const configListener = vi.fn((newConfig, revision) => {
      sequenceCounter++;
      configCallOrder = sequenceCounter;
      expect(newConfig.madhab).toBe('Hanafi');
      expect(revision).toBe(2);
    });

    store.subscribe(stateListener);
    store.subscribeConfig(configListener);

    const success = store.updateConfig({ madhab: 'Hanafi' });

    // Assert synchronous execution: listeners must have run before updateConfig returned
    expect(success).toBe(true);
    expect(stateListener).toHaveBeenCalledTimes(1);
    expect(configListener).toHaveBeenCalledTimes(1);
    expect(stateCallOrder).toBeGreaterThan(0);
    expect(configCallOrder).toBeGreaterThan(0);
    expect(store.getRevision()).toBe(2);
    expect(store.getConfig().madhab).toBe('Hanafi');
  });

  it('dispatches synchronously to subscribers and increments revision on convention change', () => {
    const store = createAppStore({ convention: 'UmmAlQura' });
    const configCalls: Array<{ convention: string; revision: number }> = [];

    store.subscribeConfig((config, rev) => {
      configCalls.push({ convention: config.convention, revision: rev });
    });

    const success = store.updateConfig({ convention: 'MuslimWorldLeague' });

    expect(success).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(configCalls).toEqual([{ convention: 'MuslimWorldLeague', revision: 2 }]);
  });

  it('dispatches synchronously to subscribers and increments revision on highLatitudeRule change', () => {
    const store = createAppStore();
    const configCalls: Array<{ rule: string; revision: number }> = [];

    store.subscribeConfig((config, rev) => {
      configCalls.push({ rule: config.highLatitudeRule, revision: rev });
    });

    const success = store.updateConfig({ highLatitudeRule: 'AngleBased' });

    expect(success).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(configCalls).toEqual([{ rule: 'AngleBased', revision: 2 }]);
  });

  it('increments revision once and dispatches once when multiple fields are updated together', () => {
    const store = createAppStore();
    const configListener = vi.fn();
    store.subscribeConfig(configListener);

    const success = store.updateConfig({
      madhab: 'Hanafi',
      convention: 'Egyptian',
      highLatitudeRule: 'SeventhOfTheNight',
    });

    expect(success).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(configListener).toHaveBeenCalledTimes(1);
    expect(store.getConfig().madhab).toBe('Hanafi');
    expect(store.getConfig().convention).toBe('Egyptian');
    expect(store.getConfig().highLatitudeRule).toBe('SeventhOfTheNight');
  });

  it('rejects invalid configuration updates without incrementing revision or notifying subscribers', () => {
    const store = createAppStore();
    const configListener = vi.fn();
    const stateListener = vi.fn();

    store.subscribeConfig(configListener);
    store.subscribe(stateListener);

    // Invalid convention
    const r1 = store.updateConfig({ convention: 'NonExistentConvention' as CalculationConventionName });
    expect(r1).toBe(false);
    expect(store.getRevision()).toBe(1);

    // Invalid madhab
    const r2 = store.updateConfig({ madhab: 'InvalidMadhab' as Madhab });
    expect(r2).toBe(false);
    expect(store.getRevision()).toBe(1);

    // Invalid highLatitudeRule
    const r3 = store.updateConfig({ highLatitudeRule: 'InvalidRule' as HighLatitudeRule });
    expect(r3).toBe(false);
    expect(store.getRevision()).toBe(1);

    // Invalid duration
    const r4 = store.updateConfig({ adhanDurationMinutes: -5 });
    expect(r4).toBe(false);
    expect(store.getRevision()).toBe(1);

    // Invalid mapStyle
    const r5 = store.updateConfig({ mapStyle: 'terrain' as any });
    expect(r5).toBe(false);
    expect(store.getRevision()).toBe(1);

    // Zero listener invocations
    expect(configListener).not.toHaveBeenCalled();
    expect(stateListener).not.toHaveBeenCalled();
  });

  it('isolates date and location mutations: modifies state without bumping configuration revision', () => {
    const store = createAppStore();
    const configListener = vi.fn();
    const stateListener = vi.fn();

    store.subscribeConfig(configListener);
    store.subscribe(stateListener);

    const newDate = new Date('2026-10-06T15:00:00Z');
    store.setDate(newDate);

    expect(store.getDate().getTime()).toBe(newDate.getTime());
    expect(store.getRevision()).toBe(1);
    expect(stateListener).toHaveBeenCalledTimes(1);
    expect(configListener).not.toHaveBeenCalled();

    const loc = {
      type: 'settlement' as const,
      latitude: 21.42,
      longitude: 39.83,
      nameEn: 'Makkah',
    };
    store.setLocation(loc);

    expect(store.getLocation()).toEqual(loc);
    expect(store.getRevision()).toBe(1);
    expect(stateListener).toHaveBeenCalledTimes(2);
    expect(configListener).not.toHaveBeenCalled();
  });

  it('listener error does not crash the store or prevent other listeners from receiving updates', () => {
    const store = createAppStore();
    const errorListener = vi.fn(() => {
      throw new Error('Listener failed intentional challenge test');
    });
    const healthyListener = vi.fn();

    store.subscribeConfig(errorListener);
    store.subscribeConfig(healthyListener);

    const success = store.updateConfig({ madhab: 'Hanafi' });

    expect(success).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledTimes(1);
  });

  it('atomic validation: rejects entire update if any field is invalid, preserving original state', () => {
    const store = createAppStore({ madhab: 'Shafi', convention: 'UmmAlQura' });
    const configListener = vi.fn();
    store.subscribeConfig(configListener);

    // Mixed valid and invalid update
    const result = store.updateConfig({
      madhab: 'Hanafi',
      convention: 'CompletelyBogusConvention' as CalculationConventionName,
    });

    expect(result).toBe(false);
    expect(store.getRevision()).toBe(1);
    expect(store.getConfig().madhab).toBe('Shafi'); // Did NOT partially apply Hanafi!
    expect(store.getConfig().convention).toBe('UmmAlQura');
    expect(configListener).not.toHaveBeenCalled();
  });

  it('supports listeners unsubscribing during dispatch without skipping subsequent listeners', () => {
    const store = createAppStore();
    const callLog: string[] = [];

    let unsub2: () => void;
    const l1 = vi.fn(() => callLog.push('l1'));
    const l2 = vi.fn(() => {
      callLog.push('l2');
      unsub2();
    });
    const l3 = vi.fn(() => callLog.push('l3'));

    store.subscribeConfig(l1);
    unsub2 = store.subscribeConfig(l2);
    store.subscribeConfig(l3);

    store.updateConfig({ madhab: 'Hanafi' });
    expect(callLog).toEqual(['l1', 'l2', 'l3']);

    // Second update: l2 should not be called
    callLog.length = 0;
    store.updateConfig({ madhab: 'Shafi' });
    expect(callLog).toEqual(['l1', 'l3']);
  });

  it('safely ignores invalid dates in setDate', () => {
    const store = createAppStore();
    const originalDate = store.getDate();
    const stateListener = vi.fn();
    store.subscribe(stateListener);

    store.setDate(new Date(NaN));
    expect(store.getDate().getTime()).toBe(originalDate.getTime());
    expect(stateListener).not.toHaveBeenCalled();

    store.setDate('not-a-date' as any);
    expect(store.getDate().getTime()).toBe(originalDate.getTime());
    expect(stateListener).not.toHaveBeenCalled();
  });

  it('handles rapid sequential updates monotonically', () => {
    const store = createAppStore();
    const revisions: number[] = [];
    store.subscribeConfig((_, rev) => revisions.push(rev));

    for (let i = 0; i < 50; i++) {
      const madhab: Madhab = i % 2 === 0 ? 'Hanafi' : 'Shafi';
      store.updateConfig({ madhab });
    }

    expect(store.getRevision()).toBe(51);
    expect(revisions.length).toBe(50);
    expect(revisions[0]).toBe(2);
    expect(revisions[49]).toBe(51);
  });
});

describe('Challenger M3 Suite 4: Binning Mathematical Oracle', () => {
  /**
   * Independent binning oracle:
   * A half-open interval [startSec, endSec) touches 300s bin b [b*300, (b+1)*300)
   * iff startSec < (b+1)*300 AND endSec > b*300.
   */
  function binOracle(intervals: TimeInterval[], binCount = 288): number[] {
    const bins = new Array(binCount).fill(0);
    for (let b = 0; b < binCount; b++) {
      const bStart = b * 300;
      const bEnd = (b + 1) * 300;
      for (const iv of intervals) {
        if (iv.startSec < bEnd && iv.endSec > bStart) {
          bins[b]++;
        }
      }
    }
    return bins;
  }

  it('timeline bin formula strictly matches independent binning intersection oracle', () => {
    const rng = new SeededRng(777);
    const intervals: TimeInterval[] = [];
    for (let i = 0; i < 200; i++) {
      const startSec = rng.nextInt(0, 86000);
      const durationSec = rng.nextInt(60, 600);
      intervals.push({ startSec, endSec: startSec + durationSec });
    }

    const binCount = 288;
    const formulaBins = new Array(binCount).fill(0);
    for (const iv of intervals) {
      const firstBin = Math.max(0, Math.min(binCount - 1, Math.floor(iv.startSec / 300)));
      const lastBin = Math.max(0, Math.min(binCount - 1, Math.floor((iv.endSec - 1e-6) / 300)));
      for (let b = firstBin; b <= lastBin; b++) {
        formulaBins[b]++;
      }
    }

    const expectedBins = binOracle(intervals, binCount);
    expect(formulaBins).toEqual(expectedBins);
  });

  it('verifies positive-length interval invariant and analyzes degenerate zero-length interval boundary splitting', () => {
    // Normal positive-length intervals
    const normalIntervals: TimeInterval[] = [
      { startSec: 100, endSec: 200 },
      { startSec: 300, endSec: 400 },
    ];
    const normalSweep = computeSweepLineMetrics(normalIntervals, 500);
    const normalOracle = bruteForceOracle(normalIntervals, 500);
    expect(normalSweep.coveredSeconds).toBe(normalOracle.coveredSeconds);
    expect(normalSweep.longestGapSeconds).toBe(normalOracle.longestGapSeconds);
    expect(normalSweep.longestGapSeconds).toBe(100); // Gaps: [0, 100)=100, [200, 300)=100, [400, 500)=100

    // Degenerate zero-length interval [250, 250) in empty gap [200, 300)
    // Note: computeGlobalAdhanContinuity guarantees clampedStartMs < clampedEndMs,
    // so zero-length intervals never occur in production.
    // When a degenerate zero-length event [250, 250) occurs during concurrency=0,
    // uniqueTimes registers 250 as a boundary, splitting [200, 300) into [200, 250) and [250, 300).
    const degenerateIntervals: TimeInterval[] = [
      { startSec: 100, endSec: 200 },
      { startSec: 250, endSec: 250 }, // degenerate point
    ];
    const degenSweep = computeSweepLineMetrics(degenerateIntervals, 500);
    // Coverage is unaffected (100 seconds)
    expect(degenSweep.coveredSeconds).toBe(100);
    expect(degenSweep.peakConcurrency).toBe(1);
    // Boundary at 250 splits the [200, 500) gap into [200, 250)=50 and [250, 500)=250
    expect(degenSweep.longestGapSeconds).toBe(250);
  });
});

