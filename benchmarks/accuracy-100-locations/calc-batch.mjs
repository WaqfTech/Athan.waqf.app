// src/prayer/conventions.ts
var CALCULATION_CONVENTIONS = {
  MuslimWorldLeague: {
    name: "MuslimWorldLeague",
    fajrAngle: 18,
    ishaAngle: 17,
    dhuhrSafetyMinutes: 1
  },
  UmmAlQura: {
    name: "UmmAlQura",
    fajrAngle: 18.5,
    ishaAngle: 0,
    ishaIntervalMinutes: 90,
    dhuhrSafetyMinutes: 1
  },
  Egyptian: {
    name: "Egyptian",
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    dhuhrSafetyMinutes: 1
  },
  Karachi: {
    name: "Karachi",
    fajrAngle: 18,
    ishaAngle: 18,
    dhuhrSafetyMinutes: 1
  },
  NorthAmerica: {
    name: "NorthAmerica",
    fajrAngle: 15,
    ishaAngle: 15,
    dhuhrSafetyMinutes: 1
  },
  Dubai: {
    name: "Dubai",
    fajrAngle: 18.2,
    ishaAngle: 18.2,
    dhuhrSafetyMinutes: 1
  },
  Qatar: {
    name: "Qatar",
    fajrAngle: 18,
    ishaAngle: 0,
    ishaIntervalMinutes: 90,
    dhuhrSafetyMinutes: 1
  },
  Kuwait: {
    name: "Kuwait",
    fajrAngle: 18,
    ishaAngle: 17.5,
    dhuhrSafetyMinutes: 1
  },
  Singapore: {
    name: "Singapore",
    fajrAngle: 20,
    ishaAngle: 18,
    dhuhrSafetyMinutes: 1
  },
  Turkey: {
    name: "Turkey",
    fajrAngle: 18,
    ishaAngle: 17,
    dhuhrSafetyMinutes: 1
  }
};

// src/astronomy/julian.ts
var J2000_EPOCH = 2451545;
var MS_PER_DAY = 864e5;
var DAYS_PER_CENTURY = 36525;
function getJulianDay(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError("Invalid date: date must be a valid Date instance with a finite timestamp");
  }
  return date.getTime() / MS_PER_DAY + 24405875e-1;
}
function getJulianCenturies(date) {
  return (getJulianDay(date) - J2000_EPOCH) / DAYS_PER_CENTURY;
}

// src/astronomy/solar.ts
var DEG2RAD = Math.PI / 180;
var RAD2DEG = 180 / Math.PI;
function normalizeDegrees(deg) {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}
function getSunGeometricMeanLongitude(T) {
  return normalizeDegrees(280.46646 + T * (36000.76983 + T * 3032e-7));
}
function getSunMeanAnomaly(T) {
  return normalizeDegrees(357.52911 + T * (35999.05029 - 1537e-7 * T));
}
function getEarthOrbitEccentricity(T) {
  return 0.016708634 - T * (42037e-9 + 1267e-10 * T);
}
function getSunEquationOfCenter(T, M) {
  const mRad = M * DEG2RAD;
  return Math.sin(mRad) * (1.914602 - T * (4817e-6 + 14e-6 * T)) + Math.sin(2 * mRad) * (0.019993 - 101e-6 * T) + Math.sin(3 * mRad) * 289e-6;
}
function getSunTrueLongitude(T) {
  const L0 = getSunGeometricMeanLongitude(T);
  const M = getSunMeanAnomaly(T);
  const C = getSunEquationOfCenter(T, M);
  return L0 + C;
}
function getSunApparentLongitude(T) {
  const trueLong = getSunTrueLongitude(T);
  const omega = 125.04 - 1934.136 * T;
  return trueLong - 569e-5 - 478e-5 * Math.sin(omega * DEG2RAD);
}
function getMeanObliquityOfEcliptic(T) {
  const seconds = 21.448 - T * (46.815 + T * (59e-5 - T * 1813e-6));
  return 23 + (26 + seconds / 60) / 60;
}
function getObliquityOfEcliptic(T) {
  const e0 = getMeanObliquityOfEcliptic(T);
  const omega = 125.04 - 1934.136 * T;
  return e0 + 256e-5 * Math.cos(omega * DEG2RAD);
}
function assertValidDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError("Invalid date: date must be a valid Date instance with a finite timestamp");
  }
}
function getSolarDeclination(date) {
  assertValidDate(date);
  const T = getJulianCenturies(date);
  const lambdaApp = getSunApparentLongitude(T);
  const epsilon = getObliquityOfEcliptic(T);
  const sinDeclination = Math.sin(epsilon * DEG2RAD) * Math.sin(lambdaApp * DEG2RAD);
  return Math.asin(sinDeclination) * RAD2DEG;
}
function getEquationOfTime(date) {
  assertValidDate(date);
  const T = getJulianCenturies(date);
  const epsilon = getObliquityOfEcliptic(T);
  const L0 = getSunGeometricMeanLongitude(T);
  const e = getEarthOrbitEccentricity(T);
  const M = getSunMeanAnomaly(T);
  const y = Math.tan(epsilon * DEG2RAD / 2) ** 2;
  const sin2L0 = Math.sin(2 * L0 * DEG2RAD);
  const sinM = Math.sin(M * DEG2RAD);
  const cos2L0 = Math.cos(2 * L0 * DEG2RAD);
  const sin4L0 = Math.sin(4 * L0 * DEG2RAD);
  const sin2M = Math.sin(2 * M * DEG2RAD);
  const eotRad = y * sin2L0 - 2 * e * sinM + 4 * e * y * sinM * cos2L0 - 0.5 * y * y * sin4L0 - 1.25 * e * e * sin2M;
  return 4 * RAD2DEG * eotRad;
}
function getSubsolarPoint(date) {
  assertValidDate(date);
  const declination = getSolarDeclination(date);
  const eot = getEquationOfTime(date);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 36e5;
  let lon = (12 - utcHours) * 15 - eot / 4;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return {
    latitude: declination,
    longitude: lon
  };
}
function getSolarAltitude(observerLat, observerLon, date) {
  if (typeof observerLat !== "number" || !Number.isFinite(observerLat)) {
    throw new TypeError("Observer latitude must be a finite number");
  }
  if (observerLat < -90 || observerLat > 90) {
    throw new RangeError("Observer latitude must be between -90 and 90 degrees");
  }
  if (typeof observerLon !== "number" || !Number.isFinite(observerLon)) {
    throw new TypeError("Observer longitude must be a finite number");
  }
  assertValidDate(date);
  const subsolar = getSubsolarPoint(date);
  const phi1 = observerLat * DEG2RAD;
  const phi2 = subsolar.latitude * DEG2RAD;
  const deltaLon = (observerLon - subsolar.longitude) * DEG2RAD;
  const sinH = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
  const clampedSinH = Math.max(-1, Math.min(1, sinH));
  return Math.asin(clampedSinH) * RAD2DEG;
}

// src/astronomy/coordinates.ts
var DEG2RAD2 = Math.PI / 180;
var RAD2DEG2 = 180 / Math.PI;
function getLocalHourAngle(observerLon, subsolarLon) {
  if (typeof observerLon !== "number" || !Number.isFinite(observerLon)) {
    throw new TypeError("Observer longitude must be a finite number");
  }
  if (typeof subsolarLon !== "number" || !Number.isFinite(subsolarLon)) {
    throw new TypeError("Subsolar longitude must be a finite number");
  }
  let diff = (observerLon - subsolarLon) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// src/astronomy/events.ts
var DEG2RAD3 = Math.PI / 180;
var RAD2DEG3 = 180 / Math.PI;
function calculateNoonShadowRatio(latitude, declinationDeg) {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || typeof declinationDeg !== "number" || !Number.isFinite(declinationDeg)) {
    return null;
  }
  const zenithDistanceDeg = Math.abs(latitude - declinationDeg);
  const noonAltitudeDeg = 90 - zenithDistanceDeg;
  if (noonAltitudeDeg <= 0) {
    return null;
  }
  return Math.tan(zenithDistanceDeg * DEG2RAD3);
}
function calculateAsrAltitude(latitude, declinationDeg, shadowFactor) {
  if (typeof shadowFactor !== "number" || !Number.isFinite(shadowFactor) || shadowFactor <= 0) {
    return null;
  }
  const noonShadow = calculateNoonShadowRatio(latitude, declinationDeg);
  if (noonShadow === null) {
    return null;
  }
  const asrShadow = noonShadow + shadowFactor;
  return Math.atan(1 / asrShadow) * RAD2DEG3;
}
function findSolarCrossing(latitude, longitude, targetAltitudeDeg, dateOrWindow, direction, options = {}) {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return {
      kind: "invalid",
      date: null,
      targetAltitudeDeg,
      reason: "Latitude must be a finite number between -90 and 90 degrees"
    };
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) {
    return {
      kind: "invalid",
      date: null,
      targetAltitudeDeg,
      reason: "Longitude must be a finite number"
    };
  }
  if (typeof targetAltitudeDeg !== "number" || !Number.isFinite(targetAltitudeDeg) || targetAltitudeDeg < -90 || targetAltitudeDeg > 90) {
    return {
      kind: "invalid",
      date: null,
      targetAltitudeDeg,
      reason: "Target altitude must be a finite number between -90 and 90 degrees"
    };
  }
  let refDate;
  if (dateOrWindow instanceof Date) {
    refDate = dateOrWindow;
  } else if (dateOrWindow && typeof dateOrWindow === "object" && dateOrWindow.start instanceof Date) {
    refDate = dateOrWindow.start;
  } else {
    return {
      kind: "invalid",
      date: null,
      targetAltitudeDeg,
      reason: "Search date must be a valid Date instance or window object"
    };
  }
  if (!Number.isFinite(refDate.getTime())) {
    return {
      kind: "invalid",
      date: null,
      targetAltitudeDeg,
      reason: "Date timestamp must be a finite number"
    };
  }
  const year = refDate.getUTCFullYear();
  const month = refDate.getUTCMonth();
  const day = refDate.getUTCDate();
  const utcMidnight = Date.UTC(year, month, day);
  const approxNoon = new Date(utcMidnight + 12 * 36e5);
  const declination = getSolarDeclination(approxNoon);
  const eot = getEquationOfTime(approxNoon);
  const solarNoonHours = 12 - longitude / 15 - eot / 60;
  const solarNoonMs = utcMidnight + solarNoonHours * 36e5;
  const noonDate = new Date(solarNoonMs);
  const nadirOffsetMs = direction === "rising" ? -12 * 36e5 : 12 * 36e5;
  const nadirDate = new Date(solarNoonMs + nadirOffsetMs);
  const hNoon = getSolarAltitude(latitude, longitude, noonDate);
  const hNadir = getSolarAltitude(latitude, longitude, nadirDate);
  const hMax = Math.max(hNoon, hNadir);
  const hMin = Math.min(hNoon, hNadir);
  const epsilon = options.toleranceDeg ?? 5e-3;
  if (targetAltitudeDeg > hMax + epsilon) {
    return {
      kind: "alwaysBelow",
      date: null,
      targetAltitudeDeg,
      minAltitudeDeg: hMin,
      maxAltitudeDeg: hMax
    };
  }
  if (targetAltitudeDeg < hMin - epsilon) {
    return {
      kind: "alwaysAbove",
      date: null,
      targetAltitudeDeg,
      minAltitudeDeg: hMin,
      maxAltitudeDeg: hMax
    };
  }
  if (Math.abs(targetAltitudeDeg - hMax) <= epsilon) {
    return {
      kind: "grazing",
      date: noonDate,
      direction,
      targetAltitudeDeg,
      tangentAltitudeDeg: hMax,
      hourAngleDeg: 0
    };
  }
  if (Math.abs(targetAltitudeDeg - hMin) <= epsilon) {
    return {
      kind: "grazing",
      date: nadirDate,
      direction,
      targetAltitudeDeg,
      tangentAltitudeDeg: hMin,
      hourAngleDeg: direction === "rising" ? -180 : 180
    };
  }
  const phi = latitude * DEG2RAD3;
  const delta = declination * DEG2RAD3;
  const hRad = targetAltitudeDeg * DEG2RAD3;
  const cosH = (Math.sin(hRad) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
  const clampedCosH = Math.max(-1, Math.min(1, cosH));
  const hDeg = Math.acos(clampedCosH) * RAD2DEG3;
  const hSeedDeg = direction === "rising" ? -hDeg : hDeg;
  const tSeedMs = solarNoonMs + hSeedDeg / 15 * 36e5;
  const halfCycleStart = direction === "rising" ? solarNoonMs - 12 * 36e5 : solarNoonMs;
  const halfCycleEnd = direction === "rising" ? solarNoonMs : solarNoonMs + 12 * 36e5;
  const f = (tMs) => {
    return getSolarAltitude(latitude, longitude, new Date(tMs)) - targetAltitudeDeg;
  };
  let tA = Math.max(halfCycleStart, tSeedMs - 15 * 60 * 1e3);
  let tB = Math.min(halfCycleEnd, tSeedMs + 15 * 60 * 1e3);
  if (tB <= tA) {
    tA = halfCycleStart;
    tB = halfCycleEnd;
  }
  let fA = f(tA);
  let fB = f(tB);
  if (fA * fB > 0) {
    for (let step = 0; step < 10; step++) {
      tA = Math.max(halfCycleStart, tA - 15 * 60 * 1e3);
      tB = Math.min(halfCycleEnd, tB + 15 * 60 * 1e3);
      fA = f(tA);
      fB = f(tB);
      if (fA * fB <= 0) break;
    }
  }
  if (fA * fB > 0) {
    const scanStart = halfCycleStart;
    const scanEnd = halfCycleEnd;
    const stepMs = 10 * 60 * 1e3;
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
          kind: "alwaysAbove",
          date: null,
          targetAltitudeDeg,
          minAltitudeDeg: hMin,
          maxAltitudeDeg: hMax
        };
      }
      if (prevF < 0) {
        return {
          kind: "alwaysBelow",
          date: null,
          targetAltitudeDeg,
          minAltitudeDeg: hMin,
          maxAltitudeDeg: hMax
        };
      }
      return {
        kind: "indeterminate",
        date: null,
        targetAltitudeDeg,
        reason: "Could not bracket altitude crossing instant"
      };
    }
  }
  const initialBracketDuration = Math.abs(tB - tA) / 1e3;
  let a = tA;
  let b = tB;
  let fa = fA;
  let fb = fB;
  if (Math.abs(fa) < Math.abs(fb)) {
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
  const tolAlt = 1e-4;
  const tolTimeMs = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    if (Math.abs(fb) <= tolAlt || Math.abs(b - a) <= tolTimeMs) {
      break;
    }
    let s;
    if (fa !== fc && fb !== fc) {
      s = a * fb * fc / ((fa - fb) * (fa - fc)) + b * fa * fc / ((fb - fa) * (fb - fc)) + c * fa * fb / ((fc - fa) * (fc - fb));
    } else {
      s = b - fb * ((b - a) / (fb - fa));
    }
    const cond1 = !(s > (3 * a + b) / 4 && s < b || s < (3 * a + b) / 4 && s > b);
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tolTimeMs;
    const cond5 = !mflag && Math.abs(c - d) < tolTimeMs;
    if (cond1 || cond2 || cond3 || cond4 || cond5) {
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
    kind: "crossing",
    date: crossingDate,
    direction,
    targetAltitudeDeg,
    actualAltitudeDeg: actualAltitude,
    hourAngleDeg: hourAngle,
    bracketDurationSeconds: initialBracketDuration
  };
}

// src/prayer/calculator.ts
function calculateIslamicNight(maghrib, nextFajr, current) {
  if (!(maghrib instanceof Date) || !Number.isFinite(maghrib.getTime()) || !(nextFajr instanceof Date) || !Number.isFinite(nextFajr.getTime())) {
    return null;
  }
  const maghribMs = maghrib.getTime();
  const fajrMs = nextFajr.getTime();
  if (fajrMs <= maghribMs) {
    return null;
  }
  const durationMs = fajrMs - maghribMs;
  if (durationMs > 24 * 36e5) {
    return null;
  }
  const midnight = new Date(Math.round(maghribMs + durationMs / 2));
  const firstThirdEnd = new Date(Math.round(maghribMs + durationMs / 3));
  const lastThirdStartMs = Math.round(maghribMs + durationMs * 2 / 3);
  const lastThirdStart = new Date(lastThirdStartMs);
  const lastThirdEnd = new Date(fajrMs);
  const nowMs = current instanceof Date && Number.isFinite(current.getTime()) ? current.getTime() : current === void 0 ? Date.now() : NaN;
  const isActive = Number.isFinite(nowMs) && nowMs >= maghribMs && nowMs < fajrMs;
  const isCurrentlyLastThird = Number.isFinite(nowMs) && nowMs >= lastThirdStartMs && nowMs < fajrMs;
  return {
    durationMs,
    midnight,
    firstThirdEnd,
    lastThirdStart,
    lastThirdEnd,
    isCurrentlyLastThird,
    isActive
  };
}
function calculatePrayerTimes(latitude, longitude, date, options = {}, isLookahead = false) {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== "number" || !Number.isFinite(longitude) || !(date instanceof Date) || !Number.isFinite(date.getTime())) {
    const unresolvedEntry = (note) => ({
      date: null,
      provenance: "unresolved",
      note
    });
    return {
      fajr: unresolvedEntry("Invalid coordinates or date"),
      sunrise: unresolvedEntry("Invalid coordinates or date"),
      dhuhr: unresolvedEntry("Invalid coordinates or date"),
      asr: unresolvedEntry("Invalid coordinates or date"),
      maghrib: unresolvedEntry("Invalid coordinates or date"),
      isha: unresolvedEntry("Invalid coordinates or date"),
      sunset: unresolvedEntry("Invalid coordinates or date"),
      currentPrayer: "none",
      nextPrayer: "none",
      nextPrayerTime: null,
      countdownMs: null,
      islamicNight: void 0
    };
  }
  const convention = CALCULATION_CONVENTIONS[options.convention || "UmmAlQura"] || CALCULATION_CONVENTIONS.UmmAlQura;
  const madhab = options.madhab || "Shafi";
  const highLatitudeRule = options.highLatitudeRule || "MiddleOfTheNight";
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const utcMidnight = Date.UTC(year, month, day);
  const approxNoon = new Date(utcMidnight + 12 * 36e5);
  const declination = getSolarDeclination(approxNoon);
  const eot = getEquationOfTime(approxNoon);
  const solarNoonHours = 12 - longitude / 15 - eot / 60;
  const solarNoonDate = new Date(utcMidnight + solarNoonHours * 36e5);
  const dhuhrSafetyMinutes = convention.dhuhrSafetyMinutes ?? 1;
  const dhuhrDate = new Date(solarNoonDate.getTime() + dhuhrSafetyMinutes * 6e4);
  const dhuhr = {
    date: dhuhrDate,
    provenance: "astronomicalSign"
  };
  const sunriseCrossing = findSolarCrossing(latitude, longitude, -0.8333, date, "rising");
  let sunrise;
  if (sunriseCrossing.kind === "crossing") {
    sunrise = {
      date: sunriseCrossing.date,
      provenance: "astronomicalSign"
    };
  } else {
    sunrise = {
      date: null,
      provenance: "unresolved",
      note: sunriseCrossing.kind === "alwaysBelow" ? "Polar night" : "Midnight sun"
    };
  }
  const sunsetCrossing = findSolarCrossing(latitude, longitude, -0.8333, date, "setting");
  let sunset;
  if (sunsetCrossing.kind === "crossing") {
    sunset = {
      date: sunsetCrossing.date,
      provenance: "astronomicalSign"
    };
  } else {
    sunset = {
      date: null,
      provenance: "unresolved",
      note: sunsetCrossing.kind === "alwaysBelow" ? "Polar night" : "Midnight sun"
    };
  }
  let maghrib;
  if (convention.maghribAngle !== void 0 && convention.maghribAngle > 0) {
    const maghribCrossing = findSolarCrossing(latitude, longitude, -convention.maghribAngle, date, "setting");
    if (maghribCrossing.kind === "crossing") {
      maghrib = {
        date: maghribCrossing.date,
        provenance: "astronomicalSign"
      };
    } else {
      maghrib = {
        date: null,
        provenance: "unresolved",
        note: maghribCrossing.kind
      };
    }
  } else {
    if (sunset.date !== null) {
      maghrib = {
        date: sunset.date,
        provenance: "astronomicalSign"
      };
    } else if (options.highLatitudeRule !== void 0 && sunsetCrossing.kind === "alwaysAbove") {
      const midnightMs = utcMidnight + (solarNoonHours + 12) * 36e5;
      const virtualNightMs = 8 * 36e5;
      const virtualSunsetMs = midnightMs - virtualNightMs / 2;
      maghrib = {
        date: new Date(virtualSunsetMs),
        provenance: "highLatitudeAdjustment",
        ruleApplied: options.highLatitudeRule
      };
    } else {
      maghrib = {
        date: null,
        provenance: "unresolved",
        note: sunset.note
      };
    }
  }
  let asr;
  const shadowFactor = madhab === "Hanafi" ? 2 : 1;
  const asrAltitude = calculateAsrAltitude(latitude, declination, shadowFactor);
  if (asrAltitude === null) {
    asr = {
      date: null,
      provenance: "unresolved",
      note: "No physical noon shadow"
    };
  } else {
    const asrCrossing = findSolarCrossing(latitude, longitude, asrAltitude, date, "setting");
    if (asrCrossing.kind === "crossing") {
      asr = {
        date: asrCrossing.date,
        provenance: "astronomicalSign"
      };
    } else {
      asr = {
        date: null,
        provenance: "unresolved",
        note: asrCrossing.kind
      };
    }
  }
  let fajr;
  const fajrCrossing = findSolarCrossing(latitude, longitude, -convention.fajrAngle, date, "rising");
  if (fajrCrossing.kind === "crossing") {
    fajr = {
      date: fajrCrossing.date,
      provenance: "astronomicalSign"
    };
  } else {
    if (sunrise.date !== null && sunset.date !== null) {
      const nightDurationMs = 24 * 36e5 - (sunset.date.getTime() - sunrise.date.getTime());
      let fraction;
      if (highLatitudeRule === "SeventhOfTheNight") {
        fraction = 1 / 7;
      } else if (highLatitudeRule === "AngleBased") {
        fraction = convention.fajrAngle / 60;
      } else {
        fraction = 1 / 2;
      }
      const fajrMs2 = sunrise.date.getTime() - nightDurationMs * fraction;
      fajr = {
        date: new Date(fajrMs2),
        provenance: "highLatitudeAdjustment",
        ruleApplied: highLatitudeRule
      };
    } else if (options.highLatitudeRule !== void 0 && fajrCrossing.kind === "alwaysAbove") {
      const midnightMs = utcMidnight + (solarNoonHours + 12) * 36e5;
      const virtualNightMs = 8 * 36e5;
      const virtualSunriseMs = midnightMs + virtualNightMs / 2;
      let fraction;
      if (options.highLatitudeRule === "SeventhOfTheNight") {
        fraction = 1 / 7;
      } else if (options.highLatitudeRule === "AngleBased") {
        fraction = convention.fajrAngle / 60;
      } else {
        fraction = 1 / 2;
      }
      const fajrMs2 = virtualSunriseMs - virtualNightMs * fraction;
      fajr = {
        date: new Date(fajrMs2),
        provenance: "highLatitudeAdjustment",
        ruleApplied: options.highLatitudeRule
      };
    } else {
      fajr = {
        date: null,
        provenance: "unresolved",
        note: "Indeterminate night span"
      };
    }
  }
  let isha;
  if (convention.ishaIntervalMinutes !== void 0 && convention.ishaIntervalMinutes > 0) {
    if (maghrib.date !== null) {
      const ishaDate = new Date(maghrib.date.getTime() + convention.ishaIntervalMinutes * 6e4);
      isha = {
        date: ishaDate,
        provenance: "fixedInterval"
      };
    } else {
      isha = {
        date: null,
        provenance: "unresolved",
        note: "Maghrib unresolved for fixed interval"
      };
    }
  } else {
    const ishaCrossing = findSolarCrossing(latitude, longitude, -convention.ishaAngle, date, "setting");
    if (ishaCrossing.kind === "crossing") {
      isha = {
        date: ishaCrossing.date,
        provenance: "astronomicalSign"
      };
    } else {
      if (sunrise.date !== null && sunset.date !== null) {
        const nightDurationMs = 24 * 36e5 - (sunset.date.getTime() - sunrise.date.getTime());
        let fraction;
        if (highLatitudeRule === "SeventhOfTheNight") {
          fraction = 1 / 7;
        } else if (highLatitudeRule === "AngleBased") {
          fraction = convention.ishaAngle / 60;
        } else {
          fraction = 1 / 2;
        }
        const ishaMs2 = sunset.date.getTime() + nightDurationMs * fraction;
        isha = {
          date: new Date(ishaMs2),
          provenance: "highLatitudeAdjustment",
          ruleApplied: highLatitudeRule
        };
      } else if (options.highLatitudeRule !== void 0 && ishaCrossing.kind === "alwaysAbove") {
        const midnightMs = utcMidnight + (solarNoonHours + 12) * 36e5;
        const virtualNightMs = 8 * 36e5;
        const virtualSunsetMs = midnightMs - virtualNightMs / 2;
        const baseSunsetMs = maghrib.date ? maghrib.date.getTime() : virtualSunsetMs;
        let fraction;
        if (options.highLatitudeRule === "SeventhOfTheNight") {
          fraction = 1 / 7;
        } else if (options.highLatitudeRule === "AngleBased") {
          fraction = convention.ishaAngle / 60;
        } else {
          fraction = 1 / 2;
        }
        const ishaMs2 = baseSunsetMs + virtualNightMs * fraction;
        isha = {
          date: new Date(ishaMs2),
          provenance: "highLatitudeAdjustment",
          ruleApplied: options.highLatitudeRule
        };
      } else {
        isha = {
          date: null,
          provenance: "unresolved",
          note: "Indeterminate night span"
        };
      }
    }
  }
  const nowMs = (options.now ?? date).getTime();
  let currentPrayer = "none";
  let nextPrayer = "none";
  let nextPrayerTime = null;
  let tomorrowSchedule = null;
  const getTomorrowSchedule = () => {
    if (!tomorrowSchedule) {
      const tomorrowDate = new Date(Date.UTC(year, month, day + 1, 12, 0, 0));
      tomorrowSchedule = calculatePrayerTimes(
        latitude,
        longitude,
        tomorrowDate,
        options,
        true
      );
    }
    return tomorrowSchedule;
  };
  const fajrMs = fajr.date?.getTime() ?? null;
  const sunriseMs = sunrise.date?.getTime() ?? null;
  const dhuhrMs = dhuhr.date?.getTime() ?? null;
  const asrMs = asr.date?.getTime() ?? null;
  const maghribMs = maghrib.date?.getTime() ?? null;
  const ishaMs = isha.date?.getTime() ?? null;
  if (fajrMs !== null && nowMs < fajrMs) {
    currentPrayer = "isha";
    nextPrayer = "fajr";
    nextPrayerTime = fajr.date;
  } else if (sunriseMs !== null && nowMs < sunriseMs) {
    currentPrayer = "fajr";
    nextPrayer = dhuhr.date ? "dhuhr" : asr.date ? "asr" : maghrib.date ? "maghrib" : isha.date ? "isha" : "none";
    nextPrayerTime = dhuhr.date ?? asr.date ?? maghrib.date ?? isha.date ?? null;
  } else if (dhuhrMs !== null && nowMs < dhuhrMs) {
    currentPrayer = "none";
    nextPrayer = "dhuhr";
    nextPrayerTime = dhuhr.date;
  } else if (asrMs !== null && nowMs < asrMs) {
    currentPrayer = "dhuhr";
    nextPrayer = "asr";
    nextPrayerTime = asr.date;
  } else if (maghribMs !== null && nowMs < maghribMs) {
    currentPrayer = asr.date ? "asr" : "dhuhr";
    nextPrayer = "maghrib";
    nextPrayerTime = maghrib.date;
  } else if (ishaMs !== null && nowMs < ishaMs) {
    currentPrayer = maghrib.date ? "maghrib" : asr.date ? "asr" : "dhuhr";
    nextPrayer = "isha";
    nextPrayerTime = isha.date;
  } else {
    currentPrayer = isha.date ? "isha" : maghrib.date ? "maghrib" : "none";
    if (!isLookahead) {
      const tomorrow = getTomorrowSchedule();
      if (tomorrow.fajr.date !== null) {
        nextPrayer = "fajr";
        nextPrayerTime = tomorrow.fajr.date;
      } else {
        const candidateKeys = [
          "sunrise",
          "dhuhr",
          "asr",
          "maghrib",
          "isha"
        ];
        const nextResolved = candidateKeys.find((k) => tomorrow[k].date !== null);
        if (nextResolved) {
          nextPrayer = nextResolved;
          nextPrayerTime = tomorrow[nextResolved].date;
        } else {
          nextPrayer = "none";
          nextPrayerTime = null;
        }
      }
    } else {
      nextPrayer = "none";
      nextPrayerTime = null;
    }
  }
  const countdownMs = nextPrayerTime ? Math.max(0, nextPrayerTime.getTime() - nowMs) : null;
  let islamicNight = void 0;
  if (!isLookahead) {
    const evalTime = options.now ?? date;
    const isVirtualSameDayNight = maghrib.date !== null && fajr.date !== null && fajr.date.getTime() > maghrib.date.getTime();
    if (fajr.date !== null && nowMs < fajr.date.getTime() && !isVirtualSameDayNight) {
      const yesterdayDate = new Date(Date.UTC(year, month, day - 1, 12, 0, 0));
      const yesterdaySchedule = calculatePrayerTimes(
        latitude,
        longitude,
        yesterdayDate,
        options,
        true
      );
      if (yesterdaySchedule.maghrib.date !== null) {
        islamicNight = calculateIslamicNight(
          yesterdaySchedule.maghrib.date,
          fajr.date,
          evalTime
        ) ?? void 0;
      }
    } else if (maghrib.date !== null) {
      let nextFajrDate = null;
      if (isVirtualSameDayNight) {
        nextFajrDate = fajr.date;
      } else {
        const tomorrow = getTomorrowSchedule();
        if (tomorrow.fajr.date !== null) {
          nextFajrDate = tomorrow.fajr.date;
        }
      }
      if (nextFajrDate !== null) {
        islamicNight = calculateIslamicNight(
          maghrib.date,
          nextFajrDate,
          evalTime
        ) ?? void 0;
      }
    }
  }
  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    sunset,
    currentPrayer,
    nextPrayer,
    nextPrayerTime,
    countdownMs,
    islamicNight
  };
}

// benchmarks/accuracy-100-locations/calc-batch.ts
import { Coordinates, CalculationMethod, PrayerTimes, Rounding, Madhab as Madhab2 } from "adhan";
function computeLocation(loc, dateStr) {
  const date = /* @__PURE__ */ new Date(`${dateStr}T12:00:00Z`);
  const athanResult = calculatePrayerTimes(loc.lat, loc.lon, date, {
    convention: "MuslimWorldLeague",
    madhab: "Shafi"
  });
  const formatAthanDate = (d) => {
    return d ? d.toISOString() : null;
  };
  const athanEarth = {
    fajr: formatAthanDate(athanResult.fajr.date),
    sunrise: formatAthanDate(athanResult.sunrise.date),
    dhuhr: formatAthanDate(athanResult.dhuhr.date),
    asr: formatAthanDate(athanResult.asr.date),
    maghrib: formatAthanDate(athanResult.maghrib.date),
    isha: formatAthanDate(athanResult.isha.date)
  };
  const athanEarthProvenance = {
    fajr: athanResult.fajr.provenance + (athanResult.fajr.note ? ` (${athanResult.fajr.note})` : ""),
    sunrise: athanResult.sunrise.provenance + (athanResult.sunrise.note ? ` (${athanResult.sunrise.note})` : ""),
    dhuhr: athanResult.dhuhr.provenance,
    asr: athanResult.asr.provenance,
    maghrib: athanResult.maghrib.provenance + (athanResult.maghrib.note ? ` (${athanResult.maghrib.note})` : ""),
    isha: athanResult.isha.provenance + (athanResult.isha.note ? ` (${athanResult.isha.note})` : "")
  };
  let batoulAdhan;
  try {
    const coords = new Coordinates(loc.lat, loc.lon);
    const params = CalculationMethod.MuslimWorldLeague();
    params.madhab = Madhab2.Shafi;
    params.rounding = Rounding.None;
    const pt = new PrayerTimes(coords, date, params);
    batoulAdhan = {
      fajr: pt.fajr ? pt.fajr.toISOString() : null,
      sunrise: pt.sunrise ? pt.sunrise.toISOString() : null,
      dhuhr: pt.dhuhr ? pt.dhuhr.toISOString() : null,
      asr: pt.asr ? pt.asr.toISOString() : null,
      maghrib: pt.maghrib ? pt.maghrib.toISOString() : null,
      isha: pt.isha ? pt.isha.toISOString() : null
    };
  } catch (err) {
    batoulAdhan = {
      fajr: null,
      sunrise: null,
      dhuhr: null,
      asr: null,
      maghrib: null,
      isha: null
    };
  }
  return {
    id: loc.id,
    category: loc.category,
    name: loc.name,
    lat: loc.lat,
    lon: loc.lon,
    athanEarth,
    athanEarthProvenance,
    batoulAdhan
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  import("fs").then((fs) => {
    const inputData = fs.readFileSync(0, "utf-8");
    const { locations, date } = JSON.parse(inputData);
    const results = locations.map((loc) => computeLocation(loc, date));
    process.stdout.write(JSON.stringify(results, null, 2));
  });
}
export {
  computeLocation
};
