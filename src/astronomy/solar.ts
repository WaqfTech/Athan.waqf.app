// Solar position calculations based on NOAA Solar Calculator and Meeus Astronomical Algorithms

import { getJulianCenturies } from './julian';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface SubsolarCoordinates {
  /** Latitude in degrees [-90, 90] (equal to solar declination) */
  latitude: number;
  /** Longitude in degrees [-180, 180] */
  longitude: number;
}

/**
 * Normalizes an angle into [0, 360) range.
 */
function normalizeDegrees(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Compute the Geometric Mean Longitude of the Sun in degrees.
 */
export function getSunGeometricMeanLongitude(T: number): number {
  return normalizeDegrees(280.46646 + T * (36000.76983 + T * 0.0003032));
}

/**
 * Compute the Geometric Mean Anomaly of the Sun in degrees.
 */
export function getSunMeanAnomaly(T: number): number {
  return normalizeDegrees(357.52911 + T * (35999.05029 - 0.0001537 * T));
}

/**
 * Compute the eccentricity of Earth's orbit.
 */
export function getEarthOrbitEccentricity(T: number): number {
  return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
}

/**
 * Compute the Sun's Equation of the Center in degrees.
 */
export function getSunEquationOfCenter(T: number, M: number): number {
  const mRad = M * DEG2RAD;
  return (
    Math.sin(mRad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * mRad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * mRad) * 0.000289
  );
}

/**
 * Compute the Sun's true longitude in degrees.
 */
export function getSunTrueLongitude(T: number): number {
  const L0 = getSunGeometricMeanLongitude(T);
  const M = getSunMeanAnomaly(T);
  const C = getSunEquationOfCenter(T, M);
  return L0 + C;
}

/**
 * Compute the Sun's apparent longitude in degrees (adjusted for aberration and nutation).
 */
export function getSunApparentLongitude(T: number): number {
  const trueLong = getSunTrueLongitude(T);
  const omega = 125.04 - 1934.136 * T;
  return trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);
}

/**
 * Compute the mean obliquity of the ecliptic in degrees.
 */
export function getMeanObliquityOfEcliptic(T: number): number {
  const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
}

/**
 * Compute the corrected obliquity of the ecliptic in degrees.
 */
export function getObliquityOfEcliptic(T: number): number {
  const e0 = getMeanObliquityOfEcliptic(T);
  const omega = 125.04 - 1934.136 * T;
  return e0 + 0.00256 * Math.cos(omega * DEG2RAD);
}

/**
 * Compute the solar declination in degrees [-23.5, 23.5].
 */
export function getSolarDeclination(date: Date): number {
  const T = getJulianCenturies(date);
  const lambdaApp = getSunApparentLongitude(T);
  const epsilon = getObliquityOfEcliptic(T);

  const sinDeclination = Math.sin(epsilon * DEG2RAD) * Math.sin(lambdaApp * DEG2RAD);
  return Math.asin(sinDeclination) * RAD2DEG;
}

/**
 * Compute the Equation of Time (EoT) in minutes.
 */
export function getEquationOfTime(date: Date): number {
  const T = getJulianCenturies(date);
  const epsilon = getObliquityOfEcliptic(T);
  const L0 = getSunGeometricMeanLongitude(T);
  const e = getEarthOrbitEccentricity(T);
  const M = getSunMeanAnomaly(T);

  const y = Math.tan((epsilon * DEG2RAD) / 2) ** 2;

  const sin2L0 = Math.sin(2 * L0 * DEG2RAD);
  const sinM = Math.sin(M * DEG2RAD);
  const cos2L0 = Math.cos(2 * L0 * DEG2RAD);
  const sin4L0 = Math.sin(4 * L0 * DEG2RAD);
  const sin2M = Math.sin(2 * M * DEG2RAD);

  const eotRad =
    y * sin2L0 -
    2 * e * sinM +
    4 * e * y * sinM * cos2L0 -
    0.5 * y * y * sin4L0 -
    1.25 * e * e * sin2M;

  return 4 * RAD2DEG * eotRad;
}

/**
 * Compute the subsolar point (latitude and longitude where the Sun is directly at zenith) at a given UTC date.
 */
export function getSubsolarPoint(date: Date): SubsolarCoordinates {
  const declination = getSolarDeclination(date);
  const eot = getEquationOfTime(date);

  // UTC time in hours [0, 24)
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;

  // Greenwich Hour Angle in degrees
  // At 12:00 UTC without EoT, Sun is at longitude 0.
  // Equation of time shifts solar noon: solar noon at Greenwich occurs at 12:00 - EoT.
  let lon = (12 - utcHours) * 15 - eot / 4;

  // Normalize into [-180, 180]
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;

  return {
    latitude: declination,
    longitude: lon,
  };
}

/**
 * Compute the solar elevation angle (altitude above horizon) in degrees for any observer location.
 */
export function getSolarAltitude(
  observerLat: number,
  observerLon: number,
  date: Date,
): number {
  const subsolar = getSubsolarPoint(date);

  const phi1 = observerLat * DEG2RAD;
  const phi2 = subsolar.latitude * DEG2RAD;
  const deltaLon = (observerLon - subsolar.longitude) * DEG2RAD;

  // Spherical cosine law for zenith distance z
  // cos(z) = sin(phi1) * sin(phi2) + cos(phi1) * cos(phi2) * cos(deltaLon)
  // altitude h = 90 - z => sin(h) = cos(z)
  const sinH =
    Math.sin(phi1) * Math.sin(phi2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLon);

  // Clamp to [-1, 1] to prevent NaN from precision limits
  const clampedSinH = Math.max(-1, Math.min(1, sinH));
  return Math.asin(clampedSinH) * RAD2DEG;
}
