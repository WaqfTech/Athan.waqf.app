import { describe, it, expect } from 'vitest';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
} from '../../src/prayer/conventions';
import { calculatePrayerTimes } from '../../src/prayer/calculator';
import { generateGlobalPrayerFronts } from '../../src/prayer/contours';
import { getSubsolarPoint } from '../../src/astronomy/solar';
import { computeGlobalAdhanContinuity } from '../../src/simulation/continuity';
import { AdhanEventEngine } from '../../src/simulation/eventEngine';
import { Settlement } from '../../src/population/loader';

describe('Tier 3: Cross-Feature Combinations', () => {
  const conventions = Object.keys(CALCULATION_CONVENTIONS) as CalculationConventionName[];
  const madhabs: Madhab[] = ['Shafi', 'Hanafi'];
  const highLatitudeRules: HighLatitudeRule[] = ['MiddleOfTheNight', 'SeventhOfTheNight', 'AngleBased'];

  function toDate(entry: unknown): Date | null {
    if (!entry) return null;
    if (entry instanceof Date) return entry;
    if (typeof entry === 'object' && 'date' in (entry as Record<string, unknown>)) {
      const d = (entry as Record<string, unknown>).date;
      return d instanceof Date ? d : null;
    }
    return null;
  }

  // Sample settlement test set
  const sampleSettlements: Settlement[] = [
    { name: 'Makkah', nameAr: 'مكة', latitude: 21.42, longitude: 39.83, population: 2000000, countryCode: 'SA', timezone: 'Asia/Riyadh' },
    { name: 'Cairo', nameAr: 'القاهرة', latitude: 30.04, longitude: 31.24, population: 10000000, countryCode: 'EG', timezone: 'Africa/Cairo' },
    { name: 'Istanbul', nameAr: 'إسطنبول', latitude: 41.01, longitude: 28.98, population: 15000000, countryCode: 'TR', timezone: 'Europe/Istanbul' },
    { name: 'Karachi', nameAr: 'كراتشي', latitude: 24.86, longitude: 67.00, population: 16000000, countryCode: 'PK', timezone: 'Asia/Karachi' },
    { name: 'Jakarta', nameAr: 'جاكرتا', latitude: -6.21, longitude: 106.85, population: 11000000, countryCode: 'ID', timezone: 'Asia/Jakarta' },
  ];

  // --------------------------------------------------------------------------
  // C1: Pairwise Convention x Madhab Combinations (10 conventions x 2 madhabs)
  // --------------------------------------------------------------------------
  describe('C1: Pairwise Convention x Madhab Combinations', () => {
    const testDate = new Date('2026-04-15T12:00:00Z');
    const lat = 24.47; // Madinah
    const lon = 39.61;

    for (const conv of conventions) {
      it(`C1.${conv}: Shafi schedule preserves chronological prayer order`, () => {
        const sched = calculatePrayerTimes(lat, lon, testDate, { convention: conv, madhab: 'Shafi' });
        const fajr = toDate(sched.fajr);
        const sunrise = toDate(sched.sunrise);
        const dhuhr = toDate(sched.dhuhr);
        const asr = toDate(sched.asr);
        const maghrib = toDate(sched.maghrib);
        const isha = toDate(sched.isha);

        expect(fajr).not.toBeNull();
        expect(sunrise).not.toBeNull();
        expect(dhuhr).not.toBeNull();
        expect(asr).not.toBeNull();
        expect(maghrib).not.toBeNull();
        expect(isha).not.toBeNull();

        if (fajr && sunrise && dhuhr && asr && maghrib && isha) {
          expect(+fajr).toBeLessThan(+sunrise);
          expect(+sunrise).toBeLessThan(+dhuhr);
          expect(+dhuhr).toBeLessThan(+asr);
          expect(+asr).toBeLessThan(+maghrib);
          expect(+maghrib).toBeLessThan(+isha);
        }
      });

      it(`C1.${conv}: Hanafi Asr occurs strictly after Shafi Asr`, () => {
        const shafi = calculatePrayerTimes(lat, lon, testDate, { convention: conv, madhab: 'Shafi' });
        const hanafi = calculatePrayerTimes(lat, lon, testDate, { convention: conv, madhab: 'Hanafi' });
        const asrS = toDate(shafi.asr);
        const asrH = toDate(hanafi.asr);
        expect(asrS).not.toBeNull();
        expect(asrH).not.toBeNull();
        if (asrS && asrH) {
          expect(+asrH).toBeGreaterThan(+asrS);
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  // C2: High-Latitude Rule x Convention Interactions
  // --------------------------------------------------------------------------
  describe('C2: High-Latitude Rule x Convention Interactions (London Summer)', () => {
    const londonDate = new Date('2026-06-21T12:00:00Z');
    const londonLat = 51.51;
    const londonLon = -0.13;

    it('C2.1: MuslimWorldLeague across all 3 high-latitude rules', () => {
      for (const rule of highLatitudeRules) {
        const sched = calculatePrayerTimes(londonLat, londonLon, londonDate, {
          convention: 'MuslimWorldLeague',
          highLatitudeRule: rule,
        });
        const fajr = toDate(sched.fajr);
        const isha = toDate(sched.isha);
        expect(fajr).not.toBeNull();
        expect(isha).not.toBeNull();
      }
    });

    it('C2.2: Egyptian convention across all 3 high-latitude rules', () => {
      for (const rule of highLatitudeRules) {
        const sched = calculatePrayerTimes(londonLat, londonLon, londonDate, {
          convention: 'Egyptian',
          highLatitudeRule: rule,
        });
        expect(toDate(sched.fajr)).not.toBeNull();
        expect(toDate(sched.isha)).not.toBeNull();
      }
    });

    it('C2.3: Karachi convention across all 3 high-latitude rules', () => {
      for (const rule of highLatitudeRules) {
        const sched = calculatePrayerTimes(londonLat, londonLon, londonDate, {
          convention: 'Karachi',
          highLatitudeRule: rule,
        });
        expect(toDate(sched.fajr)).not.toBeNull();
        expect(toDate(sched.isha)).not.toBeNull();
      }
    });

    it('C2.4: Turkey convention across all 3 high-latitude rules', () => {
      for (const rule of highLatitudeRules) {
        const sched = calculatePrayerTimes(londonLat, londonLon, londonDate, {
          convention: 'Turkey',
          highLatitudeRule: rule,
        });
        expect(toDate(sched.fajr)).not.toBeNull();
        expect(toDate(sched.isha)).not.toBeNull();
      }
    });

    it('C2.5: NorthAmerica convention across all 3 high-latitude rules', () => {
      for (const rule of highLatitudeRules) {
        const sched = calculatePrayerTimes(londonLat, londonLon, londonDate, {
          convention: 'NorthAmerica',
          highLatitudeRule: rule,
        });
        expect(toDate(sched.fajr)).not.toBeNull();
        expect(toDate(sched.isha)).not.toBeNull();
      }
    });
  });

  // --------------------------------------------------------------------------
  // C3: Front Generation x Madhab (Shafi vs Hanafi Asr Fronts)
  // --------------------------------------------------------------------------
  describe('C3: Front Generation x Madhab', () => {
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolar = getSubsolarPoint(equinox);

    it('C3.1: Shafi Asr front is non-empty and has correct geometry buffer length', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Shafi', 1);
      expect(fronts.asr.pointCount).toBeGreaterThan(0);
      expect(fronts.asr.positions.length).toBe(fronts.asr.pointCount * 3);
    });

    it('C3.2: Hanafi Asr front is non-empty and has correct geometry buffer length', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Hanafi', 1);
      expect(fronts.asr.pointCount).toBeGreaterThan(0);
      expect(fronts.asr.positions.length).toBe(fronts.asr.pointCount * 3);
    });

    it('C3.3: Shafi and Hanafi front point counts are within valid tessellation limits', () => {
      const frontsShafi = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Shafi', 1);
      const frontsHanafi = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Hanafi', 1);
      expect(frontsShafi.asr.pointCount).toBeGreaterThan(10);
      expect(frontsHanafi.asr.pointCount).toBeGreaterThan(10);
    });

    it('C3.4: Fajr and Maghrib fronts are invariant to Madhab selection', () => {
      const frontsShafi = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Shafi', 1);
      const frontsHanafi = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Hanafi', 1);
      expect(frontsShafi.fajr.pointCount).toBe(frontsHanafi.fajr.pointCount);
      expect(frontsShafi.maghrib.pointCount).toBe(frontsHanafi.maghrib.pointCount);
    });

    it('C3.5: Sunrise and Isha fronts are invariant to Madhab selection', () => {
      const frontsShafi = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Shafi', 1);
      const frontsHanafi = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.MuslimWorldLeague, 'Hanafi', 1);
      expect(frontsShafi.sunrise.pointCount).toBe(frontsHanafi.sunrise.pointCount);
      expect(frontsShafi.isha.pointCount).toBe(frontsHanafi.isha.pointCount);
    });
  });

  // --------------------------------------------------------------------------
  // C4: Front Generation x Conventions (Fixed-Interval vs Angle-Based Isha)
  // --------------------------------------------------------------------------
  describe('C4: Front Generation x Conventions', () => {
    const equinox = new Date('2026-03-20T12:00:00Z');
    const subsolar = getSubsolarPoint(equinox);

    it('C4.1: UmmAlQura produces valid global fronts', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.UmmAlQura, 'Shafi', 1);
      expect(fronts.fajr.pointCount).toBeGreaterThan(0);
      expect(fronts.isha.pointCount).toBeGreaterThan(0);
    });

    it('C4.2: Egyptian convention produces valid global fronts', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.Egyptian, 'Shafi', 1);
      expect(fronts.fajr.pointCount).toBeGreaterThan(0);
      expect(fronts.isha.pointCount).toBeGreaterThan(0);
    });

    it('C4.3: Karachi convention produces valid global fronts', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.Karachi, 'Shafi', 1);
      expect(fronts.fajr.pointCount).toBeGreaterThan(0);
      expect(fronts.isha.pointCount).toBeGreaterThan(0);
    });

    it('C4.4: Dubai convention produces valid global fronts', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.Dubai, 'Shafi', 1);
      expect(fronts.fajr.pointCount).toBeGreaterThan(0);
      expect(fronts.isha.pointCount).toBeGreaterThan(0);
    });

    it('C4.5: Qatar convention produces valid global fronts', () => {
      const fronts = generateGlobalPrayerFronts(subsolar, CALCULATION_CONVENTIONS.Qatar, 'Shafi', 1);
      expect(fronts.fajr.pointCount).toBeGreaterThan(0);
      expect(fronts.isha.pointCount).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // C5: Continuity Stats x Convention x Duration Combinations
  // --------------------------------------------------------------------------
  describe('C5: Continuity Stats x Convention x Duration', () => {
    const testDate = new Date('2026-04-15T12:00:00Z');

    it('C5.1: Increasing duration increases total covered seconds monotonically', () => {
      const s3 = computeGlobalAdhanContinuity(sampleSettlements, testDate, { adhanDurationMinutes: 3 });
      const s4 = computeGlobalAdhanContinuity(sampleSettlements, testDate, { adhanDurationMinutes: 4 });
      const s5 = computeGlobalAdhanContinuity(sampleSettlements, testDate, { adhanDurationMinutes: 5 });

      expect(s4.coveredSeconds).toBeGreaterThan(s3.coveredSeconds);
      expect(s5.coveredSeconds).toBeGreaterThan(s4.coveredSeconds);
    });

    it('C5.2: Increasing duration decreases or keeps equal longest gap seconds', () => {
      const s3 = computeGlobalAdhanContinuity(sampleSettlements, testDate, { adhanDurationMinutes: 3 });
      const s5 = computeGlobalAdhanContinuity(sampleSettlements, testDate, { adhanDurationMinutes: 5 });
      expect(s5.longestGapSeconds).toBeLessThanOrEqual(s3.longestGapSeconds);
    });

    it('C5.3: Hanafi madhab shifts Asr intervals without corrupting continuity statistics', () => {
      const sShafi = computeGlobalAdhanContinuity(sampleSettlements, testDate, { madhab: 'Shafi' });
      const sHanafi = computeGlobalAdhanContinuity(sampleSettlements, testDate, { madhab: 'Hanafi' });
      expect(sShafi.settlementCount).toBe(5);
      expect(sHanafi.settlementCount).toBe(5);
      expect(sShafi.coveragePercent).toBeGreaterThan(0);
      expect(sHanafi.coveragePercent).toBeGreaterThan(0);
    });

    it('C5.4: UmmAlQura convention computes valid continuity with 90 min fixed Isha', () => {
      const stats = computeGlobalAdhanContinuity(sampleSettlements, testDate, { convention: 'UmmAlQura' });
      expect(stats.convention).toBe('UmmAlQura');
      expect(stats.coveredSeconds).toBeGreaterThan(0);
    });

    it('C5.5: Event engine initializes and processes settlements under custom conventions', () => {
      const engine = new AdhanEventEngine(sampleSettlements);
      const events = engine.getActiveEvents(testDate);
      expect(Array.isArray(events)).toBe(true);
    });
  });
});
