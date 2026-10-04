// Astronomical and fiqh calculation engine for Islamic prayer times

import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from './conventions';
import { getSolarDeclination, getEquationOfTime } from '../astronomy/solar';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface PrayerTimesSchedule {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
  currentPrayer: PrayerKey | 'none';
  nextPrayer: PrayerKey | 'none';
  nextPrayerTime: Date | null;
  countdownMs: number | null;
}

export interface CalculatorOptions {
  convention?: CalculationConventionName;
  madhab?: Madhab;
  highLatitudeRule?: HighLatitudeRule;
}

/**
 * Calculates prayer times for a geographic location on a specific date.
 */
export function calculatePrayerTimes(
  latitude: number,
  longitude: number,
  date: Date,
  options: CalculatorOptions = {},
): PrayerTimesSchedule {
  const convention = CALCULATION_CONVENTIONS[options.convention || 'UmmAlQura'];
  const madhab = options.madhab || 'Shafi';
  const highLatitudeRule = options.highLatitudeRule || 'MiddleOfTheNight';

  // Base UTC midnight for the given local calendar day
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const utcMidnight = Date.UTC(year, month, day);

  // Compute solar ephemeris at approximate solar noon (12:00 UTC)
  const approxNoon = new Date(utcMidnight + 12 * 3600000);
  const declination = getSolarDeclination(approxNoon);
  const eot = getEquationOfTime(approxNoon);

  const phi = latitude * DEG2RAD;
  const delta = declination * DEG2RAD;

  // Solar noon in UTC hours [0, 24)
  const solarNoonHours = 12 - longitude / 15 - eot / 60;

  // Helper to compute hour angle H in degrees for a given solar altitude h in degrees
  const getHourAngle = (altitudeDeg: number): number | null => {
    const h = altitudeDeg * DEG2RAD;
    const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
    if (cosH > 1 || cosH < -1) return null;
    return Math.acos(cosH) * RAD2DEG;
  };

  // 1. Sunrise and Sunset (approx -0.833 degrees for atmospheric refraction and solar radius)
  const sunRadiusRefraction = -0.8333;
  let sunriseSunsetH = getHourAngle(sunRadiusRefraction);
  if (sunriseSunsetH === null) {
    // Extreme latitude midnight sun or polar night
    sunriseSunsetH = latitude > 0 ? (delta > 0 ? 180 : 0) : delta < 0 ? 180 : 0;
  }

  const sunriseHours = solarNoonHours - sunriseSunsetH / 15;
  const sunsetHours = solarNoonHours + sunriseSunsetH / 15;

  // 2. Dhuhr (solar noon plus safety offset, default 1 min)
  const dhuhrSafety = (convention.dhuhrSafetyMinutes || 1) / 60;
  const dhuhrHours = solarNoonHours + dhuhrSafety;

  // 3. Asr (shadow length criterion)
  const shadowFactor = madhab === 'Hanafi' ? 2 : 1;
  const noonShadowLength = Math.tan(Math.abs(phi - delta));
  const asrAltitudeRad = Math.atan(1 / (noonShadowLength + shadowFactor));
  const asrAltitudeDeg = asrAltitudeRad * RAD2DEG;
  const asrH = getHourAngle(asrAltitudeDeg);
  const asrHours = asrH !== null ? solarNoonHours + asrH / 15 : dhuhrHours + 2;

  // 4. Fajr (dawn twilight angle)
  const fajrH = getHourAngle(-convention.fajrAngle);
  let fajrHours: number;
  if (fajrH !== null) {
    fajrHours = solarNoonHours - fajrH / 15;
  } else {
    // High latitude approximation
    const nightPortion = highLatitudeRule === 'SeventhOfTheNight' ? 1 / 7 : 1 / 2;
    const nightLength = 24 - (sunsetHours - sunriseHours);
    fajrHours = sunriseHours - nightLength * nightPortion;
  }

  // 5. Isha (dusk twilight angle or fixed interval after Maghrib)
  let ishaHours: number;
  if (convention.ishaIntervalMinutes !== undefined && convention.ishaIntervalMinutes > 0) {
    ishaHours = sunsetHours + convention.ishaIntervalMinutes / 60;
  } else {
    const ishaH = getHourAngle(-convention.ishaAngle);
    if (ishaH !== null) {
      ishaHours = solarNoonHours + ishaH / 15;
    } else {
      const nightPortion = highLatitudeRule === 'SeventhOfTheNight' ? 1 / 7 : 1 / 2;
      const nightLength = 24 - (sunsetHours - sunriseHours);
      ishaHours = sunsetHours + nightLength * nightPortion;
    }
  }

  // Convert fractional UTC hours to Date objects
  const toDate = (hours: number): Date => new Date(utcMidnight + hours * 3600000);

  const fajr = toDate(fajrHours);
  const sunrise = toDate(sunriseHours);
  const dhuhr = toDate(dhuhrHours);
  const asr = toDate(asrHours);
  const maghrib = toDate(sunsetHours);
  const isha = toDate(ishaHours);

  // Determine current prayer period and next prayer
  const nowMs = date.getTime();
  let currentPrayer: PrayerKey | 'none' = 'none';
  let nextPrayer: PrayerKey | 'none' = 'none';
  let nextPrayerTime: Date | null = null;

  if (nowMs < fajr.getTime()) {
    currentPrayer = 'isha';
    nextPrayer = 'fajr';
    nextPrayerTime = fajr;
  } else if (nowMs < sunrise.getTime()) {
    currentPrayer = 'fajr';
    nextPrayer = 'dhuhr';
    nextPrayerTime = dhuhr;
  } else if (nowMs < dhuhr.getTime()) {
    currentPrayer = 'none'; // Between sunrise and dhuhr (Duha time)
    nextPrayer = 'dhuhr';
    nextPrayerTime = dhuhr;
  } else if (nowMs < asr.getTime()) {
    currentPrayer = 'dhuhr';
    nextPrayer = 'asr';
    nextPrayerTime = asr;
  } else if (nowMs < maghrib.getTime()) {
    currentPrayer = 'asr';
    nextPrayer = 'maghrib';
    nextPrayerTime = maghrib;
  } else if (nowMs < isha.getTime()) {
    currentPrayer = 'maghrib';
    nextPrayer = 'isha';
    nextPrayerTime = isha;
  } else {
    currentPrayer = 'isha';
    // Next prayer is tomorrow's Fajr
    nextPrayer = 'fajr';
    nextPrayerTime = new Date(fajr.getTime() + 86400000);
  }

  const countdownMs = nextPrayerTime ? Math.max(0, nextPrayerTime.getTime() - nowMs) : null;

  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    currentPrayer,
    nextPrayer,
    nextPrayerTime,
    countdownMs,
  };
}
