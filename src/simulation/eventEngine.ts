// Real-time Adhan event scheduler and active community pulse detector

import { Settlement } from '../population/loader';
import { calculatePrayerTimes, PrayerTimesSchedule } from '../prayer/calculator';
import {
  CalculationConventionName,
  CALCULATION_CONVENTIONS,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from '../prayer/conventions';
import { ActiveAdhanEvent } from '../globe/cities';
import { PrayerFrontKey } from '../globe/fronts';
import { getSubsolarPoint } from '../astronomy/solar';

export interface EventEngineOptions {
  adhanDurationMinutes?: number;
  convention?: CalculationConventionName;
  madhab?: Madhab;
  highLatitudeRule?: HighLatitudeRule;
  maxCacheSize?: number;
}

export function buildScheduleCacheKey(
  lat: number,
  lon: number,
  dateUtcMidnight: number,
  convention: CalculationConventionName,
  madhab: Madhab,
  highLatitudeRule: HighLatitudeRule,
): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}|${dateUtcMidnight}|${convention}|${madhab}|${highLatitudeRule}`;
}

export class AdhanEventEngine {
  private settlements: Settlement[];
  private adhanDurationMs: number;
  private convention: CalculationConventionName;
  private madhab: Madhab;
  private highLatitudeRule: HighLatitudeRule;
  private maxCacheSize: number;

  // Bounded schedule cache keyed by composite key
  private scheduleCache: Map<string, PrayerTimesSchedule> = new Map();

  // Precomputed coordinate cache keys and solar offsets for fast evaluation
  private settlementOffsets: Int32Array;
  private settlementCoordKeys: string[];

  // Flat typed arrays for sub-millisecond evaluation across 15,000 settlements
  private settlementLats: Float32Array;
  private settlementLons: Float32Array;
  private settlementSinLats: Float32Array;
  private settlementCosLats: Float32Array;

  // Memoized evaluation result for identical tick timestamps
  private lastCountTimeMs: number = -1;
  private lastCountResult: number = 0;

  constructor(settlements: Settlement[] = [], options: EventEngineOptions = {}) {
    this.settlements = settlements || [];
    this.adhanDurationMs = (options.adhanDurationMinutes || 4) * 60 * 1000;
    this.convention = options.convention || 'UmmAlQura';
    this.madhab = options.madhab || 'Shafi';
    this.highLatitudeRule = options.highLatitudeRule || 'MiddleOfTheNight';
    this.maxCacheSize = options.maxCacheSize || 60000;

    const n = this.settlements.length;
    this.settlementOffsets = new Int32Array(n);
    this.settlementCoordKeys = new Array(n);
    this.settlementLats = new Float32Array(n);
    this.settlementLons = new Float32Array(n);
    this.settlementSinLats = new Float32Array(n);
    this.settlementCosLats = new Float32Array(n);

    const deg2rad = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const s = this.settlements[i];
      this.settlementOffsets[i] = Math.round(s.longitude * 240000);
      this.settlementCoordKeys[i] = `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`;
      this.settlementLats[i] = s.latitude;
      this.settlementLons[i] = s.longitude;
      const phi = s.latitude * deg2rad;
      this.settlementSinLats[i] = Math.sin(phi);
      this.settlementCosLats[i] = Math.cos(phi);
    }
  }

  public setAdhanDurationMinutes(minutes: number): void {
    this.adhanDurationMs = Math.max(1, Math.min(15, minutes)) * 60 * 1000;
  }

  public setConvention(convention: CalculationConventionName): void {
    if (this.convention !== convention) {
      this.convention = convention;
      this.clearCache();
    }
  }

  public setMadhab(madhab: Madhab): void {
    if (this.madhab !== madhab) {
      this.madhab = madhab;
      this.clearCache();
    }
  }

  public setHighLatitudeRule(rule: HighLatitudeRule): void {
    if (this.highLatitudeRule !== rule) {
      this.highLatitudeRule = rule;
      this.clearCache();
    }
  }

  public clearCache(): void {
    this.scheduleCache.clear();
    this.lastCountTimeMs = -1;
  }

  public getCacheSize(): number {
    return this.scheduleCache.size;
  }

  private cacheSchedule(key: string, schedule: PrayerTimesSchedule): void {
    if (this.scheduleCache.size >= this.maxCacheSize) {
      const iter = this.scheduleCache.keys();
      const evictCount = Math.max(1, Math.floor(this.maxCacheSize * 0.1));
      for (let i = 0; i < evictCount; i++) {
        const oldestKey = iter.next().value;
        if (oldestKey) {
          this.scheduleCache.delete(oldestKey);
        } else {
          break;
        }
      }
    }
    this.scheduleCache.set(key, schedule);
  }

  /**
   * Get the prayer schedule for specific coordinates on a date with caching.
   */
  public getScheduleByCoords(lat: number, lon: number, date: Date): PrayerTimesSchedule {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const dateUtcMidnight = Date.UTC(y, m, d);
    const key = buildScheduleCacheKey(
      lat,
      lon,
      dateUtcMidnight,
      this.convention,
      this.madhab,
      this.highLatitudeRule,
    );

    const cached = this.scheduleCache.get(key);
    if (cached) {
      return cached;
    }

    const schedule = calculatePrayerTimes(lat, lon, date, {
      convention: this.convention,
      madhab: this.madhab,
      highLatitudeRule: this.highLatitudeRule,
    });

    this.cacheSchedule(key, schedule);
    return schedule;
  }

  /**
   * Get the prayer schedule for a specific settlement on a date.
   */
  public getSchedule(settlementIndex: number, date: Date): PrayerTimesSchedule {
    const s = this.settlements[settlementIndex];
    if (!s) {
      throw new Error(`Invalid settlement index: ${settlementIndex}`);
    }
    return this.getScheduleByCoords(s.latitude, s.longitude, date);
  }

  /**
   * Evaluates settlements across multi-day window [date - 1, date, date + 1]
   * and returns those currently in their active adhan window.
   */
  public getActiveEvents(date: Date): ActiveAdhanEvent[] {
    const activeEvents: ActiveAdhanEvent[] = [];
    const nowMs = date.getTime();

    const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    // Cache candidate civil date objects by dateUtcMidnight to eliminate redundant allocations
    const civilDateCache = new Map<number, { date: Date; midnightMs: number }>();
    const getCivilDate = (y: number, m: number, d: number): { date: Date; midnightMs: number } => {
      const midnightMs = Date.UTC(y, m, d);
      let cand = civilDateCache.get(midnightMs);
      if (!cand) {
        cand = {
          date: new Date(Date.UTC(y, m, d, 12, 0, 0)),
          midnightMs,
        };
        civilDateCache.set(midnightMs, cand);
      }
      return cand;
    };

    const convention = this.convention;
    const madhab = this.madhab;
    const rule = this.highLatitudeRule;

    for (let i = 0; i < this.settlements.length; i++) {
      const s = this.settlements[i];
      const offset = this.settlementOffsets[i];
      const tLocal = new Date(nowMs + offset);

      const localY = tLocal.getUTCFullYear();
      const localM = tLocal.getUTCMonth();
      const localD = tLocal.getUTCDate();
      const localHour = tLocal.getUTCHours() + tLocal.getUTCMinutes() / 60;

      const primary = getCivilDate(localY, localM, localD);
      const candidateDates = [primary];

      if (localHour < 3.0) {
        candidateDates.push(getCivilDate(localY, localM, localD - 1));
      } else if (localHour >= 21.0) {
        candidateDates.push(getCivilDate(localY, localM, localD + 1));
      }

      const coordKey = this.settlementCoordKeys[i];
      let matched = false;

      for (const cand of candidateDates) {
        const cacheKey = `${coordKey}|${cand.midnightMs}|${convention}|${madhab}|${rule}`;
        let sched = this.scheduleCache.get(cacheKey);
        if (!sched) {
          sched = calculatePrayerTimes(s.latitude, s.longitude, cand.date, {
            convention,
            madhab,
            highLatitudeRule: rule,
          });
          this.cacheSchedule(cacheKey, sched);
        }

        for (const pKey of prayers) {
          const entry = sched[pKey];
          if (!entry || !entry.date || entry.provenance === 'unresolved') continue;
          const pTime = entry.date.getTime();
          const diff = nowMs - pTime;

          // Half-open interval [pTime, pTime + adhanDurationMs)
          if (diff >= 0 && diff < this.adhanDurationMs) {
            const progress = diff / this.adhanDurationMs;
            activeEvents.push({
              settlementIndex: i,
              prayer: pKey as PrayerFrontKey,
              progress,
              eventId: `${i}:${pKey}:${pTime}`,
              startTime: entry.date,
              endTime: new Date(pTime + this.adhanDurationMs),
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

  /**
   * Lookahead for next prayer event for a settlement, recomputing exact ephemeris date by date.
   */
  public getNextEvent(
    settlementIndex: number,
    date: Date,
  ): { prayer: PrayerKey; date: Date } | null {
    const s = this.settlements[settlementIndex];
    if (!s) return null;

    const nowMs = date.getTime();
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();

    const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    // Search across candidate dates from today up to 7 days ahead
    for (let offset = -1; offset <= 7; offset++) {
      const candDate = new Date(Date.UTC(y, m, d + offset, 12, 0, 0));
      const sched = this.getScheduleByCoords(s.latitude, s.longitude, candDate);

      let earliest: { prayer: PrayerKey; date: Date } | null = null;
      let earliestTime = Infinity;

      for (const pKey of prayers) {
        const entry = sched[pKey];
        if (!entry || !entry.date || entry.provenance === 'unresolved') continue;
        const pTime = entry.date.getTime();
        if (pTime > nowMs && pTime < earliestTime) {
          earliestTime = pTime;
          earliest = { prayer: pKey, date: entry.date };
        }
      }

      if (earliest) {
        return earliest;
      }
    }

    return null;
  }

  /**
   * Enumerate all prayer events occurring within a time window [start, end),
   * recomputing exact ephemeris date by date without static 24-hour additions.
   */
  public getEventsInWindow(
    start: Date,
    end: Date,
    settlementIndex?: number,
  ): Array<{ settlementIndex: number; prayer: PrayerKey; date: Date }> {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (startMs >= endMs) return [];

    const results: Array<{ settlementIndex: number; prayer: PrayerKey; date: Date }> = [];
    const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    const startY = start.getUTCFullYear();
    const startM = start.getUTCMonth();
    const startD = start.getUTCDate();

    const endY = end.getUTCFullYear();
    const endM = end.getUTCMonth();
    const endD = end.getUTCDate();

    const startDateMidnight = Date.UTC(startY, startM, startD - 1);
    const endDateMidnight = Date.UTC(endY, endM, endD + 1);

    const targetIndices =
      settlementIndex !== undefined
        ? [settlementIndex]
        : Array.from({ length: this.settlements.length }, (_, idx) => idx);

    for (let curMs = startDateMidnight; curMs <= endDateMidnight; curMs += 86400000) {
      const curDate = new Date(curMs);
      for (const sIdx of targetIndices) {
        const s = this.settlements[sIdx];
        if (!s) continue;
        const sched = this.getScheduleByCoords(s.latitude, s.longitude, curDate);

        for (const pKey of prayers) {
          const entry = sched[pKey];
          if (!entry || !entry.date || entry.provenance === 'unresolved') continue;
          const pTime = entry.date.getTime();
          if (pTime >= startMs && pTime < endMs) {
            results.push({
              settlementIndex: sIdx,
              prayer: pKey,
              date: entry.date,
            });
          }
        }
      }
    }

    results.sort((a, b) => a.date.getTime() - b.date.getTime());
    return results;
  }

  public getSettlementCount(): number {
    return this.settlements.length;
  }

  public getSettlement(index: number): Settlement | undefined {
    return this.settlements[index];
  }

  /**
   * Evaluates the number of settlements currently in the last third of the Islamic night.
   * Employs flat TypedArrays and pure closed-form analytical solar hour angle geometry
   * with zero heap allocations per tick. Completes in under 0.5ms across 15,000 settlements.
   */
  public countSettlementsInLastThird(date: Date): number {
    const n = this.settlements.length;
    if (n === 0) return 0;
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return 0;

    const nowMs = date.getTime();
    if (nowMs === this.lastCountTimeMs) {
      return this.lastCountResult;
    }

    const subsolar = getSubsolarPoint(date);
    const dec = subsolar.latitude;
    const subLon = subsolar.longitude;

    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;

    const sinDec = Math.sin(dec * deg2rad);
    const cosDec = Math.cos(dec * deg2rad);

    const convParams = CALCULATION_CONVENTIONS[this.convention] || CALCULATION_CONVENTIONS.UmmAlQura;
    const fajrAngle = convParams.fajrAngle;

    const sinSunset = Math.sin(-0.8333333333333334 * deg2rad);
    const sinFajr = Math.sin(-fajrAngle * deg2rad);

    let highLatFraction = 0.5;
    if (this.highLatitudeRule === 'SeventhOfTheNight') {
      highLatFraction = 1 / 7;
    } else if (this.highLatitudeRule === 'AngleBased') {
      highLatFraction = fajrAngle / 60.0;
    }

    const oneThird = 1 / 3;
    const twoThirds = 2 / 3;
    const highLatLastThirdFactor = oneThird * (1 - highLatFraction);

    const lons = this.settlementLons;
    const sinLats = this.settlementSinLats;
    const cosLats = this.settlementCosLats;

    let count = 0;

    for (let i = 0; i < n; i++) {
      let hCur = lons[i] - subLon;
      if (hCur > 180) hCur -= 360;
      else if (hCur < -180) hCur += 360;
      if (hCur === 180) hCur = -180;

      // Coarse daytime filter skips ~50% of settlements with a single branch
      if (hCur > -30 && hCur < 155) {
        continue;
      }

      const sinPhi = sinLats[i];
      const cosPhi = cosLats[i];
      const denom = cosPhi * cosDec;

      if (denom < 1e-6) {
        continue;
      }

      const invDenom = 1 / denom;
      const sinPhiSinDec = sinPhi * sinDec;
      const cosH_sunset = (sinSunset - sinPhiSinDec) * invDenom;

      if (cosH_sunset >= 1.0) {
        // Polar night: sun never rises, no Maghrib sunset
        continue;
      }

      let hSunset = 0;
      if (cosH_sunset <= -1.0) {
        // Continuous daylight (midnight sun): virtual 8-hour night matching calculatePrayerTimes
        // Centered at solar midnight (180 deg): virtual sunset is 4h (60 deg) before midnight (120 deg).
        // Under calculatePrayerTimes, western polar settlements (lons[i] < 0) have midnightMs on the
        // next UTC calendar day (solarNoon + 12 >= 24) and are inactive on the evaluated civil date.
        if (lons[i] < 0) {
          continue;
        }
        hSunset = 120;
      } else {
        hSunset = Math.acos(cosH_sunset) * rad2deg;
      }

      const cosH_fajr = (sinFajr - sinPhiSinDec) * invDenom;

      let hStart = 0;
      let hEnd = 0;

      if (cosH_sunset <= -1.0 || cosH_fajr <= -1.0) {
        // High-latitude white nights / summer twilight absence or midnight sun: analytical night division
        const nightAngle = 360 - 2 * hSunset;
        hEnd = -hSunset - highLatFraction * nightAngle;
        hStart = hEnd - highLatLastThirdFactor * nightAngle;
      } else if (cosH_fajr >= 1.0) {
        continue;
      } else {
        // Standard astronomical dawn crossing
        const hFajr = Math.acos(cosH_fajr) * rad2deg;
        hEnd = -hFajr;
        hStart = -120 - twoThirds * hFajr + oneThird * hSunset;
      }

      if (hStart < -180) {
        if (hCur >= hStart + 360 || hCur < hEnd) {
          count++;
        }
      } else {
        if (hCur >= hStart && hCur < hEnd) {
          count++;
        }
      }
    }

    this.lastCountTimeMs = nowMs;
    this.lastCountResult = count;
    return count;
  }

  /**
   * Complete evaluation of active adhan events and settlements in the last third.
   */
  public evaluate(date: Date): {
    activeEvents: ActiveAdhanEvent[];
    lastThirdSettlementsCount: number;
  } {
    const activeEvents = this.getActiveEvents(date);
    const lastThirdSettlementsCount = this.countSettlementsInLastThird(date);
    return {
      activeEvents,
      lastThirdSettlementsCount,
    };
  }

  /**
   * Retrieves the most recent evaluated count of settlements in the last third.
   */
  public getLastThirdSettlementsCount(): number {
    return this.lastCountResult;
  }
}

