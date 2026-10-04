import { describe, it, expect } from 'vitest';
import { calculatePrayerTimes } from './calculator';

describe('Prayer calculation engine', () => {
  it('calculates correct chronological order for Makkah prayer times', () => {
    // Makkah: lat 21.4225, lon 39.8262
    const date = new Date('2026-10-04T12:00:00Z');
    const schedule = calculatePrayerTimes(21.4225, 39.8262, date, {
      convention: 'UmmAlQura',
    });

    expect(schedule.fajr.getTime()).toBeLessThan(schedule.sunrise.getTime());
    expect(schedule.sunrise.getTime()).toBeLessThan(schedule.dhuhr.getTime());
    expect(schedule.dhuhr.getTime()).toBeLessThan(schedule.asr.getTime());
    expect(schedule.asr.getTime()).toBeLessThan(schedule.maghrib.getTime());
    expect(schedule.maghrib.getTime()).toBeLessThan(schedule.isha.getTime());

    // Umm Al-Qura Isha is exactly 90 minutes after Maghrib
    const diffMinutes = (schedule.isha.getTime() - schedule.maghrib.getTime()) / 60000;
    expect(diffMinutes).toBeCloseTo(90, 1);
  });

  it('Hanafi Asr occurs strictly after Shafi Asr', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const shafi = calculatePrayerTimes(21.4225, 39.8262, date, { madhab: 'Shafi' });
    const hanafi = calculatePrayerTimes(21.4225, 39.8262, date, { madhab: 'Hanafi' });

    expect(hanafi.asr.getTime()).toBeGreaterThan(shafi.asr.getTime());
    // Hanafi Asr is typically ~45-60 minutes later than Shafi
    const diffMin = (hanafi.asr.getTime() - shafi.asr.getTime()) / 60000;
    expect(diffMin).toBeGreaterThan(30);
    expect(diffMin).toBeLessThan(80);
  });

  it('evaluates current and next prayer periods accurately', () => {
    const baseDate = new Date('2026-10-04T00:00:00Z');
    const schedule = calculatePrayerTimes(21.4225, 39.8262, baseDate);

    // 10 minutes after Dhuhr
    const duringDhuhr = new Date(schedule.dhuhr.getTime() + 10 * 60000);
    const checked = calculatePrayerTimes(21.4225, 39.8262, duringDhuhr);

    expect(checked.currentPrayer).toBe('dhuhr');
    expect(checked.nextPrayer).toBe('asr');
    expect(checked.nextPrayerTime?.getTime()).toBe(schedule.asr.getTime());
    expect(checked.countdownMs).toBeGreaterThan(0);
  });

  it('calculates London prayer times with high latitude stability', () => {
    // London: lat 51.5074, lon -0.1278
    const summerDate = new Date('2026-06-21T12:00:00Z');
    const schedule = calculatePrayerTimes(51.5074, -0.1278, summerDate, {
      convention: 'MuslimWorldLeague',
      highLatitudeRule: 'SeventhOfTheNight',
    });

    expect(schedule.fajr.getTime()).toBeLessThan(schedule.sunrise.getTime());
    expect(schedule.maghrib.getTime()).toBeLessThan(schedule.isha.getTime());
  });
});
