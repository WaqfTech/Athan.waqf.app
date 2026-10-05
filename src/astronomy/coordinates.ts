// Spherical and Cartesian 3D coordinate conversions for planetary geometry

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface GeographicCoordinate {
  latitude: number;
  longitude: number;
}

export type Vector3Tuple = [number, number, number];

/**
 * Convert latitude and longitude in degrees to a 3D Cartesian vector.
 *
 * Coordinate system convention:
 * +Y points to North Pole (lat = +90)
 * -Y points to South Pole (lat = -90)
 * +Z points to Prime Meridian at Equator (lat = 0, lon = 0)
 * +X points to East longitude 90 deg at Equator (lat = 0, lon = +90)
 * -X points to West longitude 90 deg at Equator (lat = 0, lon = -90)
 * -Z points to Antimeridian at Equator (lat = 0, lon = 180)
 */
export function latLonToVector3(
  latitude: number,
  longitude: number,
  radius = 1,
): Vector3Tuple {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) {
    throw new TypeError('Latitude must be a finite number');
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    throw new TypeError('Longitude must be a finite number');
  }
  if (typeof radius !== 'number' || !Number.isFinite(radius)) {
    throw new TypeError('Radius must be a finite number');
  }

  const phi = latitude * DEG2RAD;
  const lambda = longitude * DEG2RAD;

  const cosPhi = Math.cos(phi);
  const x = radius * cosPhi * Math.sin(lambda);
  const y = radius * Math.sin(phi);
  const z = radius * cosPhi * Math.cos(lambda);

  return [x, y, z];
}

/**
 * Convert a 3D Cartesian vector back to geographic latitude and longitude in degrees.
 */
export function vector3ToLatLon(x: number, y: number, z: number): GeographicCoordinate {
  if (
    typeof x !== 'number' || !Number.isFinite(x) ||
    typeof y !== 'number' || !Number.isFinite(y) ||
    typeof z !== 'number' || !Number.isFinite(z)
  ) {
    throw new TypeError('Vector coordinates must be finite numbers');
  }

  const r = Math.hypot(x, y, z);
  if (r === 0) {
    return { latitude: 0, longitude: 0 };
  }

  const phi = Math.asin(Math.max(-1, Math.min(1, y / r))) * RAD2DEG;
  const lambda = Math.atan2(x, z) * RAD2DEG;

  return {
    latitude: phi,
    longitude: lambda,
  };
}

/**
 * Type-safe aliases matching Display Coordinate System specifications.
 */
export const toDisplayCoordinates = latLonToVector3;
export const fromDisplayCoordinates = vector3ToLatLon;

/**
 * Calculate the local hour angle in degrees wrapped into [-180, 180].
 * H = wrap180(observerLon - subsolarLon).
 *
 * For East-positive coordinates:
 * - H < 0: Observer is West of the Sun (morning, rising sun, dh/dt > 0).
 * - H > 0: Observer is East of the Sun (afternoon, setting sun, dh/dt < 0).
 */
export function getLocalHourAngle(observerLon: number, subsolarLon: number): number {
  if (typeof observerLon !== 'number' || !Number.isFinite(observerLon)) {
    throw new TypeError('Observer longitude must be a finite number');
  }
  if (typeof subsolarLon !== 'number' || !Number.isFinite(subsolarLon)) {
    throw new TypeError('Subsolar longitude must be a finite number');
  }

  let diff = (observerLon - subsolarLon) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Calculate the great-circle angular distance in degrees between two geographic points.
 */
export function angularDistanceDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = lat1 * DEG2RAD;
  const phi2 = lat2 * DEG2RAD;
  const deltaLambda = (lon2 - lon1) * DEG2RAD;

  const sinDeltaPhiHalf = Math.sin((phi2 - phi1) / 2);
  const sinDeltaLambdaHalf = Math.sin(deltaLambda / 2);

  const a =
    sinDeltaPhiHalf * sinDeltaPhiHalf +
    Math.cos(phi1) * Math.cos(phi2) * sinDeltaLambdaHalf * sinDeltaLambdaHalf;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return c * RAD2DEG;
}

