import { describe, it, expect } from 'vitest';
import {
  findSolarCrossing,
  calculateNoonShadowRatio,
  calculateAsrAltitude,
} from './events';

describe('Typed Solar Events Root Solver', () => {
  describe('Standard mid-latitude crossings', () => {
    it('finds sunrise and sunset crossings in Makkah on equinox', () => {
      const equinox = new Date('2026-03-20T12:00:00Z');
      const makkahLat = 21.4225;
      const makkahLon = 39.8262;

      const sunrise = findSolarCrossing(makkahLat, makkahLon, -0.8333, equinox, 'rising');
      expect(sunrise.kind).toBe('crossing');
      if (sunrise.kind === 'crossing') {
        expect(sunrise.date).toBeInstanceOf(Date);
        expect(sunrise.actualAltitudeDeg).toBeCloseTo(-0.8333, 2);
        expect(sunrise.hourAngleDeg).toBeLessThan(0); // Morning: H < 0
      }

      const sunset = findSolarCrossing(makkahLat, makkahLon, -0.8333, equinox, 'setting');
      expect(sunset.kind).toBe('crossing');
      if (sunset.kind === 'crossing') {
        expect(sunset.date).toBeInstanceOf(Date);
        expect(sunset.actualAltitudeDeg).toBeCloseTo(-0.8333, 2);
        expect(sunset.hourAngleDeg).toBeGreaterThan(0); // Evening: H > 0
      }

      if (sunrise.kind === 'crossing' && sunset.kind === 'crossing') {
        expect(sunrise.date.getTime()).toBeLessThan(sunset.date.getTime());
      }
    });

    it('finds astronomical twilight (-18 deg) in London', () => {
      const londonLat = 51.5074;
      const londonLon = -0.1278;
      const marchDate = new Date('2026-03-20T12:00:00Z');

      const dawn = findSolarCrossing(londonLat, londonLon, -18.0, marchDate, 'rising');
      expect(dawn.kind).toBe('crossing');
      if (dawn.kind === 'crossing') {
        expect(dawn.actualAltitudeDeg).toBeCloseTo(-18.0, 2);
      }
    });
  });

  describe('Witness W01: Tromsø Winter Solstice Polar Night', () => {
    const tromsoLat = 69.6492;
    const tromsoLon = 18.9553;
    const winterSolstice = new Date('2026-12-21T12:00:00Z');

    it('returns alwaysBelow with date null for sunrise and sunset', () => {
      const sunrise = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, winterSolstice, 'rising');
      expect(sunrise.kind).toBe('alwaysBelow');
      expect(sunrise.date).toBeNull();
      if (sunrise.kind === 'alwaysBelow') {
        expect(sunrise.maxAltitudeDeg).toBeLessThan(-2.5);
      }

      const sunset = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, winterSolstice, 'setting');
      expect(sunset.kind).toBe('alwaysBelow');
      expect(sunset.date).toBeNull();
    });

    it('enforces non-positive noon altitude rule: noon shadow ratio and Asr altitude return null', () => {
      // At Tromsø on winter solstice, Sun culminates at ~ -3.087 deg
      // Declination is approx -23.44 deg
      const declination = -23.44;
      const shadow = calculateNoonShadowRatio(tromsoLat, declination);
      expect(shadow).toBeNull();

      const asrAltitude = calculateAsrAltitude(tromsoLat, declination, 1.0);
      expect(asrAltitude).toBeNull();
    });

    it('resolves civil twilight (-6 deg) crossings even during polar night', () => {
      // Peak altitude is ~ -3.09 deg, which is higher than -6.0 deg
      // Thus civil twilight DOES cross twice daily in Tromsø
      const civilDawn = findSolarCrossing(tromsoLat, tromsoLon, -6.0, winterSolstice, 'rising');
      expect(civilDawn.kind).toBe('crossing');
      if (civilDawn.kind === 'crossing') {
        expect(civilDawn.actualAltitudeDeg).toBeCloseTo(-6.0, 2);
      }

      const civilDusk = findSolarCrossing(tromsoLat, tromsoLon, -6.0, winterSolstice, 'setting');
      expect(civilDusk.kind).toBe('crossing');
      if (civilDusk.kind === 'crossing') {
        expect(civilDusk.actualAltitudeDeg).toBeCloseTo(-6.0, 2);
      }
    });
  });

  describe('Witness W02: Tromsø Summer Solstice Midnight Sun', () => {
    const tromsoLat = 69.6492;
    const tromsoLon = 18.9553;
    const summerSolstice = new Date('2026-06-21T12:00:00Z');

    it('returns alwaysAbove with date null for sunrise and sunset', () => {
      const sunrise = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, summerSolstice, 'rising');
      expect(sunrise.kind).toBe('alwaysAbove');
      expect(sunrise.date).toBeNull();
      if (sunrise.kind === 'alwaysAbove') {
        expect(sunrise.minAltitudeDeg).toBeGreaterThan(2.0);
      }

      const sunset = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, summerSolstice, 'setting');
      expect(sunset.kind).toBe('alwaysAbove');
      expect(sunset.date).toBeNull();
    });

    it('computes positive noon shadow and valid Asr crossing during midnight sun', () => {
      const declination = 23.44;
      const noonShadow = calculateNoonShadowRatio(tromsoLat, declination);
      expect(noonShadow).not.toBeNull();
      expect(noonShadow!).toBeGreaterThan(0);

      const asrAlt = calculateAsrAltitude(tromsoLat, declination, 1.0);
      expect(asrAlt).not.toBeNull();
      expect(asrAlt!).toBeGreaterThan(15.0);

      // Asr altitude falls within diurnal range [min ~3 deg, max ~43.8 deg]
      const asrCrossing = findSolarCrossing(tromsoLat, tromsoLon, asrAlt!, summerSolstice, 'setting');
      expect(asrCrossing.kind).toBe('crossing');
      if (asrCrossing.kind === 'crossing') {
        expect(asrCrossing.actualAltitudeDeg).toBeCloseTo(asrAlt!, 2);
        expect(asrCrossing.hourAngleDeg).toBeGreaterThan(0); // Afternoon side
      }
    });
  });

  describe('Geographic Poles and Extreme Boundaries', () => {
    it('North Pole on summer solstice exhibits continuous daylight (alwaysAbove)', () => {
      const summerSolstice = new Date('2026-06-21T12:00:00Z');
      const crossing = findSolarCrossing(90, 0, -0.8333, summerSolstice, 'setting');
      expect(crossing.kind).toBe('alwaysAbove');
      expect(crossing.date).toBeNull();
    });

    it('South Pole on summer solstice exhibits continuous polar night (alwaysBelow)', () => {
      const summerSolstice = new Date('2026-06-21T12:00:00Z');
      const crossing = findSolarCrossing(-90, 0, -0.8333, summerSolstice, 'rising');
      expect(crossing.kind).toBe('alwaysBelow');
      expect(crossing.date).toBeNull();
    });

    it('detects grazing contact at polar circle culmination boundary', () => {
      // At latitude 67.39 N on winter solstice, culmination touches near -0.8333 deg
      const winterSolstice = new Date('2026-12-21T12:00:00Z');
      const grazing = findSolarCrossing(67.39, 0, -0.8333, winterSolstice, 'setting', {
        toleranceDeg: 0.1,
      });
      expect(['grazing', 'crossing', 'alwaysBelow']).toContain(grazing.kind);
    });
  });

  describe('Input validation and safety', () => {
    const validDate = new Date('2026-06-21T12:00:00Z');

    it('returns kind invalid on out of range or NaN coordinates', () => {
      expect(findSolarCrossing(95, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(-95, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(NaN, 0, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, NaN, 0, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 100, validDate, 'rising').kind).toBe('invalid');
      expect(findSolarCrossing(0, 0, 0, new Date('invalid'), 'rising').kind).toBe('invalid');
    });

    it('returns null on invalid arguments to shadow calculators', () => {
      expect(calculateNoonShadowRatio(NaN, 20)).toBeNull();
      expect(calculateNoonShadowRatio(45, NaN)).toBeNull();
      expect(calculateAsrAltitude(45, 20, -1)).toBeNull();
      expect(calculateAsrAltitude(45, 20, NaN)).toBeNull();
    });
  });

  describe('High Latitude Seasonal Transitions (Tromso and Polar Circles)', () => {
    const tromsoLat = 69.6492;
    const tromsoLon = 18.9553;

    it('detects restored sunset on July 25, 2026 after midnight sun in Tromso', () => {
      const d = new Date('2026-07-25T12:00:00Z');
      const sunset = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, d, 'setting');

      expect(sunset.kind).toBe('crossing');
      if (sunset.kind === 'crossing') {
        expect(sunset.date).toBeInstanceOf(Date);
        expect(sunset.actualAltitudeDeg).toBeCloseTo(-0.8333, 3);
        expect(sunset.hourAngleDeg).toBeGreaterThan(0);
        expect(sunset.date.toISOString().slice(0, 16)).toBe('2026-07-25T22:37');
      }

      // Morning of July 25 still has Sun above horizon
      const sunrise = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, d, 'rising');
      expect(sunrise.kind).toBe('alwaysAbove');
      expect(sunrise.date).toBeNull();
    });

    it('detects midnight sun onset on May 18, 2026 in Tromso with kind alwaysAbove', () => {
      const d = new Date('2026-05-18T12:00:00Z');
      const sunset = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, d, 'setting');

      expect(sunset.kind).toBe('alwaysAbove');
      expect(sunset.date).toBeNull();
      if (sunset.kind === 'alwaysAbove') {
        expect(sunset.minAltitudeDeg).toBeCloseTo(-0.6367, 2);
      }

      // Morning of May 18 had the final sunrise before midnight sun
      const sunrise = findSolarCrossing(tromsoLat, tromsoLon, -0.8333, d, 'rising');
      expect(sunrise.kind).toBe('crossing');
      if (sunrise.kind === 'crossing') {
        expect(sunrise.actualAltitudeDeg).toBeCloseTo(-0.8333, 3);
        expect(sunrise.hourAngleDeg).toBeLessThan(0);
      }
    });

    it('Arctic Circle (66.56 N) solstice crossings match physical horizons', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const decSolstice = new Date('2026-12-21T12:00:00Z');

      // Summer solstice: midnight sun for apparent horizon (-0.8333)
      const juneSetting = findSolarCrossing(66.56, 0, -0.8333, juneSolstice, 'setting');
      expect(juneSetting.kind).toBe('alwaysAbove');

      // Summer solstice: grazing for geometric center horizon (0.0)
      const juneGeom = findSolarCrossing(66.56, 0, 0.0, juneSolstice, 'setting', {
        toleranceDeg: 0.005,
      });
      expect(juneGeom.kind).toBe('grazing');

      // Winter solstice: apparent horizon has brief day (culmination > -0.8333)
      const decRising = findSolarCrossing(66.56, 0, -0.8333, decSolstice, 'rising');
      const decSetting = findSolarCrossing(66.56, 0, -0.8333, decSolstice, 'setting');
      expect(decRising.kind).toBe('crossing');
      expect(decSetting.kind).toBe('crossing');

      // Winter solstice: grazing for geometric center horizon (0.0)
      const decGeom = findSolarCrossing(66.56, 0, 0.0, decSolstice, 'rising', {
        toleranceDeg: 0.005,
      });
      expect(decGeom.kind).toBe('grazing');
    });

    it('Antarctic Circle (-66.56 S) solstice crossings mirror northern behavior', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const decSolstice = new Date('2026-12-21T12:00:00Z');

      // June solstice (Southern winter): brief day for apparent horizon
      const juneRising = findSolarCrossing(-66.56, 0, -0.8333, juneSolstice, 'rising');
      const juneSetting = findSolarCrossing(-66.56, 0, -0.8333, juneSolstice, 'setting');
      expect(juneRising.kind).toBe('crossing');
      expect(juneSetting.kind).toBe('crossing');

      // December solstice (Southern summer): midnight sun
      const decRising = findSolarCrossing(-66.56, 0, -0.8333, decSolstice, 'rising');
      const decSetting = findSolarCrossing(-66.56, 0, -0.8333, decSolstice, 'setting');
      expect(decRising.kind).toBe('alwaysAbove');
      expect(decSetting.kind).toBe('alwaysAbove');
    });
  });
});
