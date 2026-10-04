// Calculation conventions and parameters for Islamic prayer times

export type CalculationConventionName =
  | 'MuslimWorldLeague'
  | 'UmmAlQura'
  | 'Egyptian'
  | 'Karachi'
  | 'NorthAmerica'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'Singapore'
  | 'Turkey';

export type Madhab = 'Shafi' | 'Hanafi';

export type HighLatitudeRule = 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'AngleBased';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface CalculationParameters {
  name: CalculationConventionName;
  fajrAngle: number;
  ishaAngle: number;
  /** Fixed minutes after Maghrib for Isha (e.g. 90 minutes in Umm Al-Qura) */
  ishaIntervalMinutes?: number;
  maghribAngle?: number;
  dhuhrSafetyMinutes?: number;
}

export const CALCULATION_CONVENTIONS: Record<CalculationConventionName, CalculationParameters> = {
  MuslimWorldLeague: {
    name: 'MuslimWorldLeague',
    fajrAngle: 18.0,
    ishaAngle: 17.0,
    dhuhrSafetyMinutes: 1,
  },
  UmmAlQura: {
    name: 'UmmAlQura',
    fajrAngle: 18.5,
    ishaAngle: 0,
    ishaIntervalMinutes: 90,
    dhuhrSafetyMinutes: 1,
  },
  Egyptian: {
    name: 'Egyptian',
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    dhuhrSafetyMinutes: 1,
  },
  Karachi: {
    name: 'Karachi',
    fajrAngle: 18.0,
    ishaAngle: 18.0,
    dhuhrSafetyMinutes: 1,
  },
  NorthAmerica: {
    name: 'NorthAmerica',
    fajrAngle: 15.0,
    ishaAngle: 15.0,
    dhuhrSafetyMinutes: 1,
  },
  Dubai: {
    name: 'Dubai',
    fajrAngle: 18.2,
    ishaAngle: 18.2,
    dhuhrSafetyMinutes: 1,
  },
  Qatar: {
    name: 'Qatar',
    fajrAngle: 18.0,
    ishaAngle: 0,
    ishaIntervalMinutes: 90,
    dhuhrSafetyMinutes: 1,
  },
  Kuwait: {
    name: 'Kuwait',
    fajrAngle: 18.0,
    ishaAngle: 17.5,
    dhuhrSafetyMinutes: 1,
  },
  Singapore: {
    name: 'Singapore',
    fajrAngle: 20.0,
    ishaAngle: 18.0,
    dhuhrSafetyMinutes: 1,
  },
  Turkey: {
    name: 'Turkey',
    fajrAngle: 18.0,
    ishaAngle: 17.0,
    dhuhrSafetyMinutes: 1,
  },
};
