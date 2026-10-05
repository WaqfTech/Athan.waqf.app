// 24-Hour Global Adhan Continuity Calculator and Statistical Analysis Engine

import { Settlement } from '../population/loader';
import { calculatePrayerTimes } from '../prayer/calculator';
import {
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from '../prayer/conventions';

export interface ContinuityStats {
  settlementCount: number;
  dateString: string;
  convention: CalculationConventionName;
  madhab: Madhab;
  highLatitudeRule?: HighLatitudeRule;
  adhanDurationMinutes: number;
  /** Coverage percentage across 24 hours [0.0, 100.0] */
  coveragePercent: number;
  /** Total seconds covered by at least one adhan */
  coveredSeconds: number;
  /** Longest interval without any active adhan anywhere on Earth in seconds */
  longestGapSeconds: number;
  /** Peak number of concurrent adhan events across timeline bins */
  peakConcurrentAdhans: number;
  /** Minimum number of concurrent adhan events across timeline bins */
  minConcurrentAdhans: number;
  /** 288 5-minute bins across 24h representing active adhan density */
  timelineBins: number[];
  /** Exact instantaneous peak concurrency from sweep-line algorithm */
  instantaneousPeak?: number;
  /** Exact instantaneous minimum concurrency from sweep-line algorithm */
  instantaneousMin?: number;
}

export interface TimeInterval {
  startSec: number;
  endSec: number;
}

export interface SweepLineResult {
  coveredSeconds: number;
  longestGapSeconds: number;
  peakConcurrency: number;
  minConcurrency: number;
}

/**
 * Merges overlapping intervals sorted by start time.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startSec - b.startSec);
  const merged: TimeInterval[] = [{ startSec: sorted[0].startSec, endSec: sorted[0].endSec }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.startSec <= prev.endSec) {
      prev.endSec = Math.max(prev.endSec, curr.endSec);
    } else {
      merged.push({ startSec: curr.startSec, endSec: curr.endSec });
    }
  }

  return merged;
}

/**
 * Computes exact continuous metrics via sweep-line algorithm over interval endpoints [start, end).
 */
export function computeSweepLineMetrics(
  intervals: TimeInterval[],
  windowSeconds = 86400,
): SweepLineResult {
  if (intervals.length === 0) {
    return {
      coveredSeconds: 0,
      longestGapSeconds: windowSeconds,
      peakConcurrency: 0,
      minConcurrency: 0,
    };
  }

  interface BoundaryEvent {
    time: number;
    delta: number;
  }
  const events: BoundaryEvent[] = [];
  for (const iv of intervals) {
    events.push({ time: iv.startSec, delta: 1 });
    events.push({ time: iv.endSec, delta: -1 });
  }

  // Sort events chronologically.
  events.sort((a, b) => a.time - b.time);

  // Group by unique timestamps to resolve cancelling endpoints at the same instant
  const uniqueTimes: number[] = [];
  const deltas: number[] = [];

  for (const ev of events) {
    if (uniqueTimes.length === 0 || uniqueTimes[uniqueTimes.length - 1] !== ev.time) {
      uniqueTimes.push(ev.time);
      deltas.push(ev.delta);
    } else {
      deltas[deltas.length - 1] += ev.delta;
    }
  }

  let currentConcurrency = 0;
  let peakConcurrency = 0;
  let minConcurrency = Infinity;
  let coveredSeconds = 0;
  let longestGapSeconds = 0;

  // Initial gap before the first event
  if (uniqueTimes[0] > 0) {
    longestGapSeconds = uniqueTimes[0];
    minConcurrency = 0;
  }

  for (let i = 0; i < uniqueTimes.length; i++) {
    const t = uniqueTimes[i];
    currentConcurrency += deltas[i];

    if (currentConcurrency > peakConcurrency) {
      peakConcurrency = currentConcurrency;
    }

    const nextT = i + 1 < uniqueTimes.length ? uniqueTimes[i + 1] : windowSeconds;
    const duration = nextT - t;

    if (duration > 0) {
      if (currentConcurrency < minConcurrency) {
        minConcurrency = currentConcurrency;
      }
      if (currentConcurrency > 0) {
        coveredSeconds += duration;
      } else {
        if (duration > longestGapSeconds) {
          longestGapSeconds = duration;
        }
      }
    }
  }

  // Trailing gap after the last event
  const lastTime = uniqueTimes[uniqueTimes.length - 1];
  if (lastTime < windowSeconds) {
    const trailingGap = windowSeconds - lastTime;
    if (trailingGap > longestGapSeconds) {
      longestGapSeconds = trailingGap;
    }
    minConcurrency = 0;
  }

  if (minConcurrency === Infinity) {
    minConcurrency = 0;
  }

  return {
    coveredSeconds: Math.round(coveredSeconds),
    longestGapSeconds: Math.round(longestGapSeconds),
    peakConcurrency,
    minConcurrency,
  };
}

export function computeGlobalAdhanContinuity(
  settlements: Settlement[],
  date: Date,
  options: {
    convention?: CalculationConventionName;
    madhab?: Madhab;
    highLatitudeRule?: HighLatitudeRule;
    adhanDurationMinutes?: number;
  } = {},
): ContinuityStats {
  const convention = options.convention || 'MuslimWorldLeague';
  const madhab = options.madhab || 'Shafi';
  const highLatitudeRule = options.highLatitudeRule || 'MiddleOfTheNight';
  const durationMinutes = options.adhanDurationMinutes || 4;
  const durationSeconds = durationMinutes * 60;

  const binCount = 288; // 5-minute bins across 24h
  const timelineBins = new Array(binCount).fill(0);
  const rawIntervals: TimeInterval[] = [];

  const baseYear = date.getUTCFullYear();
  const baseMonth = date.getUTCMonth();
  const baseDay = date.getUTCDate();
  const windowStartMs = Date.UTC(baseYear, baseMonth, baseDay);
  const windowEndMs = windowStartMs + 86400 * 1000;

  const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  // Enumerate candidate civil dates [date - 1 day, date, date + 1 day]
  // to capture all prayers whose adhan interval overlaps [windowStartMs, windowEndMs)
  const candidateDates = [
    new Date(Date.UTC(baseYear, baseMonth, baseDay - 1, 12, 0, 0)),
    new Date(Date.UTC(baseYear, baseMonth, baseDay, 12, 0, 0)),
    new Date(Date.UTC(baseYear, baseMonth, baseDay + 1, 12, 0, 0)),
  ];

  for (const s of settlements) {
    for (const candDate of candidateDates) {
      const sched = calculatePrayerTimes(s.latitude, s.longitude, candDate, {
        convention,
        madhab,
        highLatitudeRule,
      });

      for (const p of prayers) {
        const entry = sched[p];
        // Filter out unresolved prayers (Criterion A25) and null dates
        if (!entry || !entry.date || entry.provenance === 'unresolved') continue;

        const pTimeMs = entry.date.getTime();
        const pEndMs = pTimeMs + durationSeconds * 1000;

        // Clip interval strictly to [windowStartMs, windowEndMs)
        const clampedStartMs = Math.max(windowStartMs, pTimeMs);
        const clampedEndMs = Math.min(windowEndMs, pEndMs);

        if (clampedStartMs < clampedEndMs) {
          const startSec = (clampedStartMs - windowStartMs) / 1000;
          const endSec = (clampedEndMs - windowStartMs) / 1000;
          rawIntervals.push({ startSec, endSec });

          // Increment all 5-minute bins that this adhan interval touches
          const firstBin = Math.max(0, Math.min(binCount - 1, Math.floor(startSec / 300)));
          const lastBin = Math.max(0, Math.min(binCount - 1, Math.floor((endSec - 1e-6) / 300)));
          for (let b = firstBin; b <= lastBin; b++) {
            timelineBins[b]++;
          }
        }
      }
    }
  }

  // Exact continuous metrics via sweep-line algorithm
  const sweepLine = computeSweepLineMetrics(rawIntervals, 86400);

  const coveredSeconds = sweepLine.coveredSeconds;
  const longestGapSeconds = sweepLine.longestGapSeconds;
  const coveragePercent = Math.min(100.0, Number(((coveredSeconds / 86400) * 100).toFixed(2)));

  // Bins metrics: eliminating the Math.min(..., 0) bug so minConcurrent reflects true bin minimum
  const peakConcurrentAdhans = timelineBins.length > 0 ? Math.max(...timelineBins) : 0;
  const minConcurrentAdhans =
    timelineBins.length > 0 && settlements.length > 0 ? Math.min(...timelineBins) : 0;

  return {
    settlementCount: settlements.length,
    dateString: date.toISOString().slice(0, 10),
    convention,
    madhab,
    highLatitudeRule,
    adhanDurationMinutes: durationMinutes,
    coveragePercent,
    coveredSeconds,
    longestGapSeconds,
    peakConcurrentAdhans,
    minConcurrentAdhans,
    timelineBins,
    instantaneousPeak: sweepLine.peakConcurrency,
    instantaneousMin: sweepLine.minConcurrency,
  };
}
