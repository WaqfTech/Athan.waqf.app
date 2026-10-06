import { describe, it, expect } from 'vitest';
import {
  calculatePrayerTimes,
  calculateIslamicNight,
  IslamicNightInfo,
  IslamicNight,
} from './calculator';
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

describe('calculateIslamicNight pure function', () => {
  it('correctly calculates mathematical division of the night (halves and thirds)', () => {
    // 12-hour night: Maghrib at 18:00:00, next Fajr at 06:00:00
    const maghrib = new Date('2026-10-04T18:00:00.000Z');
    const nextFajr = new Date('2026-10-05T06:00:00.000Z');
    const expectedDurationMs = 12 * 3600000;

    const night: IslamicNightInfo | null = calculateIslamicNight(maghrib, nextFajr);
    const nightAlias: IslamicNight | null = night;
    expect(nightAlias).not.toBeNull();
    if (!night) return;

    expect(night.durationMs).toBe(expectedDurationMs);

    // Midnight is exactly at half the duration (18:00 + 6h = 00:00:00)
    expect(night.midnight.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(night.midnight.getTime()).toBe(maghrib.getTime() + expectedDurationMs / 2);

    // First third ends at 1/3 duration (18:00 + 4h = 22:00:00)
    expect(night.firstThirdEnd?.toISOString()).toBe('2026-10-04T22:00:00.000Z');
    expect(night.firstThirdEnd?.getTime()).toBe(maghrib.getTime() + expectedDurationMs / 3);

    // Last third starts at 2/3 duration (18:00 + 8h = 02:00:00, or Fajr - 4h)
    expect(night.lastThirdStart.toISOString()).toBe('2026-10-05T02:00:00.000Z');
    expect(night.lastThirdStart.getTime()).toBe(maghrib.getTime() + (expectedDurationMs * 2) / 3);
    expect(night.lastThirdStart.getTime()).toBe(nextFajr.getTime() - expectedDurationMs / 3);

    // Last third ends exactly at Fajr athan
    expect(night.lastThirdEnd.toISOString()).toBe('2026-10-05T06:00:00.000Z');
    expect(night.lastThirdEnd.getTime()).toBe(nextFajr.getTime());
  });

  it('handles odd durations and non-round milliseconds accurately with integer rounding', () => {
    // 7 hours, 13 minutes, 47 seconds, 123 ms = 26,027,123 ms
    const maghrib = new Date('2026-06-21T21:15:30.100Z');
    const nextFajr = new Date(maghrib.getTime() + 26027123);

    const night = calculateIslamicNight(maghrib, nextFajr);
    expect(night).not.toBeNull();
    if (!night) return;

    expect(night.durationMs).toBe(26027123);
    expect(night.midnight.getTime()).toBe(maghrib.getTime() + Math.round(26027123 / 2));
    expect(night.firstThirdEnd?.getTime()).toBe(maghrib.getTime() + Math.round(26027123 / 3));
    expect(night.lastThirdStart.getTime()).toBe(maghrib.getTime() + Math.round((26027123 * 2) / 3));
    expect(night.lastThirdEnd.getTime()).toBe(nextFajr.getTime());

    // Chronological order verification
    expect(maghrib.getTime()).toBeLessThan(night.firstThirdEnd!.getTime());
    expect(night.firstThirdEnd!.getTime()).toBeLessThan(night.midnight.getTime());
    expect(night.midnight.getTime()).toBeLessThan(night.lastThirdStart.getTime());
    expect(night.lastThirdStart.getTime()).toBeLessThan(night.lastThirdEnd.getTime());
  });

  it('verifies point-in-time boundary assertions for isCurrentlyLastThird and isActive', () => {
    const maghrib = new Date('2026-10-04T18:00:00.000Z');
    const nextFajr = new Date('2026-10-05T06:00:00.000Z');
    // Last third starts at 02:00:00.000Z and ends at 06:00:00.000Z

    // 1 ms before Maghrib: not active, not last third
    const beforeMaghrib = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-04T17:59:59.999Z'));
    expect(beforeMaghrib?.isActive).toBe(false);
    expect(beforeMaghrib?.isCurrentlyLastThird).toBe(false);

    // At exact Maghrib timestamp: active, not last third
    const atMaghrib = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-04T18:00:00.000Z'));
    expect(atMaghrib?.isActive).toBe(true);
    expect(atMaghrib?.isCurrentlyLastThird).toBe(false);

    // In first third (20:00:00): active, not last third
    const inFirstThird = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-04T20:00:00.000Z'));
    expect(inFirstThird?.isActive).toBe(true);
    expect(inFirstThird?.isCurrentlyLastThird).toBe(false);

    // At exact Islamic midnight (00:00:00): active, not last third
    const atMidnight = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T00:00:00.000Z'));
    expect(atMidnight?.isActive).toBe(true);
    expect(atMidnight?.isCurrentlyLastThird).toBe(false);

    // 1 ms before last third start (01:59:59.999): active, not last third
    const justBeforeLastThird = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T01:59:59.999Z'));
    expect(justBeforeLastThird?.isActive).toBe(true);
    expect(justBeforeLastThird?.isCurrentlyLastThird).toBe(false);

    // At exact last third start (02:00:00.000): active, IS last third (inclusive start boundary)
    const atLastThirdStart = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T02:00:00.000Z'));
    expect(atLastThirdStart?.isActive).toBe(true);
    expect(atLastThirdStart?.isCurrentlyLastThird).toBe(true);

    // Inside last third (04:00:00.000): active, IS last third
    const insideLastThird = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T04:00:00.000Z'));
    expect(insideLastThird?.isActive).toBe(true);
    expect(insideLastThird?.isCurrentlyLastThird).toBe(true);

    // 1 ms before Fajr athan (05:59:59.999): active, IS last third
    const justBeforeFajr = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T05:59:59.999Z'));
    expect(justBeforeFajr?.isActive).toBe(true);
    expect(justBeforeFajr?.isCurrentlyLastThird).toBe(true);

    // At exact Fajr athan (06:00:00.000): night has concluded (exclusive end boundary)
    const atFajr = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T06:00:00.000Z'));
    expect(atFajr?.isActive).toBe(false);
    expect(atFajr?.isCurrentlyLastThird).toBe(false);

    // After Fajr (07:00:00): not active, not last third
    const afterFajr = calculateIslamicNight(maghrib, nextFajr, new Date('2026-10-05T07:00:00.000Z'));
    expect(afterFajr?.isActive).toBe(false);
    expect(afterFajr?.isCurrentlyLastThird).toBe(false);

    // Invalid or null current parameter safely returns false without crashing
    const invalidCurrent = calculateIslamicNight(maghrib, nextFajr, new Date('invalid'));
    expect(invalidCurrent?.isActive).toBe(false);
    expect(invalidCurrent?.isCurrentlyLastThird).toBe(false);

    const nullCurrent = calculateIslamicNight(maghrib, nextFajr, null);
    expect(nullCurrent?.isActive).toBe(false);
    expect(nullCurrent?.isCurrentlyLastThird).toBe(false);
  });

  it('safely returns null for invalid, null, NaN, inverted, and unphysical inputs', () => {
    const validDate = new Date('2026-10-04T18:00:00Z');
    const laterDate = new Date('2026-10-05T06:00:00Z');

    // Null or undefined inputs
    expect(calculateIslamicNight(null, laterDate)).toBeNull();
    expect(calculateIslamicNight(validDate, null)).toBeNull();
    expect(calculateIslamicNight(undefined, laterDate)).toBeNull();
    expect(calculateIslamicNight(validDate, undefined)).toBeNull();
    expect(calculateIslamicNight(null, null)).toBeNull();

    // Invalid dates (NaN timestamp)
    expect(calculateIslamicNight(new Date('invalid'), laterDate)).toBeNull();
    expect(calculateIslamicNight(validDate, new Date(NaN))).toBeNull();

    // Inverted timestamps (Fajr before Maghrib)
    expect(calculateIslamicNight(laterDate, validDate)).toBeNull();

    // Equal timestamps (zero duration)
    expect(calculateIslamicNight(validDate, validDate)).toBeNull();

    // Duration exceeding 24 hours (unphysical night interval)
    const tooLateDate = new Date(validDate.getTime() + 25 * 3600000);
    expect(calculateIslamicNight(validDate, tooLateDate)).toBeNull();

    // Non-Date object types cast
    expect(calculateIslamicNight('2026-10-04' as unknown as Date, laterDate)).toBeNull();
    expect(calculateIslamicNight(validDate, 123456789 as unknown as Date)).toBeNull();
  });
});

describe('Islamic night schedule in calculatePrayerTimes', () => {
  it('calculates valid Islamic night for Makkah in daytime, evening, and pre-dawn', () => {
    // Makkah: lat 21.4225, lon 39.8262 on 2026-10-04
    // 1. Evaluated at local noon (daytime)
    const daytime = new Date('2026-10-04T12:00:00Z');
    const daytimeSched = calculatePrayerTimes(21.4225, 39.8262, daytime, { convention: 'UmmAlQura' });

    expect(daytimeSched.islamicNight).toBeDefined();
    const dayNight = daytimeSched.islamicNight!;
    expect(dayNight.durationMs).toBeGreaterThan(10 * 3600000); // Makkah night is ~11 hours in Oct
    expect(dayNight.durationMs).toBeLessThan(14 * 3600000);
    expect(dayNight.isActive).toBe(false);
    expect(dayNight.isCurrentlyLastThird).toBe(false);

    // Midnight is midway between Maghrib and tomorrow's Fajr
    expect(dayNight.midnight.getTime()).toBeGreaterThan(daytimeSched.maghrib.date!.getTime());
    expect(dayNight.lastThirdStart.getTime()).toBeGreaterThan(dayNight.midnight.getTime());
    expect(dayNight.lastThirdEnd.getTime()).toBeGreaterThan(dayNight.lastThirdStart.getTime());

    // 2. Evaluated in evening after Maghrib (20:00 UTC)
    const eveningTime = new Date('2026-10-04T20:00:00Z');
    const eveningSched = calculatePrayerTimes(21.4225, 39.8262, eveningTime, { convention: 'UmmAlQura' });

    expect(eveningSched.islamicNight).toBeDefined();
    expect(eveningSched.islamicNight!.isActive).toBe(true);
    expect(eveningSched.islamicNight!.isCurrentlyLastThird).toBe(false); // 20:00 UTC is before last third (~01:15 UTC)

    // 3. Evaluated during pre-dawn Tahajjud hours (01:00 UTC / 04:00 AST on Oct 5, before Fajr at ~04:48 AST / 01:48 UTC)
    const preDawnTime = new Date('2026-10-05T01:00:00Z');
    const preDawnSched = calculatePrayerTimes(21.4225, 39.8262, preDawnTime, { convention: 'UmmAlQura' });

    expect(preDawnSched.islamicNight).toBeDefined();
    const preDawnNight = preDawnSched.islamicNight!;
    expect(preDawnNight.isActive).toBe(true);
    expect(preDawnNight.isCurrentlyLastThird).toBe(true); // Active in the last third!
    expect(preDawnNight.lastThirdEnd.getTime()).toBe(preDawnSched.fajr.date!.getTime());
  });

  it('calculates Islamic night for London on solstices with high-latitude adjustments', () => {
    // London: lat 51.5074, lon -0.1278
    const summerSolstice = new Date('2026-06-21T12:00:00Z');

    // AngleBased
    const angleSched = calculatePrayerTimes(51.5074, -0.1278, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'AngleBased',
    });
    expect(angleSched.islamicNight).toBeDefined();
    expect(angleSched.islamicNight!.durationMs).toBeGreaterThan(4 * 3600000);
    expect(angleSched.islamicNight!.durationMs).toBeLessThan(8 * 3600000);

    // MiddleOfTheNight (half of the 7.37h night is ~3.68h)
    const middleSched = calculatePrayerTimes(51.5074, -0.1278, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    expect(middleSched.islamicNight).toBeDefined();
    expect(middleSched.islamicNight!.durationMs).toBeGreaterThan(3 * 3600000);
    expect(middleSched.islamicNight!.durationMs).toBeLessThan(8 * 3600000);

    // SeventhOfTheNight
    const seventhSched = calculatePrayerTimes(51.5074, -0.1278, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'SeventhOfTheNight',
    });
    expect(seventhSched.islamicNight).toBeDefined();
    expect(seventhSched.islamicNight!.durationMs).toBeGreaterThan(4 * 3600000);
    expect(seventhSched.islamicNight!.durationMs).toBeLessThan(8 * 3600000);

    // Durations reflect the fraction assigned to night before Fajr:
    // MiddleOfTheNight (0.50 of night) < AngleBased (0.70 of night) < SeventhOfTheNight (6/7 of night)
    expect(middleSched.islamicNight!.durationMs).toBeLessThan(angleSched.islamicNight!.durationMs);
    expect(angleSched.islamicNight!.durationMs).toBeLessThan(seventhSched.islamicNight!.durationMs);

    // Verification that highLatitudeRule cascades into lastThirdStart
    expect(middleSched.islamicNight!.lastThirdStart.getTime()).toBeLessThan(
      seventhSched.islamicNight!.lastThirdStart.getTime(),
    );
  });

  it('handles Tromsø polar night and midnight sun gracefully without errors', () => {
    // Tromsø: lat 69.6492, lon 18.9553
    // 1. Winter solstice: Polar night (sun never rises or sets, Maghrib is null)
    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const winterSched = calculatePrayerTimes(69.6492, 18.9553, winterSolstice, {
      convention: 'MuslimWorldLeague',
    });
    expect(winterSched.maghrib.date).toBeNull();
    // In polar night without Maghrib, islamicNight is cleanly undefined with zero errors
    expect(winterSched.islamicNight).toBeUndefined();

    // 2. Summer solstice without high-latitude rule (Midnight Sun, Maghrib is null)
    const summerSolstice = new Date('2026-06-21T12:00:00Z');
    const summerNoRuleSched = calculatePrayerTimes(69.6492, 18.9553, summerSolstice, {
      convention: 'MuslimWorldLeague',
    });
    expect(summerNoRuleSched.maghrib.date).toBeNull();
    expect(summerNoRuleSched.islamicNight).toBeUndefined();

    // 3. Summer solstice WITH MiddleOfTheNight rule (Virtual night of 8 hours)
    const summerWithRuleSched = calculatePrayerTimes(69.6492, 18.9553, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
    });
    expect(summerWithRuleSched.maghrib.date).not.toBeNull();
    expect(summerWithRuleSched.fajr.date).not.toBeNull();
    expect(summerWithRuleSched.islamicNight).toBeDefined();

    const polarNight = summerWithRuleSched.islamicNight!;
    // Duration must be strictly positive and under 8 hours (never an unphysical 28 hours)
    expect(polarNight.durationMs).toBeGreaterThan(0);
    expect(polarNight.durationMs).toBeLessThanOrEqual(8 * 3600000);

    // Check last third activation inside Tromsø virtual night
    // Maghrib is ~18:44 UTC, Fajr is ~22:44 UTC, duration = 4h. Last third starts at ~21:24 UTC.
    const inTromsoLastThird = calculatePrayerTimes(69.6492, 18.9553, summerSolstice, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'MiddleOfTheNight',
      now: new Date('2026-06-21T21:45:00Z'),
    });
    expect(inTromsoLastThird.islamicNight?.isActive).toBe(true);
    expect(inTromsoLastThird.islamicNight?.isCurrentlyLastThird).toBe(true);
  });

  it('calculates valid Islamic night for Tokyo across international date lines', () => {
    // Tokyo: lat 35.6762, lon 139.6503 (UTC+9)
    const tokyoNoon = new Date('2026-10-05T03:00:00Z'); // 12:00 JST
    const sched = calculatePrayerTimes(35.6762, 139.6503, tokyoNoon);

    expect(sched.islamicNight).toBeDefined();
    const night = sched.islamicNight!;
    expect(night.durationMs).toBeGreaterThan(10 * 3600000);
    expect(night.durationMs).toBeLessThan(13 * 3600000);

    expect(sched.maghrib.date!.getTime()).toBeLessThan(night.midnight.getTime());
    expect(night.midnight.getTime()).toBeLessThan(night.lastThirdStart.getTime());
    expect(night.lastThirdStart.getTime()).toBeLessThan(night.lastThirdEnd.getTime());
  });

  it('reflects seasonal asymmetry in Southern Hemisphere (Sydney)', () => {
    // Sydney: lat -33.8688, lon 151.2093
    // June 21 is Southern Winter (long night)
    const juneSolstice = new Date('2026-06-21T02:00:00Z');
    const juneSched = calculatePrayerTimes(-33.8688, 151.2093, juneSolstice);

    // December 21 is Southern Summer (short night)
    const decSolstice = new Date('2026-12-21T02:00:00Z');
    const decSched = calculatePrayerTimes(-33.8688, 151.2093, decSolstice);

    expect(juneSched.islamicNight).toBeDefined();
    expect(decSched.islamicNight).toBeDefined();

    const winterNightMs = juneSched.islamicNight!.durationMs;
    const summerNightMs = decSched.islamicNight!.durationMs;

    // Southern winter night is strictly longer than southern summer night
    expect(winterNightMs).toBeGreaterThan(summerNightMs);
    expect((winterNightMs - summerNightMs) / 3600000).toBeGreaterThan(3.5); // > 3.5h seasonal difference
  });

  it('safely sets islamicNight to undefined when coordinates or date are invalid', () => {
    const invalidCoords = calculatePrayerTimes(150, 0, new Date('2026-10-04T12:00:00Z'));
    expect(invalidCoords.islamicNight).toBeUndefined();

    const invalidDate = calculatePrayerTimes(21.42, 39.82, new Date('invalid'));
    expect(invalidDate.islamicNight).toBeUndefined();
  });
});
