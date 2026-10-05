"use strict";
// 24-Hour Global Adhan Continuity Calculator and Statistical Analysis Engine
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeIntervals = mergeIntervals;
exports.computeGlobalAdhanContinuity = computeGlobalAdhanContinuity;
const calculator_1 = require("../prayer/calculator");
/**
 * Merges overlapping intervals and clamps within [0, 86400].
 */
function mergeIntervals(intervals) {
    if (intervals.length === 0)
        return [];
    // Split intervals that cross midnight
    const normalized = [];
    for (const iv of intervals) {
        let s = ((iv.startSec % 86400) + 86400) % 86400;
        let e = s + (iv.endSec - iv.startSec);
        if (e > 86400) {
            normalized.push({ startSec: s, endSec: 86400 });
            normalized.push({ startSec: 0, endSec: e - 86400 });
        }
        else {
            normalized.push({ startSec: s, endSec: e });
        }
    }
    normalized.sort((a, b) => a.startSec - b.startSec);
    const merged = [normalized[0]];
    for (let i = 1; i < normalized.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = normalized[i];
        if (curr.startSec <= prev.endSec) {
            prev.endSec = Math.max(prev.endSec, curr.endSec);
        }
        else {
            merged.push(curr);
        }
    }
    return merged;
}
function computeGlobalAdhanContinuity(settlements, date, options = {}) {
    const convention = options.convention || 'MuslimWorldLeague';
    const madhab = options.madhab || 'Shafi';
    const durationMinutes = options.adhanDurationMinutes || 4;
    const durationSeconds = durationMinutes * 60;
    const rawIntervals = [];
    const binCount = 288; // 5-minute bins across 24h (288 * 5 = 1440 min)
    const timelineBins = new Array(binCount).fill(0);
    const baseYear = date.getUTCFullYear();
    const baseMonth = date.getUTCMonth();
    const baseDay = date.getUTCDate();
    const midnightMs = Date.UTC(baseYear, baseMonth, baseDay);
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (const s of settlements) {
        const sched = (0, calculator_1.calculatePrayerTimes)(s.latitude, s.longitude, date, {
            convention,
            madhab,
        });
        for (const p of prayers) {
            const pTimeMs = sched[p].getTime();
            const offsetSeconds = (pTimeMs - midnightMs) / 1000;
            rawIntervals.push({
                startSec: offsetSeconds,
                endSec: offsetSeconds + durationSeconds,
            });
            // Increment timeline bins that this adhan touches
            const startBin = Math.floor((((offsetSeconds % 86400) + 86400) % 86400) / 300);
            const spanBins = Math.max(1, Math.ceil(durationSeconds / 300));
            for (let b = 0; b < spanBins; b++) {
                const binIdx = (startBin + b) % binCount;
                timelineBins[binIdx]++;
            }
        }
    }
    const merged = mergeIntervals(rawIntervals);
    let coveredSeconds = 0;
    let longestGapSeconds = 0;
    // Check gap between 0 and first interval start
    if (merged.length > 0 && merged[0].startSec > 0) {
        longestGapSeconds = Math.max(longestGapSeconds, merged[0].startSec);
    }
    for (let i = 0; i < merged.length; i++) {
        const iv = merged[i];
        coveredSeconds += iv.endSec - iv.startSec;
        if (i < merged.length - 1) {
            const nextIv = merged[i + 1];
            const gap = nextIv.startSec - iv.endSec;
            if (gap > longestGapSeconds) {
                longestGapSeconds = gap;
            }
        }
    }
    // Check gap between last interval end and 86400
    if (merged.length > 0) {
        const lastEnd = merged[merged.length - 1].endSec;
        if (lastEnd < 86400) {
            longestGapSeconds = Math.max(longestGapSeconds, 86400 - lastEnd);
        }
    }
    else {
        longestGapSeconds = 86400;
    }
    const coveragePercent = Math.min(100.0, (coveredSeconds / 86400) * 100);
    const peakConcurrentAdhans = Math.max(...timelineBins, 0);
    const minConcurrentAdhans = Math.min(...timelineBins, 0);
    return {
        settlementCount: settlements.length,
        dateString: date.toISOString().slice(0, 10),
        convention,
        madhab,
        adhanDurationMinutes: durationMinutes,
        coveragePercent: Number(coveragePercent.toFixed(2)),
        coveredSeconds: Math.round(coveredSeconds),
        longestGapSeconds: Math.round(longestGapSeconds),
        peakConcurrentAdhans,
        minConcurrentAdhans,
        timelineBins,
    };
}
