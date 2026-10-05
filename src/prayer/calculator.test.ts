import { describe, it, expect } from 'vitest';
import { calculatePrayerTimes } from './calculator';
import { CALCULATION_CONVENTIONS, CalculationConventionName } from './conventions';

describe('Prayer calculation engine', () => {
  it('calculates correct chronological order and provenance for Makkah prayer times', () => {
    // Makkah: lat 21.4225, lon 39.8262
    const date = new Date('2026-10-04T12:00:00Z');
    const schedule = calculatePrayerTimes(21.4225, 39.8262, date, {
      convention: 'UmmAlQura',
    });

    expect(schedule.fajr.date).not.toBeNull();
    expect(schedule.sunrise.date).not.toBeNull();
    expect(schedule.dhuhr.date).not.toBeNull();
    expect(schedule.asr.date).not.toBeNull();
    expect(schedule.maghrib.date).not.toBeNull();
    expect(schedule.isha.date).not.toBeNull();

    const tFajr = schedule.fajr.date!.getTime();
    const tSunrise = schedule.sunrise.date!.getTime();
    const tDhuhr = schedule.dhuhr.date!.getTime();
    const tAsr = schedule.asr.date!.getTime();
    const tMaghrib = schedule.maghrib.date!.getTime();
    const tIsha = schedule.isha.date!.getTime();

    expect(tFajr).toBeLessThan(tSunrise);
    expect(tSunrise).toBeLessThan(tDhuhr);
    expect(tDhuhr).toBeLessThan(tAsr);
    expect(tAsr).toBeLessThan(tMaghrib);
    expect(tMaghrib).toBeLessThan(tIsha);

    // Provenance verification
    expect(schedule.fajr.provenance).toBe('astronomicalSign');
    expect(schedule.sunrise.provenance).toBe('astronomicalSign');
    expect(schedule.dhuhr.provenance).toBe('astronomicalSign');
    expect(schedule.asr.provenance).toBe('astronomicalSign');
    expect(schedule.maghrib.provenance).toBe('astronomicalSign');
    expect(schedule.isha.provenance).toBe('fixedInterval');

    // Umm Al-Qura Isha is exactly 90 minutes after Maghrib
    const diffMinutes = (tIsha - tMaghrib) / 60000;
    expect(diffMinutes).toBeCloseTo(90, 1);
  });

  it('Hanafi Asr occurs strictly after Shafi Asr', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const shafi = calculatePrayerTimes(21.4225, 39.8262, date, { madhab: 'Shafi' });
    const hanafi = calculatePrayerTimes(21.4225, 39.8262, date, { madhab: 'Hanafi' });

    expect(shafi.asr.date).not.toBeNull();
    expect(hanafi.asr.date).not.toBeNull();
    expect(shafi.asr.provenance).toBe('astronomicalSign');
    expect(hanafi.asr.provenance).toBe('astronomicalSign');

    const diffMin = (hanafi.asr.date!.getTime() - shafi.asr.date!.getTime()) / 60000;
    expect(diffMin).toBeGreaterThan(30);
    expect(diffMin).toBeLessThan(80);
  });

  it('evaluates current and next prayer periods accurately', () => {
    const baseDate = new Date('2026-10-04T00:00:00Z');
    const schedule = calculatePrayerTimes(21.4225, 39.8262, baseDate);

    // 10 minutes after Dhuhr
    const duringDhuhr = new Date(schedule.dhuhr.date!.getTime() + 10 * 60000);
    const checked = calculatePrayerTimes(21.4225, 39.8262, duringDhuhr);

    expect(checked.currentPrayer).toBe('dhuhr');
    expect(checked.nextPrayer).toBe('asr');
    expect(checked.nextPrayerTime?.getTime()).toBe(schedule.asr.date!.getTime());
    expect(checked.countdownMs).toBeGreaterThan(0);
  });

  it('evaluates London high latitude rules and resolves AngleBased vs MiddleOfTheNight (Witness W03)', () => {
    // London: lat 51.5074, lon -0.1278 on Summer Solstice
    const summerDate = new Date('2026-06-21T12:00:00Z');

    const schedMiddle = calculatePrayerTimes(51.5074, -0.1278, summerDate, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    const schedSeventh = calculatePrayerTimes(51.5074, -0.1278, summerDate, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'SeventhOfTheNight',
    });
    const schedAngle = calculatePrayerTimes(51.5074, -0.1278, summerDate, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'AngleBased',
    });

    // All three should have highLatitudeAdjustment provenance
    expect(schedMiddle.fajr.provenance).toBe('highLatitudeAdjustment');
    expect(schedMiddle.fajr.ruleApplied).toBe('MiddleOfTheNight');

    expect(schedSeventh.fajr.provenance).toBe('highLatitudeAdjustment');
    expect(schedSeventh.fajr.ruleApplied).toBe('SeventhOfTheNight');

    expect(schedAngle.fajr.provenance).toBe('highLatitudeAdjustment');
    expect(schedAngle.fajr.ruleApplied).toBe('AngleBased');

    const tMiddle = schedMiddle.fajr.date!.getTime();
    const tSeventh = schedSeventh.fajr.date!.getTime();
    const tAngle = schedAngle.fajr.date!.getTime();

    // Verify AngleBased does NOT alias to MiddleOfTheNight (Witness W03)
    const diffAngleMiddleMin = Math.abs(tAngle - tMiddle) / 60000;
    expect(diffAngleMiddleMin).toBeGreaterThan(60);

    // AngleBased fraction (18/60 = 0.30) lies strictly between Seventh (1/7 ~= 0.14) and Middle (1/2 = 0.50)
    // Earlier Fajr means larger fraction of night subtracted from sunrise, so tMiddle < tAngle < tSeventh
    expect(tMiddle).toBeLessThan(tAngle);
    expect(tAngle).toBeLessThan(tSeventh);
  });

  it('handles Tromsø Winter Solstice Polar Night with typed absence (Witness W01)', () => {
    // Tromsø: lat 69.6492, lon 18.9553
    const winterDate = new Date('2026-12-21T12:00:00Z');
    const sched = calculatePrayerTimes(69.6492, 18.9553, winterDate, {
      convention: 'MuslimWorldLeague',
    });

    expect(sched.sunrise.date).toBeNull();
    expect(sched.sunrise.provenance).toBe('unresolved');

    expect(sched.sunset.date).toBeNull();
    expect(sched.sunset.provenance).toBe('unresolved');

    expect(sched.maghrib.date).toBeNull();
    expect(sched.maghrib.provenance).toBe('unresolved');

    // Asr must NOT fall back silently to Dhuhr + 2 hours
    expect(sched.asr.date).toBeNull();
    expect(sched.asr.provenance).toBe('unresolved');
    expect(sched.asr.note).toContain('No physical noon shadow');

    // Dhuhr remains an astronomical sign (meridian transit)
    expect(sched.dhuhr.date).not.toBeNull();
    expect(sched.dhuhr.provenance).toBe('astronomicalSign');

    // Twilight crossings (-18 deg and -17 deg) physically exist because peak altitude is -3.087 deg
    // Missing solar signs (sunrise/sunset/asr) do not erase valid twilight signs (Criterion A10)
    expect(sched.fajr.date).not.toBeNull();
    expect(sched.fajr.provenance).toBe('astronomicalSign');
    expect(sched.isha.date).not.toBeNull();
    expect(sched.isha.provenance).toBe('astronomicalSign');
  });

  it('handles Tromsø Summer Solstice Midnight Sun without fake sunset (Witness W02)', () => {
    // Tromsø on Summer Solstice
    const summerDate = new Date('2026-06-21T12:00:00Z');
    const sched = calculatePrayerTimes(69.6492, 18.9553, summerDate, {
      convention: 'MuslimWorldLeague',
    });

    // Sun stays above horizon: no sunset, no sunrise
    expect(sched.sunrise.date).toBeNull();
    expect(sched.sunrise.provenance).toBe('unresolved');
    expect(sched.sunset.date).toBeNull();
    expect(sched.sunset.provenance).toBe('unresolved');
    expect(sched.maghrib.date).toBeNull();
    expect(sched.maghrib.provenance).toBe('unresolved');

    // Dhuhr and Asr are resolved because noon solar altitude is positive (~43.8 deg)
    expect(sched.dhuhr.date).not.toBeNull();
    expect(sched.dhuhr.provenance).toBe('astronomicalSign');

    expect(sched.asr.date).not.toBeNull();
    expect(sched.asr.provenance).toBe('astronomicalSign');
  });

  it('calculates multi-day ephemeris for next prayer after Isha rather than static 24h (Witness W06)', () => {
    // Makkah on 2026-10-04 at 22:00:00 UTC (after today's Isha)
    const lateNight = new Date('2026-10-04T22:00:00Z');
    const sched = calculatePrayerTimes(21.4225, 39.8262, lateNight, {
      convention: 'UmmAlQura',
    });

    expect(sched.currentPrayer).toBe('isha');
    expect(sched.nextPrayer).toBe('fajr');
    expect(sched.nextPrayerTime).not.toBeNull();

    // Verify it is NOT simply today's Fajr + 86,400,000 ms
    const todaySched = calculatePrayerTimes(21.4225, 39.8262, new Date('2026-10-04T12:00:00Z'), {
      convention: 'UmmAlQura',
    });
    const fakeNextFajrMs = todaySched.fajr.date!.getTime() + 86400000;
    const actualNextFajrMs = sched.nextPrayerTime!.getTime();

    expect(actualNextFajrMs).not.toBe(fakeNextFajrMs);

    // Should match true October 5 Fajr exactly
    const oct5Sched = calculatePrayerTimes(21.4225, 39.8262, new Date('2026-10-05T12:00:00Z'), {
      convention: 'UmmAlQura',
    });
    expect(Math.abs(actualNextFajrMs - oct5Sched.fajr.date!.getTime())).toBeLessThan(1000);
  });

  it('verifies all 10 calculation conventions produce valid prayer schedules', () => {
    const conventionNames = Object.keys(CALCULATION_CONVENTIONS) as CalculationConventionName[];
    expect(conventionNames.length).toBe(10);

    const testDate = new Date('2026-04-15T12:00:00Z');
    for (const name of conventionNames) {
      const sched = calculatePrayerTimes(24.47, 39.61, testDate, { convention: name }); // Madinah
      expect(sched.fajr.date).not.toBeNull();
      expect(sched.sunrise.date).not.toBeNull();
      expect(sched.dhuhr.date).not.toBeNull();
      expect(sched.asr.date).not.toBeNull();
      expect(sched.maghrib.date).not.toBeNull();
      expect(sched.isha.date).not.toBeNull();

      if (name === 'UmmAlQura' || name === 'Qatar') {
        expect(sched.isha.provenance).toBe('fixedInterval');
      } else {
        expect(sched.isha.provenance).toBe('astronomicalSign');
      }
    }
  });

  it('safely rejects invalid coordinates and dates with typed unresolved entries', () => {
    const invalidLat = calculatePrayerTimes(120, 0, new Date('2026-04-15T12:00:00Z'));
    expect(invalidLat.fajr.date).toBeNull();
    expect(invalidLat.fajr.provenance).toBe('unresolved');
    expect(invalidLat.currentPrayer).toBe('none');

    const invalidDate = calculatePrayerTimes(21.42, 39.83, new Date('invalid'));
    expect(invalidDate.fajr.date).toBeNull();
    expect(invalidDate.fajr.provenance).toBe('unresolved');
    expect(invalidDate.currentPrayer).toBe('none');
  });

  it('assigns currentPrayer = maghrib when after Maghrib and Isha is null', () => {
    // Tromsø on July 25, 2026 at 22:45:00 UTC (after sunset/Maghrib at ~22:37, Isha unresolved)
    const testDate = new Date('2026-07-25T22:45:00Z');
    const sched = calculatePrayerTimes(69.6492, 18.9553, testDate, {
      convention: 'MuslimWorldLeague',
    });

    expect(sched.maghrib.date).not.toBeNull();
    expect(sched.maghrib.provenance).toBe('astronomicalSign');
    expect(sched.isha.date).toBeNull();
    expect(sched.currentPrayer).toBe('maghrib');
  });

  it('measures high-latitude Isha from actual maghrib.date rather than virtual sunset when Maghrib is present', () => {
    // Tromsø on July 25, 2026 with high latitude rule
    const testDate = new Date('2026-07-25T12:00:00Z');
    const sched = calculatePrayerTimes(69.6492, 18.9553, testDate, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'SeventhOfTheNight',
    });

    expect(sched.maghrib.date).not.toBeNull();
    expect(sched.isha.date).not.toBeNull();
    expect(sched.isha.provenance).toBe('highLatitudeAdjustment');

    // Isha MUST be strictly later than Maghrib, never inverted
    expect(sched.isha.date!.getTime()).toBeGreaterThan(sched.maghrib.date!.getTime());
  });
});
