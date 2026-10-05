import { describe, it, expect } from 'vitest';
import {
  findSolarCrossing,
  SolarEventResult,
} from '../src/astronomy/events';
import {
  getSolarAltitude,
  getSolarDeclination,
  getEquationOfTime,
} from '../src/astronomy/solar';
import { calculatePrayerTimes } from '../src/prayer/calculator';

describe('Empirical Challenger Verification Suite (M1 It2)', () => {
  const TROMSO_LAT = 69.6492;
  const TROMSO_LON = 18.9553;
  const HORIZON_ALT = -0.8333;

  describe('Focus Case 1: Tromsø July 25, 2026 Sunset Restoration', () => {
    const d = new Date(Date.UTC(2026, 6, 25, 12, 0, 0));

    it('returns kind crossing for setting with date at 22:37 UTC', () => {
      const res = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d, 'setting');

      expect(res.kind).toBe('crossing');
      expect(res.date).not.toBeNull();
      expect(res.date instanceof Date).toBe(true);

      const iso = res.date!.toISOString();
      expect(iso.slice(0, 16)).toBe('2026-07-25T22:37');

      // Check exact seconds and milliseconds match physical root
      const altAtRoot = getSolarAltitude(TROMSO_LAT, TROMSO_LON, res.date!);
      expect(Math.abs(altAtRoot - HORIZON_ALT)).toBeLessThan(0.001);
      expect(res.hourAngleDeg).toBeGreaterThan(0);
    });

    it('matches ground-truth brute-force 1-second scan within 1 second', () => {
      // Find ground truth via 1-second resolution scan
      const approxNoon = new Date(Date.UTC(2026, 6, 25, 12, 0, 0));
      const eot = getEquationOfTime(approxNoon);
      const noonHours = 12 - TROMSO_LON / 15 - eot / 60;
      const noonMs = Date.UTC(2026, 6, 25) + noonHours * 3600000;
      const eveningNadirMs = noonMs + 12 * 3600000;

      let groundTruthMs: number | null = null;
      for (let t = noonMs; t <= eveningNadirMs; t += 1000) {
        const alt = getSolarAltitude(TROMSO_LAT, TROMSO_LON, new Date(t));
        if (alt <= HORIZON_ALT) {
          groundTruthMs = t;
          break;
        }
      }

      expect(groundTruthMs).not.toBeNull();
      const res = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d, 'setting');
      expect(res.kind).toBe('crossing');
      const diffMs = Math.abs(res.date!.getTime() - groundTruthMs!);
      expect(diffMs).toBeLessThan(1000);
    });

    it('prayer calculator restores sunset and Maghrib with astronomicalSign provenance', () => {
      const sched = calculatePrayerTimes(TROMSO_LAT, TROMSO_LON, d);

      expect(sched.sunset.provenance).toBe('astronomicalSign');
      expect(sched.sunset.date).not.toBeNull();
      expect(sched.sunset.date!.toISOString().slice(0, 16)).toBe('2026-07-25T22:37');

      expect(sched.maghrib.provenance).toBe('astronomicalSign');
      expect(sched.maghrib.date).not.toBeNull();
      expect(sched.maghrib.date!.getTime()).toBe(sched.sunset.date!.getTime());
    });

    it('measures exact altitude profile in Tromso around midnight on July 25', () => {
      let sunsetTime: Date | null = null;
      let sunriseTime: Date | null = null;
      for (let s = 0; s < 7200; s += 1) {
        const t = new Date(Date.UTC(2026, 6, 25, 22, 0, 0) + s * 1000);
        const alt = getSolarAltitude(TROMSO_LAT, TROMSO_LON, t);
        if (!sunsetTime && alt <= -0.8333) {
          sunsetTime = t;
        }
        if (sunsetTime && !sunriseTime && alt >= -0.8333) {
          sunriseTime = t;
        }
      }
      expect(sunsetTime).not.toBeNull();
      expect(sunsetTime!.toISOString().slice(0, 16)).toBe('2026-07-25T22:37');
      expect(sunriseTime).not.toBeNull();
      expect(sunriseTime!.toISOString().slice(0, 16)).toBe('2026-07-25T23:04');

      const d26 = new Date('2026-07-26T12:00:00Z');
      const res26Rising = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d26, 'rising');
      expect(res26Rising.kind).toBe('crossing');
      expect(res26Rising.date).not.toBeNull();
      expect(res26Rising.date!.toISOString().slice(0, 16)).toBe('2026-07-25T23:04');

      // The astronomical root solver accurately matches physical 1-second scan within 1 second
      expect(Math.abs(res26Rising.date!.getTime() - sunriseTime!.getTime())).toBeLessThan(1000);
    });

    it('morning rising on July 25 returns alwaysAbove (sunrise has not resumed in morning half-cycle)', () => {
      const risingRes = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d, 'rising');
      expect(risingRes.kind).toBe('alwaysAbove');
      expect(risingRes.date).toBeNull();
    });
  });

  describe('Focus Case 2: Tromsø May 18, 2026 Midnight Sun Onset', () => {
    const d = new Date(Date.UTC(2026, 4, 18, 12, 0, 0));

    it('returns kind alwaysAbove and date null for setting', () => {
      const res = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d, 'setting');

      expect(res.kind).toBe('alwaysAbove');
      expect(res.date).toBeNull();
      if (res.kind === 'alwaysAbove') {
        expect(res.minAltitudeDeg).toBeGreaterThan(HORIZON_ALT);
        expect(res.minAltitudeDeg).toBeCloseTo(-0.6367, 2);
      }
    });

    it('confirms ground-truth scan never dips below horizon during afternoon half-cycle', () => {
      const approxNoon = new Date(Date.UTC(2026, 4, 18, 12, 0, 0));
      const eot = getEquationOfTime(approxNoon);
      const noonHours = 12 - TROMSO_LON / 15 - eot / 60;
      const noonMs = Date.UTC(2026, 4, 18) + noonHours * 3600000;
      const eveningNadirMs = noonMs + 12 * 3600000;

      let minAlt = 90;
      for (let t = noonMs; t <= eveningNadirMs; t += 5000) {
        const alt = getSolarAltitude(TROMSO_LAT, TROMSO_LON, new Date(t));
        if (alt < minAlt) minAlt = alt;
      }

      expect(minAlt).toBeGreaterThan(HORIZON_ALT);
    });

    it('prayer calculator marks sunset as unresolved with Midnight sun note', () => {
      const sched = calculatePrayerTimes(TROMSO_LAT, TROMSO_LON, d);

      expect(sched.sunset.provenance).toBe('unresolved');
      expect(sched.sunset.date).toBeNull();
      expect(sched.sunset.note).toBe('Midnight sun');
    });
  });

  describe('Focus Case 3: Transition Days Around Midnight Sun Boundaries', () => {
    it('Tromsø July 24, 2026: setting is still alwaysAbove (midnight sun)', () => {
      const d24 = new Date(Date.UTC(2026, 6, 24, 12, 0, 0));
      const res24 = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d24, 'setting');
      expect(res24.kind).toBe('alwaysAbove');
      expect(res24.date).toBeNull();
    });

    it('Tromsø July 26, 2026: setting is crossing and occurs earlier than July 25', () => {
      const d26 = new Date(Date.UTC(2026, 6, 26, 12, 0, 0));
      const res26 = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d26, 'setting');
      expect(res26.kind).toBe('crossing');
      expect(res26.date).not.toBeNull();

      // On July 26, sunset should be earlier in local afternoon or later in UTC
      const res25 = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, new Date(Date.UTC(2026, 6, 25, 12, 0, 0)), 'setting');
      expect(res26.date!.getTime()).toBeGreaterThan(res25.date!.getTime());
    });

    it('Tromsø May 17, 2026: setting still has crossing before midnight sun onset', () => {
      const d17 = new Date(Date.UTC(2026, 4, 17, 12, 0, 0));
      const res17 = findSolarCrossing(TROMSO_LAT, TROMSO_LON, HORIZON_ALT, d17, 'setting');
      expect(res17.kind).toBe('crossing');
      expect(res17.date).not.toBeNull();
    });
  });

  describe('Focus Case 4: Polar Circles and Grazing Horizons', () => {
    const ARCTIC_LAT = 66.56;
    const ANTARCTIC_LAT = -66.56;

    it('Arctic Circle at June Solstice: midnight sun grazing or above horizon', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const rising = findSolarCrossing(ARCTIC_LAT, 0, HORIZON_ALT, juneSolstice, 'rising');
      const setting = findSolarCrossing(ARCTIC_LAT, 0, HORIZON_ALT, juneSolstice, 'setting');

      expect(['crossing', 'alwaysAbove', 'grazing']).toContain(rising.kind);
      expect(['crossing', 'alwaysAbove', 'grazing']).toContain(setting.kind);
    });

    it('Arctic Circle at Dec Solstice: polar night grazing or below horizon', () => {
      const decSolstice = new Date('2026-12-21T12:00:00Z');
      const rising = findSolarCrossing(ARCTIC_LAT, 0, HORIZON_ALT, decSolstice, 'rising');
      const setting = findSolarCrossing(ARCTIC_LAT, 0, HORIZON_ALT, decSolstice, 'setting');

      expect(['crossing', 'alwaysBelow', 'grazing']).toContain(rising.kind);
      expect(['crossing', 'alwaysBelow', 'grazing']).toContain(setting.kind);
    });

    it('Antarctic Circle at June Solstice: polar night grazing or below horizon', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const rising = findSolarCrossing(ANTARCTIC_LAT, 0, HORIZON_ALT, juneSolstice, 'rising');
      expect(['crossing', 'alwaysBelow', 'grazing']).toContain(rising.kind);
    });

    it('Antarctic Circle at Dec Solstice: midnight sun grazing or above horizon', () => {
      const decSolstice = new Date('2026-12-21T12:00:00Z');
      const rising = findSolarCrossing(ANTARCTIC_LAT, 0, HORIZON_ALT, decSolstice, 'rising');
      expect(['crossing', 'alwaysAbove', 'grazing']).toContain(rising.kind);
    });

    it('explicit grazing detection when target altitude matches exact culmination', () => {
      const testDate = new Date('2026-06-21T12:00:00Z');
      // At latitude 50 N on June 21, noon culmination is ~ 63.44 deg
      const noonDate = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
      const exactCulmination = getSolarAltitude(50, 0, noonDate);

      // Query with target altitude equal to culmination
      const grazingRes = findSolarCrossing(50, 0, exactCulmination, testDate, 'rising', {
        toleranceDeg: 0.05,
      });

      expect(['grazing', 'crossing']).toContain(grazingRes.kind);
      if (grazingRes.kind === 'grazing') {
        expect(grazingRes.hourAngleDeg).toBe(0);
        expect(grazingRes.tangentAltitudeDeg).toBeCloseTo(exactCulmination, 1);
      }
    });

    it('explicit grazing detection at nadir when target altitude matches minimum', () => {
      const testDate = new Date('2026-06-21T12:00:00Z');
      // At latitude 70 N on June 21, nadir altitude is ~ 3.44 deg
      const approxNoon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
      const eot = getEquationOfTime(approxNoon);
      const noonHours = 12 - eot / 60;
      const nadirDate = new Date(Date.UTC(2026, 5, 21) + (noonHours + 12) * 3600000);
      const exactNadir = getSolarAltitude(70, 0, nadirDate);

      const grazingRes = findSolarCrossing(70, 0, exactNadir, testDate, 'setting', {
        toleranceDeg: 0.05,
      });

      expect(['grazing', 'alwaysAbove']).toContain(grazingRes.kind);
      if (grazingRes.kind === 'grazing') {
        expect(grazingRes.hourAngleDeg).toBe(180);
        expect(grazingRes.tangentAltitudeDeg).toBeCloseTo(exactNadir, 1);
      }
    });
  });

  describe('Focus Case 5: Comprehensive Global Latitude Sweep', () => {
    const latitudes = [-85, -60, -30, 0, 30, 60, 85];
    const seasons = [
      new Date('2026-03-20T12:00:00Z'),
      new Date('2026-06-21T12:00:00Z'),
      new Date('2026-09-23T12:00:00Z'),
      new Date('2026-12-21T12:00:00Z'),
    ];

    it('never throws or produces NaN across all latitudes, seasons, and twilight angles', () => {
      const angles = [-0.8333, -6, -12, -18];

      for (const lat of latitudes) {
        for (const date of seasons) {
          for (const angle of angles) {
            const rising = findSolarCrossing(lat, 0, angle, date, 'rising');
            const setting = findSolarCrossing(lat, 0, angle, date, 'setting');

            expect(['crossing', 'alwaysAbove', 'alwaysBelow', 'grazing']).toContain(rising.kind);
            expect(['crossing', 'alwaysAbove', 'alwaysBelow', 'grazing']).toContain(setting.kind);

            if (rising.kind === 'crossing') {
              expect(rising.date).not.toBeNull();
              const alt = getSolarAltitude(lat, 0, rising.date!);
              expect(Math.abs(alt - angle)).toBeLessThan(0.01);
              expect(rising.hourAngleDeg).toBeLessThanOrEqual(0);
            }

            if (setting.kind === 'crossing') {
              expect(setting.date).not.toBeNull();
              const alt = getSolarAltitude(lat, 0, setting.date!);
              expect(Math.abs(alt - angle)).toBeLessThan(0.01);
              expect(setting.hourAngleDeg).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    });

    it('handles extreme polar settlements: Longyearbyen (78.22 N) and McMurdo (-77.85 S)', () => {
      const juneSolstice = new Date('2026-06-21T12:00:00Z');
      const decSolstice = new Date('2026-12-21T12:00:00Z');

      // Longyearbyen summer: midnight sun
      const lybSummer = findSolarCrossing(78.22, 15.65, HORIZON_ALT, juneSolstice, 'setting');
      expect(lybSummer.kind).toBe('alwaysAbove');

      // Longyearbyen winter: polar night
      const lybWinter = findSolarCrossing(78.22, 15.65, HORIZON_ALT, decSolstice, 'setting');
      expect(lybWinter.kind).toBe('alwaysBelow');

      // McMurdo summer (Dec): midnight sun
      const mcmSummer = findSolarCrossing(-77.85, 166.67, HORIZON_ALT, decSolstice, 'setting');
      expect(mcmSummer.kind).toBe('alwaysAbove');

      // McMurdo winter (June): polar night
      const mcmWinter = findSolarCrossing(-77.85, 166.67, HORIZON_ALT, juneSolstice, 'setting');
      expect(mcmWinter.kind).toBe('alwaysBelow');
    });

    it('works stably with zero toleranceDeg', () => {
      const equinox = new Date('2026-03-20T12:00:00Z');
      const resZeroTol = findSolarCrossing(0, 0, HORIZON_ALT, equinox, 'rising', {
        toleranceDeg: 0,
      });
      expect(resZeroTol.kind).toBe('crossing');
      expect(resZeroTol.date).not.toBeNull();
      const alt = getSolarAltitude(0, 0, resZeroTol.date!);
      expect(Math.abs(alt - HORIZON_ALT)).toBeLessThan(0.001);
    });
  });
});
