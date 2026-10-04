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

  it('intelligently balances nearby cities avoiding same-country suburb flooding', () => {
    const regionalData: [string, string, number, number, string, number, string][] = [
      ['Amman', 'عمّان', 31.96, 35.95, 'JO', 1275857, 'Asia/Amman'],
      ['Al Jubayhah', 'الجبيهة', 32.01, 35.9, 'JO', 46834, 'Asia/Amman'], // suburb ~7km
      ['Khuraybat as Suq', 'خريبة السوق', 31.88, 35.92, 'JO', 186158, 'Asia/Amman'], // suburb ~9km
      ['Irbid', 'إربد', 32.56, 35.85, 'JO', 569068, 'Asia/Amman'], // ~67km distinct city
      ['Daraa', 'درعا', 32.62, 36.1, 'SY', 97969, 'Asia/Damascus'], // ~75km Syria
      ['Damascus', 'دمشق', 33.51, 36.29, 'SY', 1569394, 'Asia/Damascus'], // ~175km major Syria
      ['Beirut', 'بيروت', 33.89, 35.5, 'LB', 1916100, 'Asia/Beirut'], // ~220km Lebanon
      ['Cairo', 'القاهرة', 30.04, 31.24, 'EG', 9600000, 'Africa/Cairo'], // ~490km Egypt
      ['Mecca', 'مكة المكرمة', 21.42, 39.83, 'SA', 2000000, 'Asia/Riyadh'], // sacred
    ];

    const regionalIndex = new SettlementSpatialIndex(parseSettlements(regionalData));

    const result = regionalIndex.findIntelligentNearby({
      latitude: 31.955,
      longitude: 35.945,
      visitorCountryCode: 'JO',
      visitorCity: 'Amman',
      targetCount: 5,
      maxHomeCountry: 2,
      maxOtherCountry: 1,
      minClusterDistanceKm: 35,
      excludeCoordinates: [{ lat: 21.42, lon: 39.83, radiusKm: 30 }], // exclude Mecca
    });

    const cityNames = result.map((r) => r.settlement.name);

    // 1. Visitor anchor is Amman
    expect(cityNames[0]).toBe('Amman');

    // 2. Suburbs within 35km (Al Jubayhah, Khuraybat as Suq) must be eliminated
    expect(cityNames).not.toContain('Al Jubayhah');
    expect(cityNames).not.toContain('Khuraybat as Suq');

    // 3. Second Jordanian city should be Irbid (>= 35km)
    expect(cityNames).toContain('Irbid');

    // 4. Max 2 from home country (JO)
    const joCount = result.filter((r) => r.settlement.countryCode === 'JO').length;
    expect(joCount).toBe(2);

    // 5. Excluded sacred cities (Mecca) must not appear
    expect(cityNames).not.toContain('Mecca');

    // 6. Neighboring country representation
    expect(cityNames).toContain('Beirut');
    expect(cityNames).toContain('Cairo');
  });
});
