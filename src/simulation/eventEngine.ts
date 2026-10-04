// Real-time Adhan event scheduler and active community pulse detector

import { Settlement } from '../population/loader';
import { calculatePrayerTimes, PrayerTimesSchedule } from '../prayer/calculator';
import {
  CalculationConventionName,
  Madhab,
  PrayerKey,
} from '../prayer/conventions';
import { ActiveAdhanEvent } from '../globe/cities';
import { PrayerFrontKey } from '../globe/fronts';

export interface EventEngineOptions {
  adhanDurationMinutes?: number;
  convention?: CalculationConventionName;
  madhab?: Madhab;
}

export class AdhanEventEngine {
  private settlements: Settlement[];
  private adhanDurationMs: number;
  private convention: CalculationConventionName;
  private madhab: Madhab;

  // Longitudinal bins (360 bins of 1 degree longitude) for fast spatial pruning
  private lonBins: number[][] = [];

  constructor(settlements: Settlement[], options: EventEngineOptions = {}) {
    this.settlements = settlements;
    this.adhanDurationMs = (options.adhanDurationMinutes || 4) * 60 * 1000;
    this.convention = options.convention || 'UmmAlQura';
    this.madhab = options.madhab || 'Shafi';
    this.buildSpatialBins();
  }

  private buildSpatialBins(): void {
    this.lonBins = Array.from({ length: 360 }, () => []);
    for (let i = 0; i < this.settlements.length; i++) {
      const s = this.settlements[i];
      let bin = Math.floor(s.longitude + 180);
      if (bin < 0) bin = 0;
      if (bin >= 360) bin = 359;
      this.lonBins[bin].push(i);
    }
  }

  public setAdhanDurationMinutes(minutes: number): void {
    this.adhanDurationMs = Math.max(1, Math.min(15, minutes)) * 60 * 1000;
  }

  public setConvention(convention: CalculationConventionName): void {
    this.convention = convention;
  }

  public setMadhab(madhab: Madhab): void {
    this.madhab = madhab;
  }

  /**
   * Get the prayer schedule for a specific settlement on a date.
   */
  public getSchedule(settlementIndex: number, date: Date): PrayerTimesSchedule {
    const s = this.settlements[settlementIndex];
    return calculatePrayerTimes(s.latitude, s.longitude, date, {
      convention: this.convention,
      madhab: this.madhab,
    });
  }

  /**
   * Evaluates all settlements and returns those currently in their active adhan window.
   */
  public getActiveEvents(date: Date): ActiveAdhanEvent[] {
    const activeEvents: ActiveAdhanEvent[] = [];
    const nowMs = date.getTime();

    // Check each settlement's prayer times
    // With 15,000 settlements, checking takes ~1-2ms in pure V8 JIT
    for (let i = 0; i < this.settlements.length; i++) {
      const s = this.settlements[i];
      const sched = calculatePrayerTimes(s.latitude, s.longitude, date, {
        convention: this.convention,
        madhab: this.madhab,
      });

      const prayers: { key: PrayerKey; time: Date }[] = [
        { key: 'fajr', time: sched.fajr },
        { key: 'dhuhr', time: sched.dhuhr },
        { key: 'asr', time: sched.asr },
        { key: 'maghrib', time: sched.maghrib },
        { key: 'isha', time: sched.isha },
      ];

      for (const p of prayers) {
        const pTime = p.time.getTime();
        const diff = nowMs - pTime;
        if (diff >= 0 && diff < this.adhanDurationMs) {
          const progress = diff / this.adhanDurationMs;
          activeEvents.push({
            settlementIndex: i,
            prayer: p.key as PrayerFrontKey,
            progress,
          });
          break; // A city can only call one adhan at a time
        }
      }
    }

    return activeEvents;
  }

  public getSettlementCount(): number {
    return this.settlements.length;
  }

  public getSettlement(index: number): Settlement | undefined {
    return this.settlements[index];
  }
}
