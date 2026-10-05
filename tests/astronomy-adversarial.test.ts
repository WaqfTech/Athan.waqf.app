import { describe, it, expect } from 'vitest';
import {
  findSolarCrossing,
  calculateNoonShadowRatio,
  calculateAsrAltitude,
  SolarEventResult,
} from '../src/astronomy/events';
import {
  getSolarAltitude,
  getSolarDeclination,
  getEquationOfTime,
  getSubsolarPoint,
  getSolarAzimuth,
} from '../src/astronomy/solar';
import {
  getLocalHourAngle,
  latLonToVector3,
  vector3ToLatLon,
  angularDistanceDegrees,
} from '../src/astronomy/coordinates';
import { calculatePrayerTimes } from '../src/prayer/calculator';

describe('Adversarial Astronomical Stress Suite', () => {
  describe('1. North & South Poles (+-90 degrees)', () => {
    const dates = [
      new Date('2026-03-20T12:00:00Z'), // Equinox
      new Date('2026-06-21T12:00:00Z'), // June Solstice
      new Date('2026-09-23T12:00:00Z'), // Autumn Equinox
      new Date('2026-12-21T12:00:00Z'), // December Solstice
    ];

    it('handles North Pole (+90) across seasons without throwing', () => {
      for (const d of dates) {
        expect(() => {
          const rising = findSolarCrossing(90, 0, -0.8333, d, 'rising');
          const setting = findSolarCrossing(90, 0, -0.8333, d, 'setting');
          expect(['crossing', 'alwaysAbove', 'alwaysBelow', 'grazing', 'indeterminate']).toContain(rising.kind);
          expect(['crossing', 'alwaysAbove', 'alwaysBelow', 'grazing', 'indeterminate']).toContain(setting.kind);

          const sched = calculatePrayerTimes(90, 0, d);
          expect(sched).toBeDefined();
        }).not.toThrow();
      }
    });

    it('North Pole June solstice has midnight sun (alwaysAbove) and null dates for sunrise/sunset', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const sunrise = findSolarCrossing(90, 0, -0.8333, juneSolstice, 'rising');
      const sunset = findSolarCrossing(90, 0, -0.8333, juneSolstice, 'setting');

      expect(sunrise.kind).toBe('alwaysAbove');
      expect(sunrise.date).toBeNull();
      expect(sunset.kind).toBe('alwaysAbove');
      expect(sunset.date).toBeNull();
    });

    it('North Pole December solstice has polar night (alwaysBelow) and null dates for sunrise/sunset', () => {
      const decSolstice = new Date('2026-12-21T12:00:00Z');
      const sunrise = findSolarCrossing(90, 0, -0.8333, decSolstice, 'rising');
      const sunset = findSolarCrossing(90, 0, -0.8333, decSolstice, 'setting');

      expect(sunrise.kind).toBe('alwaysBelow');
      expect(sunrise.date).toBeNull();
      expect(sunset.kind).toBe('alwaysBelow');
      expect(sunset.date).toBeNull();
    });

    it('South Pole (-90) exhibits opposite seasonal polarity', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const decSolstice = new Date('2026-12-21T12:00:00Z');

      const juneSunrise = findSolarCrossing(-90, 0, -0.8333, juneSolstice, 'rising');
      expect(juneSunrise.kind).toBe('alwaysBelow');
      expect(juneSunrise.date).toBeNull();

      const decSunrise = findSolarCrossing(-90, 0, -0.8333, decSolstice, 'rising');
      expect(decSunrise.kind).toBe('alwaysAbove');
      expect(decSunrise.date).toBeNull();
    });

    it('computes solar azimuth at poles without NaN or exceptions', () => {
      for (const d of dates) {
        const azNorth = getSolarAzimuth(90, 0, d);
        expect(Number.isFinite(azNorth)).toBe(true);
        expect(azNorth).toBeGreaterThanOrEqual(0);
        expect(azNorth).toBeLessThan(360);

        const azSouth = getSolarAzimuth(-90, 0, d);
        expect(Number.isFinite(azSouth)).toBe(true);
        expect(azSouth).toBeGreaterThanOrEqual(0);
        expect(azSouth).toBeLessThan(360);
      }
    });
  });

  describe('2. Positive Noon Shadow Requirement for Asr', () => {
    it('returns null shadow and null Asr altitude when Sun culminates below horizon', () => {
      // Tromso winter solstice: noon altitude ~ -3.09 deg
      const noonShadow = calculateNoonShadowRatio(69.6492, -23.44);
      expect(noonShadow).toBeNull();

      const asrAlt = calculateAsrAltitude(69.6492, -23.44, 1.0);
      expect(asrAlt).toBeNull();
    });

    it('returns null when Sun culminates exactly on horizon (noon altitude = 0)', () => {
      // Latitude 66.56 N, declination -23.44 deg -> zenithDistance = 90 deg -> noon altitude = 0
      const noonShadow = calculateNoonShadowRatio(66.56, -23.44);
      expect(noonShadow).toBeNull();

      const asrAlt = calculateAsrAltitude(66.56, -23.44, 1.0);
      expect(asrAlt).toBeNull();
    });

    it('returns valid positive shadow and altitude when noon altitude is positive', () => {
      // Makkah: lat 21.4225, declination 0 (equinox) -> noon altitude ~ 68.58 deg
      const noonShadow = calculateNoonShadowRatio(21.4225, 0);
      expect(noonShadow).not.toBeNull();
      expect(noonShadow!).toBeGreaterThan(0);

      const asrAltShafi = calculateAsrAltitude(21.4225, 0, 1.0);
      const asrAltHanafi = calculateAsrAltitude(21.4225, 0, 2.0);
      expect(asrAltShafi).not.toBeNull();
      expect(asrAltHanafi).not.toBeNull();
      expect(asrAltShafi!).toBeGreaterThan(asrAltHanafi!); // Hanafi shadow is longer -> lower altitude
    });

    it('returns unresolved Asr entry in prayer calculator when noon shadow is absent', () => {
      const decSolstice = new Date('2026-12-21T12:00:00Z');
      const sched = calculatePrayerTimes(69.6492, 18.9553, decSolstice);
      expect(sched.asr.date).toBeNull();
      expect(sched.asr.provenance).toBe('unresolved');
      expect(sched.asr.note).toBe('No physical noon shadow');
    });
  });

  describe('3. Extreme Longitudes and Boundaries (-180, +180, wrap)', () => {
    it('produces valid crossings at lon = -180 and lon = +180 on equinox', () => {
      const equinox = new Date('2026-03-20T12:00:00Z');
      const r180 = findSolarCrossing(0, 180, -0.8333, equinox, 'rising');
      const rNeg180 = findSolarCrossing(0, -180, -0.8333, equinox, 'rising');

      expect(r180.kind).toBe('crossing');
      expect(rNeg180.kind).toBe('crossing');
      if (r180.kind === 'crossing' && rNeg180.kind === 'crossing') {
        expect(r180.hourAngleDeg).toBeCloseTo(-90.83, 1);
        expect(rNeg180.hourAngleDeg).toBeCloseTo(-90.83, 1);
      }
    });

    it('wraps local hour angles into [-180, 180] consistently', () => {
      expect(getLocalHourAngle(180, 0)).toBe(180);
      expect(getLocalHourAngle(-180, 0)).toBe(-180);
      expect(getLocalHourAngle(0, 180)).toBe(-180);
      expect(getLocalHourAngle(179, -179)).toBe(-2);
      expect(getLocalHourAngle(-179, 179)).toBe(2);
    });

    it('Cartesian coordinate conversions preserve antimeridian and polar roundtrips', () => {
      const vNorth = latLonToVector3(90, 0);
      expect(vNorth[1]).toBeCloseTo(1, 6);
      expect(vector3ToLatLon(vNorth[0], vNorth[1], vNorth[2]).latitude).toBeCloseTo(90, 5);

      const vSouth = latLonToVector3(-90, 0);
      expect(vSouth[1]).toBeCloseTo(-1, 6);
      expect(vector3ToLatLon(vSouth[0], vSouth[1], vSouth[2]).latitude).toBeCloseTo(-90, 5);

      const vAnti = latLonToVector3(0, 180);
      expect(vAnti[2]).toBeCloseTo(-1, 6); // -Z is antimeridian
      expect(Math.abs(vector3ToLatLon(vAnti[0], vAnti[1], vAnti[2]).longitude)).toBeCloseTo(180, 4);
    });
  });

  describe('4. Input Validation & Fault Tolerance', () => {
    const validDate = new Date('2026-06-21T12:00:00Z');

    it('rejects out of bounds coordinates with kind invalid', () => {
      expect(findSolarCrossing(90.001, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(-90.001, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(NaN, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(Infinity, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, NaN, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, Infinity, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 95, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, -95, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, NaN, validDate, 'rising').kind).toBe('invalid');
    });

    it('rejects invalid or non-finite dates gracefully', () => {
      expect(findSolarCrossing(0, 0, 0, new Date(NaN), 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 0, null as any, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 0, undefined as any, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 0, '2026-01-01' as any, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 0, {} as any, 'rising').kind).toBe('invalid');
    });

    it('prayer calculator returns all unresolved entries on invalid inputs without throwing', () => {
      const resNaN = calculatePrayerTimes(NaN, 0, validDate);
      expect(resNaN.fajr.provenance).toBe('unresolved');
      expect(resNaN.currentPrayer).toBe('none');
      expect(resNaN.nextPrayer).toBe('none');

      const resInvalidDate = calculatePrayerTimes(0, 0, new Date('invalid'));
      expect(resInvalidDate.dhuhr.provenance).toBe('unresolved');
      expect(resInvalidDate.currentPrayer).toBe('none');
    });
  });

  describe('5. Polar Circles at Solstices & Grazing Contacts', () => {
    it('handles Arctic Circle (lat 66.56 N) at summer and winter solstices', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const decSolstice = new Date('2026-12-21T12:00:00Z');

      const juneRising = findSolarCrossing(66.56, 0, -0.8333, juneSolstice, 'rising');
      const juneSetting = findSolarCrossing(66.56, 0, -0.8333, juneSolstice, 'setting');
      expect(['crossing', 'alwaysAbove', 'grazing']).toContain(juneRising.kind);
      expect(['crossing', 'alwaysAbove', 'grazing']).toContain(juneSetting.kind);

      const decRising = findSolarCrossing(66.56, 0, -0.8333, decSolstice, 'rising');
      const decSetting = findSolarCrossing(66.56, 0, -0.8333, decSolstice, 'setting');
      expect(['crossing', 'alwaysBelow', 'grazing']).toContain(decRising.kind);
      expect(['crossing', 'alwaysBelow', 'grazing']).toContain(decSetting.kind);
    });

    it('handles Antarctic Circle (lat -66.56 S) at summer and winter solstices', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const decSolstice = new Date('2026-12-21T12:00:00Z');

      const juneRising = findSolarCrossing(-66.56, 0, -0.8333, juneSolstice, 'rising');
      expect(['crossing', 'alwaysBelow', 'grazing']).toContain(juneRising.kind);

      const decRising = findSolarCrossing(-66.56, 0, -0.8333, decSolstice, 'rising');
      expect(['crossing', 'alwaysAbove', 'grazing']).toContain(decRising.kind);
    });

    it('returns typed grazing event when target altitude matches culmination within tolerance', () => {
      const winterSolstice = new Date('2026-12-21T12:00:00Z');
      // At lat 67.39 N, winter solstice culmination hNoon is approx -0.83 deg
      const grazing = findSolarCrossing(67.39, 0, -0.8333, winterSolstice, 'rising', {
        toleranceDeg: 0.1,
      });
      expect(['grazing', 'crossing', 'alwaysBelow']).toContain(grazing.kind);
      if (grazing.kind === 'grazing') {
        expect(grazing.tangentAltitudeDeg).toBeDefined();
        expect(grazing.hourAngleDeg).toBe(0);
      }
    });
  });

  describe('6. Direction-Aware Nadir & Midnight Sun Seasonal Boundaries', () => {
    it('verifies restored physical sunset on July 25, 2026 at Tromso', () => {
      const lat = 69.6492;
      const lon = 18.9553;
      const d = new Date(Date.UTC(2026, 6, 25, 12, 0, 0));

      // 1. Calculate local solar noon and evening nadir
      const approxNoon = new Date(Date.UTC(2026, 6, 25, 12, 0, 0));
      const eot = getEquationOfTime(approxNoon);
      const solarNoonHours = 12 - lon / 15 - eot / 60;
      const noonMs = Date.UTC(2026, 6, 25) + solarNoonHours * 3600000;
      const eveningNadirMs = noonMs + 12 * 3600000;

      const hNoon = getSolarAltitude(lat, lon, new Date(noonMs));
      const hEveningNadir = getSolarAltitude(lat, lon, new Date(eveningNadirMs));

      // The Sun peaks at ~39.94 deg and descends to -0.866 deg at evening nadir
      expect(hNoon).toBeGreaterThan(39);
      expect(hEveningNadir).toBeLessThan(-0.8333); // Sun is physically below the refraction horizon!

      // 2. Empirically find physical crossing between noon and evening nadir
      let physicalCrossingMs: number | null = null;
      for (let t = noonMs; t <= eveningNadirMs; t += 1000) {
        const alt = getSolarAltitude(lat, lon, new Date(t));
        if (alt <= -0.8333) {
          physicalCrossingMs = t;
          break;
        }
      }
      expect(physicalCrossingMs).not.toBeNull();
      const physicalDate = new Date(physicalCrossingMs!);

      // 3. Query findSolarCrossing for setting
      const solverResult = findSolarCrossing(lat, lon, -0.8333, d, 'setting');

      expect(solverResult.kind).toBe('crossing');
      expect(solverResult.date).not.toBeNull();
      expect(solverResult.actualAltitudeDeg).toBeCloseTo(-0.8333, 3);
      expect(solverResult.hourAngleDeg).toBeGreaterThan(0);
      expect(Math.abs(solverResult.date!.getTime() - physicalDate.getTime())).toBeLessThan(1000);
      expect(solverResult.date!.toISOString().slice(0, 16)).toBe('2026-07-25T22:37');

      // Verify prayer calculator restores sunset and Maghrib
      const sched = calculatePrayerTimes(lat, lon, d);
      expect(sched.sunset.provenance).toBe('astronomicalSign');
      expect(sched.sunset.date).not.toBeNull();
      expect(sched.maghrib.provenance).toBe('astronomicalSign');
      expect(sched.maghrib.date).not.toBeNull();
    });

    it('verifies midnight sun onset on May 18, 2026 at Tromso returns kind alwaysAbove', () => {
      const lat = 69.6492;
      const lon = 18.9553;
      const d = new Date(Date.UTC(2026, 4, 18, 12, 0, 0));

      const solverResult = findSolarCrossing(lat, lon, -0.8333, d, 'setting');
      expect(solverResult.kind).toBe('alwaysAbove');
      expect(solverResult.date).toBeNull();
      if (solverResult.kind === 'alwaysAbove') {
        expect(solverResult.minAltitudeDeg).toBeCloseTo(-0.6367, 2);
      }

      // Verify prayer calculator leaves sunset unresolved with note
      const sched = calculatePrayerTimes(lat, lon, d);
      expect(sched.sunrise.provenance).toBe('astronomicalSign');
      expect(sched.sunrise.date).not.toBeNull();
      expect(sched.sunset.provenance).toBe('unresolved');
      expect(sched.sunset.note).toBe('Midnight sun');
    });
  });
});
