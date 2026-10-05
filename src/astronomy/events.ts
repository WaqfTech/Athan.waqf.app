// Typed solar events root solver and physical altitude crossing engine

import { getSolarAltitude, getSolarDeclination, getEquationOfTime, getSubsolarPoint } from './solar';
import { getLocalHourAngle } from './coordinates';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export type SolarCrossingDirection = 'rising' | 'setting';

export type SolarEventKind =
  | 'crossing'
  | 'alwaysAbove'
  | 'alwaysBelow'
  | 'grazing'
  | 'indeterminate'
  | 'invalid';

export interface SolarCrossing {
  kind: 'crossing';
  date: Date;
  direction: SolarCrossingDirection;
  targetAltitudeDeg: number;
  actualAltitudeDeg: number;
  hourAngleDeg: number;
  bracketDurationSeconds: number;
}

export interface SolarAbsence {
  kind: 'alwaysAbove' | 'alwaysBelow';
  date: null;
  targetAltitudeDeg: number;
  minAltitudeDeg: number;
  maxAltitudeDeg: number;
}

export interface SolarGrazing {
  kind: 'grazing';
  date: Date;
  direction: SolarCrossingDirection;
  targetAltitudeDeg: number;
  tangentAltitudeDeg: number;
  hourAngleDeg: number;
}

export interface SolarIndeterminate {
  kind: 'indeterminate' | 'invalid';
  date: null;
  targetAltitudeDeg: number;
  reason: string;
}

export type SolarEventResult =
  | SolarCrossing
  | SolarAbsence
  | SolarGrazing
  | SolarIndeterminate;

export interface SolarCrossingOptions {
  toleranceDeg?: number;
  maxIterations?: number;
}

/**
 * Calculates the shadow ratio of a vertical gnomon at local solar noon.
 * S_noon = tan(|latitude - declination|).
 * Requires strictly positive solar altitude at noon (h_noon > 0).
 * Returns null if the Sun is at or below the horizon at local solar noon.
 */
export function calculateNoonShadowRatio(
  latitude: number,
  declinationDeg: number,
): number | null {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof declinationDeg !== 'number' ||
    !Number.isFinite(declinationDeg)
  ) {
    return null;
  }

  const zenithDistanceDeg = Math.abs(latitude - declinationDeg);
  const noonAltitudeDeg = 90 - zenithDistanceDeg;

  // Enforce strictly positive solar altitude at local solar noon
  if (noonAltitudeDeg <= 0) {
    return null;
  }

  return Math.tan(zenithDistanceDeg * DEG2RAD);
}

/**
 * Calculates the target solar altitude in degrees for Asr prayer.
 * h_asr = atan(1 / (S_noon + shadowFactor)).
 * Returns null if no physical noon shadow exists.
 */
export function calculateAsrAltitude(
  latitude: number,
  declinationDeg: number,
  shadowFactor: number,
): number | null {
  if (typeof shadowFactor !== 'number' || !Number.isFinite(shadowFactor) || shadowFactor <= 0) {
    return null;
  }

  const noonShadow = calculateNoonShadowRatio(latitude, declinationDeg);
  if (noonShadow === null) {
    return null;
  }

  const asrShadow = noonShadow + shadowFactor;
  return Math.atan(1 / asrShadow) * RAD2DEG;
}

/**
 * Finds the exact physical instant when the Sun crosses a target altitude angle.
 * Employs topological screening followed by safeguarded Brent's root refinement.
 */
export function findSolarCrossing(
  latitude: number,
  longitude: number,
  targetAltitudeDeg: number,
  dateOrWindow: Date | { start: Date; end: Date },
  direction: SolarCrossingDirection,
  options: SolarCrossingOptions = {},
): SolarEventResult {
  // 1. Input validation
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return {
      kind: 'invalid',
      date: null,
      targetAltitudeDeg,
      reason: 'Latitude must be a finite number between -90 and 90 degrees',
    };
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return {
      kind: 'invalid',
      date: null,
      targetAltitudeDeg,
      reason: 'Longitude must be a finite number',
    };
  }
  if (
    typeof targetAltitudeDeg !== 'number' ||
    !Number.isFinite(targetAltitudeDeg) ||
    targetAltitudeDeg < -90 ||
    targetAltitudeDeg > 90
  ) {
    return {
      kind: 'invalid',
      date: null,
      targetAltitudeDeg,
      reason: 'Target altitude must be a finite number between -90 and 90 degrees',
    };
  }

  let refDate: Date;
  if (dateOrWindow instanceof Date) {
    refDate = dateOrWindow;
  } else if (
    dateOrWindow &&
    typeof dateOrWindow === 'object' &&
    dateOrWindow.start instanceof Date
  ) {
    refDate = dateOrWindow.start;
  } else {
    return {
      kind: 'invalid',
      date: null,
      targetAltitudeDeg,
      reason: 'Search date must be a valid Date instance or window object',
    };
  }

  if (!Number.isFinite(refDate.getTime())) {
    return {
      kind: 'invalid',
      date: null,
      targetAltitudeDeg,
      reason: 'Date timestamp must be a finite number',
    };
  }

  // 2. Local solar noon & nadir computation for topological screening
  const year = refDate.getUTCFullYear();
  const month = refDate.getUTCMonth();
  const day = refDate.getUTCDate();
  const utcMidnight = Date.UTC(year, month, day);

  const approxNoon = new Date(utcMidnight + 12 * 3600000);
  const declination = getSolarDeclination(approxNoon);
  const eot = getEquationOfTime(approxNoon);

  const solarNoonHours = 12 - longitude / 15 - eot / 60;
  const solarNoonMs = utcMidnight + solarNoonHours * 3600000;
  const noonDate = new Date(solarNoonMs);
  const nadirOffsetMs = direction === 'rising' ? -12 * 3600000 : 12 * 3600000;
  const nadirDate = new Date(solarNoonMs + nadirOffsetMs);

  const hNoon = getSolarAltitude(latitude, longitude, noonDate);
  const hNadir = getSolarAltitude(latitude, longitude, nadirDate);

  const hMax = Math.max(hNoon, hNadir);
  const hMin = Math.min(hNoon, hNadir);

  const epsilon = options.toleranceDeg ?? 0.005;

  // Topological screening for permanent absence or tangency
  if (targetAltitudeDeg > hMax + epsilon) {
    return {
      kind: 'alwaysBelow',
      date: null,
      targetAltitudeDeg,
      minAltitudeDeg: hMin,
      maxAltitudeDeg: hMax,
    };
  }

  if (targetAltitudeDeg < hMin - epsilon) {
    return {
      kind: 'alwaysAbove',
      date: null,
      targetAltitudeDeg,
      minAltitudeDeg: hMin,
      maxAltitudeDeg: hMax,
    };
  }

  if (Math.abs(targetAltitudeDeg - hMax) <= epsilon) {
    return {
      kind: 'grazing',
      date: noonDate,
      direction,
      targetAltitudeDeg,
      tangentAltitudeDeg: hMax,
      hourAngleDeg: 0,
    };
  }

  if (Math.abs(targetAltitudeDeg - hMin) <= epsilon) {
    return {
      kind: 'grazing',
      date: nadirDate,
      direction,
      targetAltitudeDeg,
      tangentAltitudeDeg: hMin,
      hourAngleDeg: direction === 'rising' ? -180 : 180,
    };
  }

  // 3. Analytical hour angle seeding
  const phi = latitude * DEG2RAD;
  const delta = declination * DEG2RAD;
  const hRad = targetAltitudeDeg * DEG2RAD;
  const cosH = (Math.sin(hRad) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
  const clampedCosH = Math.max(-1, Math.min(1, cosH));
  const hDeg = Math.acos(clampedCosH) * RAD2DEG;

  const hSeedDeg = direction === 'rising' ? -hDeg : hDeg;
  const tSeedMs = solarNoonMs + (hSeedDeg / 15) * 3600000;

  // 4. Bracket construction
  const halfCycleStart = direction === 'rising' ? solarNoonMs - 12 * 3600000 : solarNoonMs;
  const halfCycleEnd = direction === 'rising' ? solarNoonMs : solarNoonMs + 12 * 3600000;

  const f = (tMs: number): number => {
    return getSolarAltitude(latitude, longitude, new Date(tMs)) - targetAltitudeDeg;
  };

  let tA = Math.max(halfCycleStart, tSeedMs - 15 * 60 * 1000);
  let tB = Math.min(halfCycleEnd, tSeedMs + 15 * 60 * 1000);
  if (tB <= tA) {
    tA = halfCycleStart;
    tB = halfCycleEnd;
  }
  let fA = f(tA);
  let fB = f(tB);

  // If bracket does not straddle zero, expand towards noon and nadir
  if (fA * fB > 0) {
    for (let step = 0; step < 10; step++) {
      tA = Math.max(halfCycleStart, tA - 15 * 60 * 1000);
      tB = Math.min(halfCycleEnd, tB + 15 * 60 * 1000);
      fA = f(tA);
      fB = f(tB);
      if (fA * fB <= 0) break;
    }
  }

  // Fallback scan across diurnal half-cycle if still unbracketed
  if (fA * fB > 0) {
    const scanStart = halfCycleStart;
    const scanEnd = halfCycleEnd;
    const stepMs = 10 * 60 * 1000; // 10-minute steps
    let found = false;

    let prevT = scanStart;
    let prevF = f(prevT);
    for (let curT = scanStart + stepMs; curT <= scanEnd; curT += stepMs) {
      const curF = f(curT);
      if (prevF * curF <= 0) {
        tA = prevT;
        tB = curT;
        fA = prevF;
        fB = curF;
        found = true;
        break;
      }
      prevT = curT;
      prevF = curF;
    }

    if (!found) {
      if (prevF > 0) {
        return {
          kind: 'alwaysAbove',
          date: null,
          targetAltitudeDeg,
          minAltitudeDeg: hMin,
          maxAltitudeDeg: hMax,
        };
      }
      if (prevF < 0) {
        return {
          kind: 'alwaysBelow',
          date: null,
          targetAltitudeDeg,
          minAltitudeDeg: hMin,
          maxAltitudeDeg: hMax,
        };
      }
      return {
        kind: 'indeterminate',
        date: null,
        targetAltitudeDeg,
        reason: 'Could not bracket altitude crossing instant',
      };
    }
  }

  const initialBracketDuration = Math.abs(tB - tA) / 1000;

  // 5. Brent's root-finding method
  let a = tA;
  let b = tB;
  let fa = fA;
  let fb = fB;

  if (Math.abs(fa) < Math.abs(fb)) {
    // Swap so b is the best estimate
    const tempT = a;
    a = b;
    b = tempT;
    const tempF = fa;
    fa = fb;
    fb = tempF;
  }

  let c = a;
  let fc = fa;
  let mflag = true;
  let d = 0;

  const maxIter = options.maxIterations ?? 60;
  const tolAlt = 0.0001; // 0.0001 degrees
  const tolTimeMs = 100; // 0.1 seconds

  for (let iter = 0; iter < maxIter; iter++) {
    if (Math.abs(fb) <= tolAlt || Math.abs(b - a) <= tolTimeMs) {
      break;
    }

    let s: number;
    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      // Secant method
      s = b - fb * ((b - a) / (fb - fa));
    }

    const cond1 = !(
      (s > (3 * a + b) / 4 && s < b) ||
      (s < (3 * a + b) / 4 && s > b)
    );
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tolTimeMs;
    const cond5 = !mflag && Math.abs(c - d) < tolTimeMs;

    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      // Bisection step
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = f(s);
    d = c;
    c = b;
    fc = fb;

    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      const tempT = a;
      a = b;
      b = tempT;
      const tempF = fa;
      fa = fb;
      fb = tempF;
    }
  }

  const rootMs = Math.round(b);
  const crossingDate = new Date(rootMs);
  const actualAltitude = getSolarAltitude(latitude, longitude, crossingDate);
  const subsolar = getSubsolarPoint(crossingDate);
  const hourAngle = getLocalHourAngle(longitude, subsolar.longitude);

  return {
    kind: 'crossing',
    date: crossingDate,
    direction,
    targetAltitudeDeg,
    actualAltitudeDeg: actualAltitude,
    hourAngleDeg: hourAngle,
    bracketDurationSeconds: initialBracketDuration,
  };
}
