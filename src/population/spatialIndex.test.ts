import { describe, it, expect } from 'vitest';
import { parseSettlements } from './loader';
import { SettlementSpatialIndex } from './spatialIndex';

describe('Settlement spatial index', () => {
  const sampleData: [string, string, number, number, string, number, string][] = [
    ['Mecca', 'مكة المكرمة', 21.42, 39.83, 'SA', 2000000, 'Asia/Riyadh'],
    ['Medina', 'المدينة المنورة', 24.47, 39.61, 'SA', 1500000, 'Asia/Riyadh'],
    ['Cairo', 'القاهرة', 30.04, 31.24, 'EG', 10000000, 'Africa/Cairo'],
    ['London', 'لندن', 51.51, -0.13, 'GB', 9000000, 'Europe/London'],
    ['Tokyo', 'طوكيو', 35.68, 139.76, 'JP', 14000000, 'Asia/Tokyo'],
    ['Jakarta', 'جاكرتا', -6.21, 106.85, 'ID', 11000000, 'Asia/Jakarta'],
  ];

  const settlements = parseSettlements(sampleData);
  const index = new SettlementSpatialIndex(settlements);

  it('correctly finds nearest settlement to given coordinates', () => {
    // Coordinate near Makkah
    const query = { lat: 21.45, lon: 39.81 };
    const nearest = index.findNearest(query.lat, query.lon, 5);

    expect(nearest).not.toBeNull();
    expect(nearest?.settlement.name).toBe('Mecca');
    expect(nearest?.distanceDeg).toBeLessThan(0.1);
  });

  it('finds nearest settlement across Greenwich and Prime Meridian', () => {
    // Coordinate in London suburbs
    const query = { lat: 51.55, lon: -0.15 };
    const nearest = index.findNearest(query.lat, query.lon, 2);

    expect(nearest).not.toBeNull();
    expect(nearest?.settlement.name).toBe('London');
  });

  it('searches settlements by English and Arabic text query', () => {
    const enMatch = index.searchByName('cairo');
    expect(enMatch.length).toBe(1);
    expect(enMatch[0].name).toBe('Cairo');

    const arMatch = index.searchByName('المدينة');
    expect(arMatch.length).toBe(1);
    expect(arMatch[0].name).toBe('Medina');
  });

  it('finds K nearest settlements sorted by distance', () => {
    // Coordinate in Middle East (Jordan/Red Sea)
    const query = { lat: 25.0, lon: 36.0 };
    const kNearest = index.findKNearest(query.lat, query.lon, 3);

    expect(kNearest.length).toBe(3);
    // Closest should be Medina, followed by Mecca or Cairo
    expect(['Medina', 'Mecca', 'Cairo']).toContain(kNearest[0].settlement.name);
    // Must be sorted in ascending order of distance
    expect(kNearest[0].distanceDeg).toBeLessThanOrEqual(kNearest[1].distanceDeg);
    expect(kNearest[1].distanceDeg).toBeLessThanOrEqual(kNearest[2].distanceDeg);
  });
});
