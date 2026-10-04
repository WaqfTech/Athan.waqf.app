import { describe, it, expect } from 'vitest';
import { mergeIntervals, computeGlobalAdhanContinuity } from './continuity';
import { Settlement } from '../population/loader';

describe('Adhan Continuity Calculator', () => {
  it('correctly merges overlapping intervals', () => {
    const raw = [
      { startSec: 100, endSec: 300 },
      { startSec: 200, endSec: 400 },
      { startSec: 600, endSec: 700 },
    ];
    const merged = mergeIntervals(raw);
    expect(merged.length).toBe(2);
    expect(merged[0]).toEqual({ startSec: 100, endSec: 400 });
    expect(merged[1]).toEqual({ startSec: 600, endSec: 700 });
  });

  it('computes 24h continuity metrics on global sample settlements', () => {
    const sampleSettlements: Settlement[] = [
      { name: 'Tokyo', nameAr: 'طوكيو', latitude: 35.68, longitude: 139.76, countryCode: 'JP', population: 14000000, timezone: 'Asia/Tokyo' },
      { name: 'Jakarta', nameAr: 'جاكرتا', latitude: -6.21, longitude: 106.85, countryCode: 'ID', population: 11000000, timezone: 'Asia/Jakarta' },
      { name: 'Dhaka', nameAr: 'دكا', latitude: 23.81, longitude: 90.41, countryCode: 'BD', population: 10000000, timezone: 'Asia/Dhaka' },
      { name: 'Lahore', nameAr: 'لاهور', latitude: 31.52, longitude: 74.35, countryCode: 'PK', population: 11000000, timezone: 'Asia/Karachi' },
      { name: 'Dubai', nameAr: 'دبي', latitude: 25.20, longitude: 55.27, countryCode: 'AE', population: 3300000, timezone: 'Asia/Dubai' },
      { name: 'Mecca', nameAr: 'مكة المكرمة', latitude: 21.42, longitude: 39.83, countryCode: 'SA', population: 2000000, timezone: 'Asia/Riyadh' },
      { name: 'Cairo', nameAr: 'القاهرة', latitude: 30.04, longitude: 31.24, countryCode: 'EG', population: 10000000, timezone: 'Africa/Cairo' },
      { name: 'London', nameAr: 'لندن', latitude: 51.51, longitude: -0.13, countryCode: 'GB', population: 9000000, timezone: 'Europe/London' },
      { name: 'Dakar', nameAr: 'داكار', latitude: 14.72, longitude: -17.47, countryCode: 'SN', population: 1000000, timezone: 'Africa/Dakar' },
      { name: 'New York', nameAr: 'نيويورك', latitude: 40.71, longitude: -74.01, countryCode: 'US', population: 8000000, timezone: 'America/New_York' },
      { name: 'Honolulu', nameAr: 'هونولولو', latitude: 21.31, longitude: -157.86, countryCode: 'US', population: 350000, timezone: 'Pacific/Honolulu' },
    ];

    const date = new Date('2026-10-04T12:00:00Z');
    const stats = computeGlobalAdhanContinuity(sampleSettlements, date, {
      adhanDurationMinutes: 4,
    });

    expect(stats.settlementCount).toBe(11);
    expect(stats.coveragePercent).toBeGreaterThan(0);
    expect(stats.coveragePercent).toBeLessThanOrEqual(100);
    expect(stats.timelineBins.length).toBe(288);
    expect(stats.peakConcurrentAdhans).toBeGreaterThan(0);
    expect(stats.longestGapSeconds).toBeGreaterThan(0);
  });
});
