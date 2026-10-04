import { describe, expect, it } from 'vitest';
import { parseSettlements } from './loader';

describe('Settlement loader and Palestinian mapping', () => {
  it('maps Israeli settlements to historical Palestinian names and PS country code', () => {
    const rawData: [string, string, number, number, string, number, string][] = [
      ['Jerusalem', 'القدس', 31.77, 35.23, 'IL', 971800, 'Asia/Jerusalem'],
      ['Tel Aviv', 'Tel Aviv', 32.08, 34.78, 'IL', 432892, 'Asia/Jerusalem'],
      ['Petaẖ Tiqva', 'بتاح تكفا', 32.09, 34.88, 'IL', 253529, 'Asia/Jerusalem'],
      ['Haifa', 'جحفية', 32.82, 34.99, 'IL', 285316, 'Asia/Jerusalem'],
      ['Eilat', 'آيلة', 29.56, 34.95, 'IL', 52299, 'Asia/Jerusalem'],
      ['Amman', 'عَمّان', 31.95, 35.93, 'JO', 4000000, 'Asia/Amman'],
    ];

    const parsed = parseSettlements(rawData);

    expect(parsed[0].name).toBe('Al-Quds');
    expect(parsed[0].nameAr).toBe('القدس');
    expect(parsed[0].countryCode).toBe('PS');
    expect(parsed[0].timezone).toBe('Asia/Hebron');

    expect(parsed[1].name).toBe('Yafa');
    expect(parsed[1].nameAr).toBe('يافا');
    expect(parsed[1].countryCode).toBe('PS');
    expect(parsed[1].timezone).toBe('Asia/Hebron');

    expect(parsed[2].name).toBe('Mulabbis');
    expect(parsed[2].nameAr).toBe('ملبّس');
    expect(parsed[2].countryCode).toBe('PS');

    expect(parsed[3].name).toBe('Haifa');
    expect(parsed[3].nameAr).toBe('حيفا');
    expect(parsed[3].countryCode).toBe('PS');

    expect(parsed[4].name).toBe('Umm ar-Rashrash');
    expect(parsed[4].nameAr).toBe('أم الرشراش');
    expect(parsed[4].countryCode).toBe('PS');

    // Unrelated countries remain untouched
    expect(parsed[5].name).toBe('Amman');
    expect(parsed[5].countryCode).toBe('JO');

    // Assert zero IL country codes remain
    const ilCount = parsed.filter((s) => s.countryCode === 'IL').length;
    expect(ilCount).toBe(0);
  });
});
