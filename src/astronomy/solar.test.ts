import { describe, it, expect } from 'vitest';
import { getJulianDay, getJulianCenturies, getJulianDate, J2000_EPOCH } from './julian';
import {
  getSolarDeclination,
  getEquationOfTime,
  getSubsolarPoint,
  getSolarAltitude,
  getSolarAzimuth,
} from './solar';
import {
  latLonToVector3,
  vector3ToLatLon,
  toDisplayCoordinates,
  fromDisplayCoordinates,
  getLocalHourAngle,
  angularDistanceDegrees,
} from './coordinates';

describe('Julian calculations', () => {
  it('computes exact Julian Day for J2000.0 (2000-01-01 12:00:00 UTC)', () => {
    const j2000 = new Date('2000-01-01T12:00:00Z');
    expect(getJulianDay(j2000)).toBeCloseTo(J2000_EPOCH, 5);
    expect(getJulianDate(j2000)).toBeCloseTo(J2000_EPOCH, 5);
    expect(getJulianCenturies(j2000)).toBeCloseTo(0, 5);
  });

  it('computes exact Julian Day for Unix epoch (1970-01-01 00:00:00 UTC)', () => {
    const epoch = new Date('1970-01-01T00:00:00Z');
    expect(getJulianDay(epoch)).toBeCloseTo(2440587.5, 5);
  });

  it('rejects invalid or non-finite dates', () => {
    expect(() => getJulianDay(new Date('invalid'))).toThrow(TypeError);
    expect(() => getJulianDay(null as unknown as Date)).toThrow(TypeError);
    expect(() => getJulianCenturies(new Date(NaN))).toThrow(TypeError);
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

  it('validates input ranges and rejects invalid arguments', () => {
    const validDate = new Date('2026-06-21T12:00:00Z');
    expect(() => getSolarAltitude(95, 0, validDate)).toThrow(RangeError);
    expect(() => getSolarAltitude(-95, 0, validDate)).toThrow(RangeError);
    expect(() => getSolarAltitude(NaN, 0, validDate)).toThrow(TypeError);
    expect(() => getSolarAltitude(0, Infinity, validDate)).toThrow(TypeError);
    expect(() => getSolarAltitude(0, 0, new Date('invalid'))).toThrow(TypeError);

    expect(() => getSolarAzimuth(95, 0, validDate)).toThrow(RangeError);
    expect(() => getSolarAzimuth(0, 0, new Date('invalid'))).toThrow(TypeError);
  });

  it('evaluates solar azimuth progression correctly across morning, noon, and afternoon', () => {
    // Observer at lat 30 N, lon 0 on equinox (2026-03-20)
    // Local solar noon is near 12:07 UTC
    const morning = new Date('2026-03-20T08:00:00Z');
    const noon = new Date('2026-03-20T12:07:00Z');
    const afternoon = new Date('2026-03-20T16:00:00Z');

    const azMorning = getSolarAzimuth(30, 0, morning);
    const azNoon = getSolarAzimuth(30, 0, noon);
    const azAfternoon = getSolarAzimuth(30, 0, afternoon);

    // Morning Sun is in the East/South-East (azimuth between 90 and 150 deg)
    expect(azMorning).toBeGreaterThan(80);
    expect(azMorning).toBeLessThan(150);

    // Noon Sun culminates due South (azimuth near 180 deg)
    expect(azNoon).toBeCloseTo(180, 0);

    // Afternoon Sun is in the West/South-West (azimuth between 210 and 280 deg)
    expect(azAfternoon).toBeGreaterThan(210);
    expect(azAfternoon).toBeLessThan(280);
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

      // Verify toDisplayCoordinates and fromDisplayCoordinates aliases
      const [dx, dy, dz] = toDisplayCoordinates(lat, lon);
      expect(dx).toBe(x);
      expect(dy).toBe(y);
      expect(dz).toBe(z);
      const dConverted = fromDisplayCoordinates(dx, dy, dz);
      expect(dConverted.latitude).toBeCloseTo(lat, 4);
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

  it('validates input ranges on coordinate converters', () => {
    expect(() => latLonToVector3(NaN, 0)).toThrow(TypeError);
    expect(() => latLonToVector3(0, NaN)).toThrow(TypeError);
    expect(() => latLonToVector3(0, 0, Infinity)).toThrow(TypeError);
    expect(() => vector3ToLatLon(NaN, 0, 0)).toThrow(TypeError);
  });

  it('computes local hour angle with correct sign conventions', () => {
    // Observer West of Sun (e.g. observerLon = 0, subsolarLon = 30) -> H = -30 (morning)
    expect(getLocalHourAngle(0, 30)).toBeCloseTo(-30, 4);

    // Observer East of Sun (e.g. observerLon = 45, subsolarLon = 10) -> H = +35 (afternoon)
    expect(getLocalHourAngle(45, 10)).toBeCloseTo(35, 4);

    // Antimeridian wrap: observer at 170 E, subsolar at -170 W (diff = 340 => -20)
    expect(getLocalHourAngle(170, -170)).toBeCloseTo(-20, 4);

    // Subsolar at same longitude -> H = 0 (solar noon)
    expect(getLocalHourAngle(50, 50)).toBeCloseTo(0, 4);

    expect(() => getLocalHourAngle(NaN, 0)).toThrow(TypeError);
    expect(() => getLocalHourAngle(0, NaN)).toThrow(TypeError);
  });
});

