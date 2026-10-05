import { describe, it, expect } from 'vitest';
import {
  generateSolarAltitudeRing,
  generateSolarAltitudeArc,
  generateDhuhrFront,
  generateAsrFront,
  generateGlobalPrayerFronts,
  wrap180,
} from './contours';
import { CALCULATION_CONVENTIONS } from './conventions';
import { latLonToVector3 } from '../astronomy/coordinates';
import { getSubsolarPoint } from '../astronomy/solar';

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

  it('places Asr front in the afternoon hemisphere east of subsolar longitude (H > 0)', () => {
    const shafiAsr = generateAsrFront(subsolar, 'Shafi', radius);
    const hanafiAsr = generateAsrFront(subsolar, 'Hanafi', radius);

    expect(shafiAsr.pointCount).toBeGreaterThan(20);
    expect(hanafiAsr.pointCount).toBeGreaterThan(20);

    // Mid-latitude point near subsolar latitude
    const midIdx = Math.floor(shafiAsr.pointCount / 2) * 3;
    const shafiX = shafiAsr.positions[midIdx];
    const shafiZ = shafiAsr.positions[midIdx + 2];
    const shafiLon = (Math.atan2(shafiX, shafiZ) * 180) / Math.PI;

    // Asr occurs in afternoon: observer is east of subsolar meridian (H > 0)
    const diffLon = wrap180(shafiLon - subsolar.longitude);
    expect(diffLon).toBeGreaterThan(15); // At least 1 hour after noon

    const hanafiX = hanafiAsr.positions[midIdx];
    const hanafiZ = hanafiAsr.positions[midIdx + 2];
    const hanafiLon = (Math.atan2(hanafiX, hanafiZ) * 180) / Math.PI;

    const hanafiDiffLon = wrap180(hanafiLon - subsolar.longitude);
    // Hanafi Asr is later in the afternoon (farther east) than Shafi
    expect(hanafiDiffLon).toBeGreaterThan(diffLon);
  });

  it('skips latitudes during polar night where noon solar altitude <= 0 (positive noon shadow check)', () => {
    // Subsolar point in deep southern hemisphere (winter in north)
    const winterSubsolar = { latitude: -23.44, longitude: 0 };
    const asr = generateAsrFront(winterSubsolar, 'Shafi', radius, 1);

    // Arctic points above 66.56 N must be skipped because zenith >= 90 deg
    for (let i = 0; i < asr.pointCount; i++) {
      const y = asr.positions[i * 3 + 1];
      const lat = Math.asin(y / radius) * (180 / Math.PI);
      expect(lat).toBeLessThan(66.56);
    }
  });

  it('generates fixed-interval Isha front for UmmAlQura matching 90-minute historical dusk locus', () => {
    const testDate = new Date('2026-10-04T12:00:00Z');
    const realSubsolar = getSubsolarPoint(testDate);
    const frontsWithDate = generateGlobalPrayerFronts(
      realSubsolar,
      CALCULATION_CONVENTIONS.UmmAlQura,
      'Shafi',
      radius,
      testDate,
    );
    const frontsWithoutDate = generateGlobalPrayerFronts(
      subsolar,
      CALCULATION_CONVENTIONS.UmmAlQura,
      'Shafi',
      radius,
    );

    expect(frontsWithDate.isha.pointCount).toBeGreaterThan(10);
    expect(frontsWithoutDate.isha.pointCount).toBeGreaterThan(10);

    // In fixed-interval 90-min Isha, dusk locus is shifted eastward by ~22.5 degrees relative to Maghrib
    const maghribMid = Math.floor(frontsWithDate.maghrib.pointCount / 2) * 3;
    const maghribLon = (Math.atan2(frontsWithDate.maghrib.positions[maghribMid], frontsWithDate.maghrib.positions[maghribMid + 2]) * 180) / Math.PI;

    const ishaMid = Math.floor(frontsWithDate.isha.pointCount / 2) * 3;
    const ishaLon = (Math.atan2(frontsWithDate.isha.positions[ishaMid], frontsWithDate.isha.positions[ishaMid + 2]) * 180) / Math.PI;

    const lonShiftWithDate = wrap180(ishaLon - maghribLon);
    expect(lonShiftWithDate).toBeCloseTo(22.5, 0);

    // Also verify without date: rotation by 22.5 degrees is exact
    const mMidNoDate = Math.floor(frontsWithoutDate.maghrib.pointCount / 2) * 3;
    const mLonNoDate = (Math.atan2(frontsWithoutDate.maghrib.positions[mMidNoDate], frontsWithoutDate.maghrib.positions[mMidNoDate + 2]) * 180) / Math.PI;

    const iMidNoDate = Math.floor(frontsWithoutDate.isha.pointCount / 2) * 3;
    const iLonNoDate = (Math.atan2(frontsWithoutDate.isha.positions[iMidNoDate], frontsWithoutDate.isha.positions[iMidNoDate + 2]) * 180) / Math.PI;

    const lonShiftNoDate = wrap180(iLonNoDate - mLonNoDate);
    expect(lonShiftNoDate).toBeCloseTo(22.5, 0);
  });

  it('separates geometric and apparent terminators distinctly', () => {
    const fronts = generateGlobalPrayerFronts(
      subsolar,
      CALCULATION_CONVENTIONS.MuslimWorldLeague,
      'Shafi',
      radius,
    );

    expect(fronts.geometricTerminator.pointCount).toBeGreaterThan(50);
    expect(fronts.apparentTerminator.pointCount).toBeGreaterThan(50);
    expect(fronts.terminator.pointCount).toBeGreaterThan(50);

    // Verify geometric terminator has dot product 0.0 with subsolar vector
    const [sx, sy, sz] = latLonToVector3(subsolar.latitude, subsolar.longitude, 1);
    for (let i = 0; i < fronts.geometricTerminator.pointCount; i += 10) {
      const idx = i * 3;
      const x = fronts.geometricTerminator.positions[idx];
      const y = fronts.geometricTerminator.positions[idx + 1];
      const z = fronts.geometricTerminator.positions[idx + 2];
      const dot = (x * sx + y * sy + z * sz) / radius;
      expect(dot).toBeCloseTo(0.0, 2);
    }

    // Verify apparent terminator has negative dot product corresponding to -0.8333 deg
    const expectedApparentDot = Math.sin((-0.8333 * Math.PI) / 180);
    for (let i = 0; i < fronts.apparentTerminator.pointCount; i += 10) {
      const idx = i * 3;
      const x = fronts.apparentTerminator.positions[idx];
      const y = fronts.apparentTerminator.positions[idx + 1];
      const z = fronts.apparentTerminator.positions[idx + 2];
      const dot = (x * sx + y * sy + z * sz) / radius;
      expect(dot).toBeCloseTo(expectedApparentDot, 2);
    }
  });

  it('preserves arc curve continuity without Cartesian y sorting zig-zags', () => {
    const arc = generateSolarAltitudeArc(subsolar, -0.8333, 'dawn', radius, 64);
    expect(arc.pointCount).toBeGreaterThan(10);

    // Check distance between consecutive vertices is smooth and small
    for (let i = 0; i < arc.pointCount - 1; i++) {
      const idx = i * 3;
      const nextIdx = (i + 1) * 3;
      const dx = arc.positions[nextIdx] - arc.positions[idx];
      const dy = arc.positions[nextIdx + 1] - arc.positions[idx + 1];
      const dz = arc.positions[nextIdx + 2] - arc.positions[idx + 2];
      const dist = Math.hypot(dx, dy, dz);
      // Arc step distance should be small (< 1.0 unit for radius 5.02)
      expect(dist).toBeLessThan(1.0);
    }
  });

  it('verifies observer directionality: dawn H < 0, dusk H > 0', () => {
    const dawnArc = generateSolarAltitudeArc(subsolar, -18, 'dawn', radius);
    for (let i = 0; i < dawnArc.pointCount; i += 5) {
      const idx = i * 3;
      const lon = (Math.atan2(dawnArc.positions[idx], dawnArc.positions[idx + 2]) * 180) / Math.PI;
      const H = wrap180(lon - subsolar.longitude);
      expect(H).toBeLessThan(0);
    }

    const duskArc = generateSolarAltitudeArc(subsolar, -18, 'dusk', radius);
    for (let i = 0; i < duskArc.pointCount; i += 5) {
      const idx = i * 3;
      const lon = (Math.atan2(duskArc.positions[idx], duskArc.positions[idx + 2]) * 180) / Math.PI;
      const H = wrap180(lon - subsolar.longitude);
      expect(H).toBeGreaterThan(0);
    }
  });
});
