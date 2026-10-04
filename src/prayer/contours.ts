// Global continuous prayer front and twilight contour generator

import { SubsolarCoordinates } from '../astronomy/solar';
import { latLonToVector3, Vector3Tuple } from '../astronomy/coordinates';
import { CalculationParameters, Madhab } from './conventions';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

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

  // Filter circle points to only include points whose local hour angle matches dawn or dusk
  const rawPoints: Vector3Tuple[] = [];
  const samples = segmentCount * 2;

  for (let i = 0; i < samples; i++) {
    const alpha = (i / samples) * Math.PI * 2;
    const cosAlpha = Math.cos(alpha);
    const sinAlpha = Math.sin(alpha);

    const px = cosTheta * sx + sinTheta * (cosAlpha * ux + sinAlpha * vx);
    const py = cosTheta * sy + sinTheta * (cosAlpha * uy + sinAlpha * vy);
    const pz = cosTheta * sz + sinTheta * (cosAlpha * uz + sinAlpha * vz);

    // Compute point longitude in degrees [-180, 180]
    const lon = Math.atan2(px, pz) * RAD2DEG;
    let diffLon = subsolar.longitude - lon;
    while (diffLon > 180) diffLon -= 360;
    while (diffLon < -180) diffLon += 360;

    // diffLon < 0 means point is East of subsolar meridian (morning / dawn)
    // diffLon > 0 means point is West of subsolar meridian (afternoon / dusk)
    const isDawn = diffLon < 0;
    if ((type === 'dawn' && isDawn) || (type === 'dusk' && !isDawn)) {
      rawPoints.push([px * radius, py * radius, pz * radius]);
    }
  }

  // Sort arc points from South to North for smooth line continuity
  rawPoints.sort((a, b) => a[1] - b[1]);

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

  for (let lat = -80; lat <= 80; lat += stepDeg) {
    const phi = lat * DEG2RAD;
    const noonShadow = Math.tan(Math.abs(phi - delta));
    const asrAltitudeRad = Math.atan(1 / (noonShadow + shadowFactor));

    const sinH = Math.sin(asrAltitudeRad);
    const cosH = (sinH - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));

    if (cosH >= -1 && cosH <= 1) {
      const hourAngleDeg = Math.acos(cosH) * RAD2DEG;
      // In afternoon, Asr front is West of subsolar meridian
      let asrLon = subsolar.longitude - hourAngleDeg;
      while (asrLon > 180) asrLon -= 360;
      while (asrLon < -180) asrLon += 360;

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
): GlobalPrayerFronts {
  const fajr = generateSolarAltitudeArc(subsolar, -convention.fajrAngle, 'dawn', radius);
  const sunrise = generateSolarAltitudeArc(subsolar, -0.833, 'dawn', radius);
  const dhuhr = generateDhuhrFront(subsolar, radius);
  const asr = generateAsrFront(subsolar, madhab, radius);
  const maghrib = generateSolarAltitudeArc(subsolar, -0.833, 'dusk', radius);

  const ishaAngle = convention.ishaAngle > 0 ? convention.ishaAngle : 18;
  const isha = generateSolarAltitudeArc(subsolar, -ishaAngle, 'dusk', radius);

  // Full terminator circle (sunrise + sunset boundary)
  const terminator = generateSolarAltitudeRing(subsolar, -0.833, radius);

  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    terminator,
  };
}
