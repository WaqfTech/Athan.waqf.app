import { describe, it, expect } from 'vitest';
import {
  generateSolarAltitudeRing,
  generateDhuhrFront,
  generateAsrFront,
  generateGlobalPrayerFronts,
} from './contours';
import { CALCULATION_CONVENTIONS } from './conventions';
import { latLonToVector3 } from '../astronomy/coordinates';

describe('Prayer contours and fronts generator', () => {
  const subsolar = { latitude: 10, longitude: 30 };
  const radius = 5.02;

  it('generates solar altitude ring points with exact spherical radius and dot product', () => {
    const altitude = -18; // Fajr twilight
    const ring = generateSolarAltitudeRing(subsolar, altitude, radius, 60);

    expect(ring.pointCount).toBe(61);
    const [sx, sy, sz] = latLonToVector3(subsolar.latitude, subsolar.longitude, 1);

    const expectedDot = Math.sin((altitude * Math.PI) / 180);

    for (let i = 0; i < ring.pointCount; i++) {
      const x = ring.positions[i * 3];
      const y = ring.positions[i * 3 + 1];
      const z = ring.positions[i * 3 + 2];

      const r = Math.hypot(x, y, z);
      expect(r).toBeCloseTo(radius, 3);

      const dot = (x * sx + y * sy + z * sz) / radius;
      expect(dot).toBeCloseTo(expectedDot, 2);
    }
  });

  it('aligns Dhuhr front strictly along the subsolar longitude meridian', () => {
    const dhuhr = generateDhuhrFront(subsolar, radius, 30);
    expect(dhuhr.pointCount).toBe(31);

    for (let i = 0; i < dhuhr.pointCount; i++) {
      const x = dhuhr.positions[i * 3];
      const y = dhuhr.positions[i * 3 + 1];
      const z = dhuhr.positions[i * 3 + 2];

      const r = Math.hypot(x, y, z);
      expect(r).toBeCloseTo(radius, 3);

      // Longitude check: atan2(x, z) in degrees
      const lon = (Math.atan2(x, z) * 180) / Math.PI;
      expect(lon).toBeCloseTo(subsolar.longitude, 2);
    }
  });

  it('places Asr front in the afternoon hemisphere west of subsolar longitude', () => {
    const shafiAsr = generateAsrFront(subsolar, 'Shafi', radius);
    const hanafiAsr = generateAsrFront(subsolar, 'Hanafi', radius);

    expect(shafiAsr.pointCount).toBeGreaterThan(20);
    expect(hanafiAsr.pointCount).toBeGreaterThan(20);

    // Mid-latitude point (equator / near subsolar)
    const midIdx = Math.floor(shafiAsr.pointCount / 2) * 3;
    const shafiX = shafiAsr.positions[midIdx];
    const shafiZ = shafiAsr.positions[midIdx + 2];
    const shafiLon = (Math.atan2(shafiX, shafiZ) * 180) / Math.PI;

    // Asr must be west of subsolar longitude (shafiLon < subsolar.longitude)
    let diffLon = subsolar.longitude - shafiLon;
    while (diffLon < 0) diffLon += 360;
    expect(diffLon).toBeGreaterThan(15); // At least 1 hour after noon

    const hanafiX = hanafiAsr.positions[midIdx];
    const hanafiZ = hanafiAsr.positions[midIdx + 2];
    const hanafiLon = (Math.atan2(hanafiX, hanafiZ) * 180) / Math.PI;

    let hanafiDiffLon = subsolar.longitude - hanafiLon;
    while (hanafiDiffLon < 0) hanafiDiffLon += 360;
    // Hanafi Asr is farther west than Shafi
    expect(hanafiDiffLon).toBeGreaterThan(diffLon);
  });

  it('generates all five global prayer fronts successfully', () => {
    const fronts = generateGlobalPrayerFronts(
      subsolar,
      CALCULATION_CONVENTIONS.UmmAlQura,
      'Shafi',
      radius,
    );

    expect(fronts.fajr.pointCount).toBeGreaterThan(10);
    expect(fronts.sunrise.pointCount).toBeGreaterThan(10);
    expect(fronts.dhuhr.pointCount).toBeGreaterThan(10);
    expect(fronts.asr.pointCount).toBeGreaterThan(10);
    expect(fronts.maghrib.pointCount).toBeGreaterThan(10);
    expect(fronts.isha.pointCount).toBeGreaterThan(10);
    expect(fronts.terminator.pointCount).toBeGreaterThan(50);
  });
});
