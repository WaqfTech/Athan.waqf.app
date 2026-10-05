// Astronomical and fiqh calculation engine for Islamic prayer times

import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
  PrayerKey,
} from './conventions';
import { getSolarDeclination, getEquationOfTime } from '../astronomy/solar';
import {
  findSolarCrossing,
  calculateAsrAltitude,
} from '../astronomy/events';

export type PrayerProvenance =
  | 'astronomicalSign'
  | 'fixedInterval'
  | 'highLatitudeAdjustment'
  | 'unresolved';

export interface PrayerEntry {
  date: Date | null;
  provenance: PrayerProvenance;
  ruleApplied?: HighLatitudeRule;
  note?: string;
}

export interface DailyPrayerTimes {
  fajr: PrayerEntry;
  sunrise: PrayerEntry;
  dhuhr: PrayerEntry;
  asr: PrayerEntry;
  maghrib: PrayerEntry;
  isha: PrayerEntry;
}

export interface PrayerTimesSchedule extends DailyPrayerTimes {
  sunset: PrayerEntry;
  currentPrayer: PrayerKey | 'none';
  nextPrayer: PrayerKey | 'none';
  nextPrayerTime: Date | null;
  countdownMs: number | null;
}

export interface CalculatorOptions {
  convention?: CalculationConventionName;
  madhab?: Madhab;
  highLatitudeRule?: HighLatitudeRule;
  now?: Date;
}

/**
 * Type guard for resolved prayer entries with a valid Date.
 */
export function isPrayerResolved(
  entry: PrayerEntry,
): entry is PrayerEntry & { date: Date } {
  return entry.date !== null;
}

/**
 * Calculates prayer times for a geographic location on a specific date.
 */
export function calculatePrayerTimes(
  latitude: number,
  longitude: number,
  date: Date,
  options: CalculatorOptions = {},
  isLookahead = false,
): PrayerTimesSchedule {
  // 1. Input sanitation
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    const unresolvedEntry = (note: string): PrayerEntry => ({
      date: null,
      provenance: 'unresolved',
      note,
    });
    return {
      fajr: unresolvedEntry('Invalid coordinates or date'),
      sunrise: unresolvedEntry('Invalid coordinates or date'),
      dhuhr: unresolvedEntry('Invalid coordinates or date'),
      asr: unresolvedEntry('Invalid coordinates or date'),
      maghrib: unresolvedEntry('Invalid coordinates or date'),
      isha: unresolvedEntry('Invalid coordinates or date'),
      sunset: unresolvedEntry('Invalid coordinates or date'),
      currentPrayer: 'none',
      nextPrayer: 'none',
      nextPrayerTime: null,
      countdownMs: null,
    };
  }

  const convention = CALCULATION_CONVENTIONS[options.convention || 'UmmAlQura'] || CALCULATION_CONVENTIONS.UmmAlQura;
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

  // Solar noon in UTC hours [0, 24)
  const solarNoonHours = 12 - longitude / 15 - eot / 60;
  const solarNoonDate = new Date(utcMidnight + solarNoonHours * 3600000);

  // 1. Dhuhr (solar noon plus safety offset, default 1 min)
  const dhuhrSafetyMinutes = convention.dhuhrSafetyMinutes ?? 1;
  const dhuhrDate = new Date(solarNoonDate.getTime() + dhuhrSafetyMinutes * 60000);
  const dhuhr: PrayerEntry = {
    date: dhuhrDate,
    provenance: 'astronomicalSign',
  };

  // 2. Sunrise and Sunset (apparent refraction altitude -0.8333 degrees)
  const sunriseCrossing = findSolarCrossing(latitude, longitude, -0.8333, date, 'rising');
  let sunrise: PrayerEntry;
  if (sunriseCrossing.kind === 'crossing') {
    sunrise = {
      date: sunriseCrossing.date,
      provenance: 'astronomicalSign',
    };
  } else {
    sunrise = {
      date: null,
      provenance: 'unresolved',
      note: sunriseCrossing.kind === 'alwaysBelow' ? 'Polar night' : 'Midnight sun',
    };
  }

  const sunsetCrossing = findSolarCrossing(latitude, longitude, -0.8333, date, 'setting');
  let sunset: PrayerEntry;
  if (sunsetCrossing.kind === 'crossing') {
    sunset = {
      date: sunsetCrossing.date,
      provenance: 'astronomicalSign',
    };
  } else {
    sunset = {
      date: null,
      provenance: 'unresolved',
      note: sunsetCrossing.kind === 'alwaysBelow' ? 'Polar night' : 'Midnight sun',
    };
  }

  // 3. Maghrib (sunset or explicit maghribAngle)
  let maghrib: PrayerEntry;
  if (convention.maghribAngle !== undefined && convention.maghribAngle > 0) {
    const maghribCrossing = findSolarCrossing(latitude, longitude, -convention.maghribAngle, date, 'setting');
    if (maghribCrossing.kind === 'crossing') {
      maghrib = {
        date: maghribCrossing.date,
        provenance: 'astronomicalSign',
      };
    } else {
      maghrib = {
        date: null,
        provenance: 'unresolved',
        note: maghribCrossing.kind,
      };
    }
  } else {
    if (sunset.date !== null) {
      maghrib = {
        date: sunset.date,
        provenance: 'astronomicalSign',
      };
    } else if (options.highLatitudeRule !== undefined && sunsetCrossing.kind === 'alwaysAbove') {
      // High-latitude determination for continuous daylight
      const midnightMs = utcMidnight + (solarNoonHours + 12) * 3600000;
      const virtualNightMs = 8 * 3600000;
      const virtualSunsetMs = midnightMs - virtualNightMs / 2;
      maghrib = {
        date: new Date(virtualSunsetMs),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: options.highLatitudeRule,
      };
    } else {
      maghrib = {
        date: null,
        provenance: 'unresolved',
        note: sunset.note,
      };
    }
  }

  // 4. Asr (shadow length criterion enforcing positive noon shadow)
  let asr: PrayerEntry;
  const shadowFactor = madhab === 'Hanafi' ? 2 : 1;
  const asrAltitude = calculateAsrAltitude(latitude, declination, shadowFactor);

  if (asrAltitude === null) {
    asr = {
      date: null,
      provenance: 'unresolved',
      note: 'No physical noon shadow',
    };
  } else {
    const asrCrossing = findSolarCrossing(latitude, longitude, asrAltitude, date, 'setting');
    if (asrCrossing.kind === 'crossing') {
      asr = {
        date: asrCrossing.date,
        provenance: 'astronomicalSign',
      };
    } else {
      asr = {
        date: null,
        provenance: 'unresolved',
        note: asrCrossing.kind,
      };
    }
  }

  // 5. Fajr (dawn twilight angle or high-latitude adjustment)
  let fajr: PrayerEntry;
  const fajrCrossing = findSolarCrossing(latitude, longitude, -convention.fajrAngle, date, 'rising');

  if (fajrCrossing.kind === 'crossing') {
    fajr = {
      date: fajrCrossing.date,
      provenance: 'astronomicalSign',
    };
  } else {
    // Twilight absence at high latitude
    if (sunrise.date !== null && sunset.date !== null) {
      const nightDurationMs = 24 * 3600000 - (sunset.date.getTime() - sunrise.date.getTime());
      let fraction: number;
      if (highLatitudeRule === 'SeventhOfTheNight') {
        fraction = 1 / 7;
      } else if (highLatitudeRule === 'AngleBased') {
        fraction = convention.fajrAngle / 60.0;
      } else {
        fraction = 1 / 2; // MiddleOfTheNight
      }
      const fajrMs = sunrise.date.getTime() - nightDurationMs * fraction;
      fajr = {
        date: new Date(fajrMs),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: highLatitudeRule,
      };
    } else if (options.highLatitudeRule !== undefined && fajrCrossing.kind === 'alwaysAbove') {
      const midnightMs = utcMidnight + (solarNoonHours + 12) * 3600000;
      const virtualNightMs = 8 * 3600000;
      const virtualSunriseMs = midnightMs + virtualNightMs / 2;
      let fraction: number;
      if (options.highLatitudeRule === 'SeventhOfTheNight') {
        fraction = 1 / 7;
      } else if (options.highLatitudeRule === 'AngleBased') {
        fraction = convention.fajrAngle / 60.0;
      } else {
        fraction = 1 / 2;
      }
      const fajrMs = virtualSunriseMs - virtualNightMs * fraction;
      fajr = {
        date: new Date(fajrMs),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: options.highLatitudeRule,
      };
    } else {
      fajr = {
        date: null,
        provenance: 'unresolved',
        note: 'Indeterminate night span',
      };
    }
  }

  // 6. Isha (dusk twilight angle, fixed interval, or high-latitude adjustment)
  let isha: PrayerEntry;
  if (convention.ishaIntervalMinutes !== undefined && convention.ishaIntervalMinutes > 0) {
    if (maghrib.date !== null) {
      const ishaDate = new Date(maghrib.date.getTime() + convention.ishaIntervalMinutes * 60000);
      isha = {
        date: ishaDate,
        provenance: 'fixedInterval',
      };
    } else {
      isha = {
        date: null,
        provenance: 'unresolved',
        note: 'Maghrib unresolved for fixed interval',
      };
    }
  } else {
    const ishaCrossing = findSolarCrossing(latitude, longitude, -convention.ishaAngle, date, 'setting');
    if (ishaCrossing.kind === 'crossing') {
      isha = {
        date: ishaCrossing.date,
        provenance: 'astronomicalSign',
      };
    } else {
      if (sunrise.date !== null && sunset.date !== null) {
        const nightDurationMs = 24 * 3600000 - (sunset.date.getTime() - sunrise.date.getTime());
        let fraction: number;
        if (highLatitudeRule === 'SeventhOfTheNight') {
          fraction = 1 / 7;
        } else if (highLatitudeRule === 'AngleBased') {
          fraction = convention.ishaAngle / 60.0;
        } else {
          fraction = 1 / 2; // MiddleOfTheNight
        }
        const ishaMs = sunset.date.getTime() + nightDurationMs * fraction;
        isha = {
          date: new Date(ishaMs),
          provenance: 'highLatitudeAdjustment',
          ruleApplied: highLatitudeRule,
        };
      } else if (options.highLatitudeRule !== undefined && ishaCrossing.kind === 'alwaysAbove') {
        const midnightMs = utcMidnight + (solarNoonHours + 12) * 3600000;
        const virtualNightMs = 8 * 3600000;
        const virtualSunsetMs = midnightMs - virtualNightMs / 2;
        const baseSunsetMs = maghrib.date ? maghrib.date.getTime() : virtualSunsetMs;
        let fraction: number;
        if (options.highLatitudeRule === 'SeventhOfTheNight') {
          fraction = 1 / 7;
        } else if (options.highLatitudeRule === 'AngleBased') {
          fraction = convention.ishaAngle / 60.0;
        } else {
          fraction = 1 / 2;
        }
        const ishaMs = baseSunsetMs + virtualNightMs * fraction;
        isha = {
          date: new Date(ishaMs),
          provenance: 'highLatitudeAdjustment',
          ruleApplied: options.highLatitudeRule,
        };
      } else {
        isha = {
          date: null,
          provenance: 'unresolved',
          note: 'Indeterminate night span',
        };
      }
    }
  }

  // Determine current prayer period and next prayer
  const nowMs = (options.now ?? date).getTime();
  let currentPrayer: PrayerKey | 'none' = 'none';
  let nextPrayer: PrayerKey | 'none' = 'none';
  let nextPrayerTime: Date | null = null;

  const fajrMs = fajr.date?.getTime() ?? null;
  const sunriseMs = sunrise.date?.getTime() ?? null;
  const dhuhrMs = dhuhr.date?.getTime() ?? null;
  const asrMs = asr.date?.getTime() ?? null;
  const maghribMs = maghrib.date?.getTime() ?? null;
  const ishaMs = isha.date?.getTime() ?? null;

  if (fajrMs !== null && nowMs < fajrMs) {
    currentPrayer = 'isha';
    nextPrayer = 'fajr';
    nextPrayerTime = fajr.date;
  } else if (sunriseMs !== null && nowMs < sunriseMs) {
    currentPrayer = 'fajr';
    nextPrayer = dhuhr.date ? 'dhuhr' : (asr.date ? 'asr' : (maghrib.date ? 'maghrib' : (isha.date ? 'isha' : 'none')));
    nextPrayerTime = dhuhr.date ?? asr.date ?? maghrib.date ?? isha.date ?? null;
  } else if (dhuhrMs !== null && nowMs < dhuhrMs) {
    currentPrayer = 'none'; // Duha time between sunrise and Dhuhr
    nextPrayer = 'dhuhr';
    nextPrayerTime = dhuhr.date;
  } else if (asrMs !== null && nowMs < asrMs) {
    currentPrayer = 'dhuhr';
    nextPrayer = 'asr';
    nextPrayerTime = asr.date;
  } else if (maghribMs !== null && nowMs < maghribMs) {
    currentPrayer = asr.date ? 'asr' : 'dhuhr';
    nextPrayer = 'maghrib';
    nextPrayerTime = maghrib.date;
  } else if (ishaMs !== null && nowMs < ishaMs) {
    currentPrayer = maghrib.date ? 'maghrib' : (asr.date ? 'asr' : 'dhuhr');
    nextPrayer = 'isha';
    nextPrayerTime = isha.date;
  } else {
    // Current time is after today's Isha (or after all resolved daytime prayers)
    currentPrayer = isha.date ? 'isha' : (maghrib.date ? 'maghrib' : 'none');

    // Multi-day lookahead: compute actual solar ephemeris for tomorrow
    if (!isLookahead) {
      const tomorrowDate = new Date(Date.UTC(year, month, day + 1, 12, 0, 0));
      const tomorrowSchedule = calculatePrayerTimes(
        latitude,
        longitude,
        tomorrowDate,
        options,
        true,
      );

      if (tomorrowSchedule.fajr.date !== null) {
        nextPrayer = 'fajr';
        nextPrayerTime = tomorrowSchedule.fajr.date;
      } else {
        const candidateKeys: (keyof DailyPrayerTimes)[] = [
          'sunrise',
          'dhuhr',
          'asr',
          'maghrib',
          'isha',
        ];
        const nextResolved = candidateKeys.find((k) => tomorrowSchedule[k].date !== null);
        if (nextResolved) {
          nextPrayer = nextResolved as PrayerKey;
          nextPrayerTime = tomorrowSchedule[nextResolved].date;
        } else {
          nextPrayer = 'none';
          nextPrayerTime = null;
        }
      }
    } else {
      nextPrayer = 'none';
      nextPrayerTime = null;
    }
  }

  const countdownMs = nextPrayerTime ? Math.max(0, nextPrayerTime.getTime() - nowMs) : null;

  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    sunset,
    currentPrayer,
    nextPrayer,
    nextPrayerTime,
    countdownMs,
  };
}
