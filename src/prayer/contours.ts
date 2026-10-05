// Global continuous prayer front and twilight contour generator

import { getSubsolarPoint, SubsolarCoordinates } from '../astronomy/solar';
import { latLonToVector3, Vector3Tuple } from '../astronomy/coordinates';
import { CalculationParameters, Madhab } from './conventions';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Normalizes an angle into [-180, 180] degrees.
 */
export function wrap180(deg: number): number {
  let val = deg % 360;
  if (val > 180) val -= 360;
  if (val < -180) val += 360;
  return val;
}

export interface PrayerContourPoints {
  /** Array of 3D Cartesian coordinates [x, y, z, x, y, z, ...] for line rendering */
  positions: Float32Array;
  /** Number of 3D points */
  pointCount: number;
}

export interface GlobalPrayerFronts {
  fajr: PrayerContourPoints;
  sunrise: PrayerContourPoints;
  dhuhr: PrayerContourPoints;
  asr: PrayerContourPoints;
  maghrib: PrayerContourPoints;
  isha: PrayerContourPoints;
  terminator: PrayerContourPoints;
  geometricTerminator: PrayerContourPoints;
  apparentTerminator: PrayerContourPoints;
}

/**
 * Generate a 3D small circle of constant solar altitude centered at the subsolar point.
 */
export function generateSolarAltitudeRing(
  subsolar: SubsolarCoordinates,
  altitudeDeg: number,
  radius: number,
  segmentCount = 120,
): PrayerContourPoints {
  const theta = (90 - altitudeDeg) * DEG2RAD; // Angular radius from subsolar point
  const [sx, sy, sz] = latLonToVector3(subsolar.latitude, subsolar.longitude, 1);

  // Orthonormal basis (u, v) perpendicular to subsolar vector s
  let upX = 0;
  let upY = 1;
  let upZ = 0;
  if (Math.abs(sy) > 0.95) {
    upX = 1;
    upY = 0;
  }

  // u = s x up
  let ux = sy * upZ - sz * upY;
  let uy = sz * upX - sx * upZ;
  let uz = sx * upY - sy * upX;
  const uLen = Math.hypot(ux, uy, uz);
  ux /= uLen;
  uy /= uLen;
  uz /= uLen;

  // v = s x u
  const vx = sy * uz - sz * uy;
  const vy = sz * ux - sx * uz;
  const vz = sx * uy - sy * ux;

  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  // Points array includes closing point
  const pointCount = segmentCount + 1;
  const positions = new Float32Array(pointCount * 3);

  for (let i = 0; i <= segmentCount; i++) {
    const alpha = (i / segmentCount) * Math.PI * 2;
    const cosAlpha = Math.cos(alpha);
    const sinAlpha = Math.sin(alpha);

    const px = cosTheta * sx + sinTheta * (cosAlpha * ux + sinAlpha * vx);
    const py = cosTheta * sy + sinTheta * (cosAlpha * uy + sinAlpha * vy);
    const pz = cosTheta * sz + sinTheta * (cosAlpha * uz + sinAlpha * vz);

    const idx = i * 3;
    positions[idx] = px * radius;
    positions[idx + 1] = py * radius;
    positions[idx + 2] = pz * radius;
  }

  return { positions, pointCount };
}

/**
 * Generate dawn or dusk half-arc of a solar altitude ring.
 * Preserves curve continuity by sampling along alpha in sequential order.
 */
export function generateSolarAltitudeArc(
  subsolar: SubsolarCoordinates,
  altitudeDeg: number,
  type: 'dawn' | 'dusk',
  radius: number,
  segmentCount = 64,
): PrayerContourPoints {
  const theta = (90 - altitudeDeg) * DEG2RAD;
  const [sx, sy, sz] = latLonToVector3(subsolar.latitude, subsolar.longitude, 1);

  let upX = 0;
  let upY = 1;
  let upZ = 0;
  if (Math.abs(sy) > 0.95) {
    upX = 1;
    upY = 0;
  }

  let ux = sy * upZ - sz * upY;
  let uy = sz * upX - sx * upZ;
  let uz = sx * upY - sy * upX;
  const uLen = Math.hypot(ux, uy, uz);
  ux /= uLen;
  uy /= uLen;
  uz /= uLen;

  const vx = sy * uz - sz * uy;
  const vy = sz * ux - sx * uz;
  const vz = sx * uy - sy * ux;

  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  const samples = segmentCount * 2;
  const circlePoints: Vector3Tuple[] = [];
  const matches: boolean[] = [];

  for (let i = 0; i < samples; i++) {
    const alpha = (i / samples) * Math.PI * 2;
    const cosAlpha = Math.cos(alpha);
    const sinAlpha = Math.sin(alpha);

    const px = cosTheta * sx + sinTheta * (cosAlpha * ux + sinAlpha * vx);
    const py = cosTheta * sy + sinTheta * (cosAlpha * uy + sinAlpha * vy);
    const pz = cosTheta * sz + sinTheta * (cosAlpha * uz + sinAlpha * vz);

    // Compute point longitude in degrees [-180, 180]
    const lon = Math.atan2(px, pz) * RAD2DEG;
    const H = wrap180(lon - subsolar.longitude);

    // Morning dawn is where H < 0 (rising Sun, dh/dt > 0)
    // Evening dusk is where H > 0 (falling Sun, dh/dt < 0)
    const isDawn = H < 0;
    const isDusk = H > 0;
    const isMatch = type === 'dawn' ? isDawn : isDusk;

    circlePoints.push([px * radius, py * radius, pz * radius]);
    matches.push(isMatch);
  }

  // Find the contiguous segment of alpha where the condition holds.
  // Sampling sequentially along alpha eliminates sorting by Cartesian y which caused high-latitude zig-zags.
  let bestStart = -1;
  let bestLen = 0;

  if (matches.every(Boolean)) {
    bestStart = 0;
    bestLen = samples;
  } else {
    for (let i = 0; i < samples; i++) {
      const prev = (i - 1 + samples) % samples;
      if (matches[i] && !matches[prev]) {
        let len = 0;
        let curr = i;
        while (matches[curr] && len < samples) {
          len++;
          curr = (curr + 1) % samples;
        }
        if (len > bestLen) {
          bestLen = len;
          bestStart = i;
        }
      }
    }
  }

  const rawPoints: Vector3Tuple[] = [];
  if (bestStart !== -1) {
    for (let k = 0; k < bestLen; k++) {
      const idx = (bestStart + k) % samples;
      rawPoints.push(circlePoints[idx]);
    }
  }

  const positions = new Float32Array(rawPoints.length * 3);
  for (let i = 0; i < rawPoints.length; i++) {
    positions[i * 3] = rawPoints[i][0];
    positions[i * 3 + 1] = rawPoints[i][1];
    positions[i * 3 + 2] = rawPoints[i][2];
  }

  return { positions, pointCount: rawPoints.length };
}

/**
 * Generate Dhuhr front: the solar noon meridian on the sunlit hemisphere.
 */
export function generateDhuhrFront(
  subsolar: SubsolarCoordinates,
  radius: number,
  segmentCount = 48,
): PrayerContourPoints {
  const positions = new Float32Array((segmentCount + 1) * 3);

  // Meridian spans from South Pole to North Pole at subsolar longitude
  for (let i = 0; i <= segmentCount; i++) {
    const lat = -88 + (i / segmentCount) * 176;
    const [x, y, z] = latLonToVector3(lat, subsolar.longitude, radius);
    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  }

  return { positions, pointCount: segmentCount + 1 };
}

/**
 * Generate Asr front: the curve where shadow length equals noon shadow plus shadow factor (1 or 2).
 * Strictly placed on the afternoon side (H > 0) with positive noon shadow check.
 */
export function generateAsrFront(
  subsolar: SubsolarCoordinates,
  madhab: Madhab,
  radius: number,
  stepDeg = 2,
): PrayerContourPoints {
  const delta = subsolar.latitude * DEG2RAD;
  const shadowFactor = madhab === 'Hanafi' ? 2 : 1;
  const rawPoints: Vector3Tuple[] = [];

  for (let lat = -89.5; lat <= 89.5; lat += stepDeg) {
    const zenithDeg = Math.abs(lat - subsolar.latitude);
    // Positive noon shadow check: noon altitude = 90 - zenithDeg must be > 0
    if (zenithDeg >= 90) continue;

    const phi = lat * DEG2RAD;
    const noonShadow = Math.tan(zenithDeg * DEG2RAD);
    const asrAltitudeRad = Math.atan(1 / (noonShadow + shadowFactor));

    const denom = Math.cos(phi) * Math.cos(delta);
    if (Math.abs(denom) < 1e-6) continue;

    const sinH = Math.sin(asrAltitudeRad);
    const cosH = (sinH - Math.sin(phi) * Math.sin(delta)) / denom;

    if (cosH >= -1 && cosH <= 1) {
      const hourAngleDeg = Math.acos(cosH) * RAD2DEG;
      // In afternoon, Asr front is strictly East of subsolar meridian (H > 0)
      const asrLon = wrap180(subsolar.longitude + hourAngleDeg);

      const [x, y, z] = latLonToVector3(lat, asrLon, radius);
      rawPoints.push([x, y, z]);
    }
  }

  const positions = new Float32Array(rawPoints.length * 3);
  for (let i = 0; i < rawPoints.length; i++) {
    positions[i * 3] = rawPoints[i][0];
    positions[i * 3 + 1] = rawPoints[i][1];
    positions[i * 3 + 2] = rawPoints[i][2];
  }

  return { positions, pointCount: rawPoints.length };
}

/**
 * Generate all continuous 3D prayer fronts for the current planetary state.
 */
export function generateGlobalPrayerFronts(
  subsolar: SubsolarCoordinates,
  convention: CalculationParameters,
  madhab: Madhab,
  radius: number,
  date?: Date,
): GlobalPrayerFronts {
  const fajr = generateSolarAltitudeArc(subsolar, -convention.fajrAngle, 'dawn', radius);
  const sunrise = generateSolarAltitudeArc(subsolar, -0.8333, 'dawn', radius);
  const dhuhr = generateDhuhrFront(subsolar, radius);
  const asr = generateAsrFront(subsolar, madhab, radius);
  const maghribAngle = convention.maghribAngle && convention.maghribAngle > 0
    ? -convention.maghribAngle
    : -0.8333;
  const maghrib = generateSolarAltitudeArc(subsolar, maghribAngle, 'dusk', radius);

  let isha: PrayerContourPoints;
  const isFixedInterval =
    (convention.ishaIntervalMinutes !== undefined && convention.ishaIntervalMinutes > 0) ||
    (convention.ishaAngle === 0 && (convention.name === 'UmmAlQura' || convention.name === 'Qatar'));

  if (isFixedInterval) {
    const intervalMinutes = convention.ishaIntervalMinutes || 90;
    let prevSubsolar: SubsolarCoordinates;
    if (date) {
      const prevDate = new Date(date.getTime() - intervalMinutes * 60000);
      prevSubsolar = getSubsolarPoint(prevDate);
    } else {
      // If date is not provided, rotate subsolar longitude by -0.25 deg/min:
      // Subsolar point moves westward at 0.25 deg/min (15 deg/hr).
      // At t - intervalMinutes, subsolar point was eastward:
      prevSubsolar = {
        latitude: subsolar.latitude,
        longitude: wrap180(subsolar.longitude + intervalMinutes * 0.25),
      };
    }
    isha = generateSolarAltitudeArc(prevSubsolar, maghribAngle, 'dusk', radius);
  } else {
    const ishaAngle = convention.ishaAngle > 0 ? convention.ishaAngle : 18;
    isha = generateSolarAltitudeArc(subsolar, -ishaAngle, 'dusk', radius);
  }

  // Geometric terminator (solar center at horizon: 0.0 deg)
  const geometricTerminator = generateSolarAltitudeRing(subsolar, 0.0, radius);
  // Apparent terminator (solar upper limb touching apparent horizon: -0.8333 deg)
  const apparentTerminator = generateSolarAltitudeRing(subsolar, -0.8333, radius);

  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    terminator: apparentTerminator,
    geometricTerminator,
    apparentTerminator,
  };
}
