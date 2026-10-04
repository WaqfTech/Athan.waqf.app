import { describe, it, expect } from 'vitest';
import { getJulianDay, getJulianCenturies, J2000_EPOCH } from './julian';
import {
  getSolarDeclination,
  getEquationOfTime,
  getSubsolarPoint,
  getSolarAltitude,
} from './solar';
import {
  latLonToVector3,
  vector3ToLatLon,
  angularDistanceDegrees,
} from './coordinates';

describe('Julian calculations', () => {
  it('computes exact Julian Day for J2000.0 (2000-01-01 12:00:00 UTC)', () => {
    const j2000 = new Date('2000-01-01T12:00:00Z');
    expect(getJulianDay(j2000)).toBeCloseTo(J2000_EPOCH, 5);
    expect(getJulianCenturies(j2000)).toBeCloseTo(0, 5);
  });

  it('computes exact Julian Day for Unix epoch (1970-01-01 00:00:00 UTC)', () => {
    const epoch = new Date('1970-01-01T00:00:00Z');
    expect(getJulianDay(epoch)).toBeCloseTo(2440587.5, 5);
  });
});

describe('Solar declination and position', () => {
  it('computes summer solstice declination near +23.44 degrees', () => {
    const summerSolstice = new Date('2024-06-20T20:51:00Z');
    const declination = getSolarDeclination(summerSolstice);
    expect(declination).toBeGreaterThan(23.3);
    expect(declination).toBeLessThan(23.5);
  });

  it('computes winter solstice declination near -23.44 degrees', () => {
    const winterSolstice = new Date('2024-12-21T09:20:00Z');
    const declination = getSolarDeclination(winterSolstice);
    expect(declination).toBeLessThan(-23.3);
    expect(declination).toBeGreaterThan(-23.5);
  });

  it('computes equinox declination near 0 degrees', () => {
    const springEquinox = new Date('2024-03-20T03:06:00Z');
    const declination = getSolarDeclination(springEquinox);
    expect(Math.abs(declination)).toBeLessThan(0.25);
  });

  it('computes equation of time within realistic terrestrial bounds [-17, +17] minutes', () => {
    const testDates = [
      new Date('2026-02-12T12:00:00Z'), // February minimum (~ -14 min)
      new Date('2026-05-15T12:00:00Z'),
      new Date('2026-07-26T12:00:00Z'),
      new Date('2026-11-03T12:00:00Z'), // November peak (~ +16 min)
    ];

    for (const d of testDates) {
      const eot = getEquationOfTime(d);
      expect(eot).toBeGreaterThanOrEqual(-17);
      expect(eot).toBeLessThanOrEqual(17);
    }
  });

  it('places subsolar longitude near 0 at 12:00 UTC and near 180 at 00:00 UTC', () => {
    const noonUtc = new Date('2026-04-15T12:00:00Z'); // EoT is near 0 around mid-April
    const subsolarNoon = getSubsolarPoint(noonUtc);
    expect(Math.abs(subsolarNoon.longitude)).toBeLessThan(5);

    const midnightUtc = new Date('2026-04-15T00:00:00Z');
    const subsolarMidnight = getSubsolarPoint(midnightUtc);
    expect(Math.abs(Math.abs(subsolarMidnight.longitude) - 180)).toBeLessThan(5);
  });

  it('evaluates solar altitude as 90 degrees at the subsolar point', () => {
    const date = new Date('2026-06-21T12:00:00Z');
    const subsolar = getSubsolarPoint(date);
    const altitude = getSolarAltitude(subsolar.latitude, subsolar.longitude, date);
    expect(altitude).toBeCloseTo(90, 3);
  });

  it('evaluates solar altitude as -90 degrees at the antipodal point', () => {
    const date = new Date('2026-06-21T12:00:00Z');
    const subsolar = getSubsolarPoint(date);
    const antipodalLat = -subsolar.latitude;
    let antipodalLon = subsolar.longitude + 180;
    if (antipodalLon > 180) antipodalLon -= 360;

    const altitude = getSolarAltitude(antipodalLat, antipodalLon, date);
    expect(altitude).toBeCloseTo(-90, 3);
  });
});

describe('Coordinate transformations', () => {
  it('round-trips latitude and longitude through 3D vector conversion', () => {
    const testCases: [number, number][] = [
      [0, 0],
      [90, 0],
      [-90, 0],
      [21.4225, 39.8262], // Makkah
      [51.5074, -0.1278], // London
      [-33.8688, 151.2093], // Sydney
      [-6.2088, 106.8456], // Jakarta
    ];

    for (const [lat, lon] of testCases) {
      const [x, y, z] = latLonToVector3(lat, lon);
      const converted = vector3ToLatLon(x, y, z);
      expect(converted.latitude).toBeCloseTo(lat, 4);
      expect(converted.longitude).toBeCloseTo(lon, 4);
    }
  });

  it('computes correct angular distance between antipodal points', () => {
    const dist = angularDistanceDegrees(0, 0, 0, 180);
    expect(dist).toBeCloseTo(180, 4);

    const distPoles = angularDistanceDegrees(90, 0, -90, 0);
    expect(distPoles).toBeCloseTo(180, 4);

    const distQuarter = angularDistanceDegrees(0, 0, 0, 90);
    expect(distQuarter).toBeCloseTo(90, 4);
  });
});
