// Julian Day and Century calculations based on Meeus Astronomical Algorithms

export const J2000_EPOCH = 2451545.0;
export const MS_PER_DAY = 86400000;
export const DAYS_PER_CENTURY = 36525.0;

/**
 * Compute the Julian Day (JD) from a JavaScript Date in UTC.
 */
export function getJulianDay(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('Invalid date: date must be a valid Date instance with a finite timestamp');
  }
  return date.getTime() / MS_PER_DAY + 2440587.5;
}

/**
 * Type-safe alias for getJulianDay.
 */
export const getJulianDate = getJulianDay;

/**
 * Compute the number of Julian centuries elapsed since J2000.0 (2000-01-01 12:00:00 UTC).
 */
export function getJulianCenturies(date: Date): number {
  return (getJulianDay(date) - J2000_EPOCH) / DAYS_PER_CENTURY;
}

