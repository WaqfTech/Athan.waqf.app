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
