"use strict";
// Julian Day and Century calculations based on Meeus Astronomical Algorithms
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAYS_PER_CENTURY = exports.MS_PER_DAY = exports.J2000_EPOCH = void 0;
exports.getJulianDay = getJulianDay;
exports.getJulianCenturies = getJulianCenturies;
exports.J2000_EPOCH = 2451545.0;
exports.MS_PER_DAY = 86400000;
exports.DAYS_PER_CENTURY = 36525.0;
/**
 * Compute the Julian Day (JD) from a JavaScript Date in UTC.
 */
function getJulianDay(date) {
    return date.getTime() / exports.MS_PER_DAY + 2440587.5;
}
/**
 * Compute the number of Julian centuries elapsed since J2000.0 (2000-01-01 12:00:00 UTC).
 */
function getJulianCenturies(date) {
    return (getJulianDay(date) - exports.J2000_EPOCH) / exports.DAYS_PER_CENTURY;
}
