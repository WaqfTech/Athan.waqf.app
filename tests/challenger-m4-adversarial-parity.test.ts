import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AdhanEventEngine } from '../src/simulation/eventEngine';
import { calculatePrayerTimes } from '../src/prayer/calculator';
import { parseSettlements, CompactSettlementRow, Settlement } from '../src/population/loader';

function loadAllSettlements(): Settlement[] {
  const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
  return parseSettlements(rawData);
}

function selectDiverse500Settlements(allSettlements: Settlement[]): Settlement[] {
  // Extreme / Polar sentinels to ensure full [-60, +80] latitude and [-180, +180] coverage
  const extremeSentinels: Settlement[] = [
    {
      name: 'Alert',
      nameAr: 'أليرت',
      latitude: 82.5018,
      longitude: -62.3481,
      countryCode: 'CA',
      population: 62,
      timezone: 'America/Pangnirtung',
    },
    {
      name: 'Barrow',
      nameAr: 'بارو',
      latitude: 71.2906,
      longitude: -156.7886,
      countryCode: 'US',
      population: 4400,
      timezone: 'America/Anchorage',
    },
    {
      name: 'Resolute',
      nameAr: 'ريزولوت',
      latitude: 74.6973,
      longitude: -94.8297,
      countryCode: 'CA',
      population: 198,
      timezone: 'America/Resolute',
    },
    {
      name: 'Longyearbyen',
      nameAr: 'لونغياربين',
      latitude: 78.2232,
      longitude: 15.6267,
      countryCode: 'SJ',
      population: 2500,
      timezone: 'Arctic/Longyearbyen',
    },
    {
      name: 'Tromso',
      nameAr: 'ترومسو',
      latitude: 69.6492,
      longitude: 18.9553,
      countryCode: 'NO',
      population: 75000,
      timezone: 'Europe/Oslo',
    },
    {
      name: 'Murmansk',
      nameAr: 'مورمانسك',
      latitude: 68.9585,
      longitude: 33.0827,
      countryCode: 'RU',
      population: 295000,
      timezone: 'Europe/Moscow',
    },
    {
      name: 'Reykjavik',
      nameAr: 'ريكيافيك',
      latitude: 64.1466,
      longitude: -21.9426,
      countryCode: 'IS',
      population: 130000,
      timezone: 'Atlantic/Reykjavik',
    },
    {
      name: 'Ushuaia',
      nameAr: 'أوشوايا',
      latitude: -54.8019,
      longitude: -68.303,
      countryCode: 'AR',
      population: 75000,
      timezone: 'America/Argentina/Ushuaia',
    },
    {
      name: 'Punta Arenas',
      nameAr: 'بونتا أريناس',
      latitude: -53.1638,
      longitude: -70.9171,
      countryCode: 'CL',
      population: 130000,
      timezone: 'America/Punta_Arenas',
    },
    {
      name: 'Esperanza Base',
      nameAr: 'قاعدة إسبيرانزا',
      latitude: -63.3975,
      longitude: -56.9972,
      countryCode: 'AQ',
      population: 55,
      timezone: 'Antarctica/Palmer',
    },
    {
      name: 'Antimeridian East',
      nameAr: 'خط التاريخ شرقا',
      latitude: -16.5,
      longitude: 179.99,
      countryCode: 'FJ',
      population: 5000,
      timezone: 'Pacific/Fiji',
    },
    {
      name: 'Antimeridian West',
      nameAr: 'خط التاريخ غربا',
      latitude: -16.5,
      longitude: -179.99,
      countryCode: 'FJ',
      population: 5000,
      timezone: 'Pacific/Fiji',
    },
  ];

  // Defined latitude bands:
  // [-65, -40], [-40, -20], [-20, 0], [0, 20], [20, 40], [40, 60], [60, 85]
  const bands = [
    { min: -65, max: -40, quota: 35 },
    { min: -40, max: -20, quota: 65 },
    { min: -20, max: 0, quota: 70 },
    { min: 0, max: 20, quota: 70 },
    { min: 20, max: 40, quota: 100 },
    { min: 40, max: 60, quota: 100 },
    { min: 60, max: 85, quota: 60 },
  ];

  const selected: Settlement[] = [...extremeSentinels];
  const selectedNames = new Set(selected.map((s) => s.name));

  // Sort candidates by longitude to ensure even longitudinal coverage within each band
  for (const band of bands) {
    const candidates = allSettlements
      .filter((s) => s.latitude >= band.min && s.latitude < band.max && !selectedNames.has(s.name))
      .sort((a, b) => a.longitude - b.longitude);

    if (candidates.length <= band.quota) {
      for (const s of candidates) {
        selected.push(s);
        selectedNames.add(s.name);
      }
    } else {
      const step = candidates.length / band.quota;
      for (let i = 0; i < band.quota; i++) {
        const idx = Math.floor(i * step);
        const s = candidates[idx];
        if (s && !selectedNames.has(s.name)) {
          selected.push(s);
          selectedNames.add(s.name);
        }
      }
    }
  }

  // If still below 500 due to discrete sampling, fill with highest population remaining
  if (selected.length < 500) {
    const remaining = allSettlements
      .filter((s) => !selectedNames.has(s.name))
      .sort((a, b) => b.population - a.population);

    for (const s of remaining) {
      if (selected.length >= 500) break;
      selected.push(s);
      selectedNames.add(s.name);
    }
  }

  return selected.slice(0, 500);
}

describe('Challenger M4: Astronomical Accuracy & Adversarial Parity Test Suite', () => {
  const allSettlements = loadAllSettlements();
  const testSettlements = selectDiverse500Settlements(allSettlements);

  it('selects exactly 500 diverse settlements spanning [-60, +80] lat and [-180, +180] lon', () => {
    expect(testSettlements.length).toBe(500);

    const lats = testSettlements.map((s) => s.latitude);
    const lons = testSettlements.map((s) => s.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    expect(minLat).toBeLessThanOrEqual(-60.0);
    expect(maxLat).toBeGreaterThanOrEqual(80.0);
    expect(minLon).toBeLessThanOrEqual(-170.0);
    expect(maxLon).toBeGreaterThanOrEqual(170.0);

    // Verify presence of southern, northern, and equatorial cities
    const southernCount = testSettlements.filter((s) => s.latitude < -30).length;
    const northernHighCount = testSettlements.filter((s) => s.latitude > 60).length;
    const equatorialCount = testSettlements.filter((s) => Math.abs(s.latitude) < 15).length;

    expect(southernCount).toBeGreaterThanOrEqual(25);
    expect(northernHighCount).toBeGreaterThanOrEqual(25);
    expect(equatorialCount).toBeGreaterThanOrEqual(50);
  });

  describe('Point-by-point Parity vs calculatePrayerTimes across Equinox & Solstices', () => {
    // 3 test days: March 20 (Equinox), June 21 (Summer Solstice), December 21 (Winter Solstice)
    const testDates = [
      '2026-03-20',
      '2026-06-21',
      '2026-12-21',
    ];

    it('verifies point-by-point agreement >= 99.8% across 36,000 evaluations (500 cities x 72 hours)', () => {
      // Create single-settlement engines for exact point-by-point isolation
      const singleEngines = testSettlements.map(
        (s) => new AdhanEventEngine([s], { convention: 'UmmAlQura', madhab: 'Shafi' })
      );

      let totalEvaluations = 0;
      let matchedEvaluations = 0;
      let boundaryDiscretizations = 0;
      let truePositives = 0;
      let trueNegatives = 0;
      let falsePositives = 0;
      let falseNegatives = 0;

      for (const dateStr of testDates) {
        for (let h = 0; h < 24; h++) {
          const timestamp = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00.000Z`);

          for (let i = 0; i < testSettlements.length; i++) {
            const s = testSettlements[i];
            const engine = singleEngines[i];

            const engineResult = engine.countSettlementsInLastThird(timestamp) === 1;

            const sched = calculatePrayerTimes(s.latitude, s.longitude, timestamp, {
              convention: 'UmmAlQura',
              madhab: 'Shafi',
              highLatitudeRule: 'MiddleOfTheNight',
              now: timestamp,
            });
            const groundTruthResult = sched.islamicNight?.isCurrentlyLastThird === true;

            totalEvaluations++;

            if (engineResult === groundTruthResult) {
              matchedEvaluations++;
              if (engineResult) {
                truePositives++;
              } else {
                trueNegatives++;
              }
            } else {
              // Check if discrepancy is due to boundary discretization
              // (e.g. within sub-minute proximity of lastThirdStart or lastThirdEnd)
              let isBoundaryDiscretization = false;
              if (sched.islamicNight) {
                const nowMs = timestamp.getTime();
                const startDiffSec = Math.abs(nowMs - sched.islamicNight.lastThirdStart.getTime()) / 1000;
                const endDiffSec = Math.abs(nowMs - sched.islamicNight.lastThirdEnd.getTime()) / 1000;
                if (startDiffSec <= 60 || endDiffSec <= 60) {
                  isBoundaryDiscretization = true;
                  boundaryDiscretizations++;
                }
              }

              if (engineResult) {
                falsePositives++;
                console.log(`[DISCREPANCY FP] ${s.name} (${s.latitude.toFixed(2)}, ${s.longitude.toFixed(2)}) on ${dateStr} at ${h}:00Z`);
                if (sched.islamicNight) {
                  console.log(`  lastThirdStart: ${sched.islamicNight.lastThirdStart.toISOString()}, lastThirdEnd: ${sched.islamicNight.lastThirdEnd.toISOString()}`);
                }
              } else {
                falseNegatives++;
                console.log(`[DISCREPANCY FN] ${s.name} (${s.latitude.toFixed(2)}, ${s.longitude.toFixed(2)}) on ${dateStr} at ${h}:00Z`);
                if (sched.islamicNight) {
                  console.log(`  lastThirdStart: ${sched.islamicNight.lastThirdStart.toISOString()}, lastThirdEnd: ${sched.islamicNight.lastThirdEnd.toISOString()}`);
                }
              }
            }
          }
        }
      }

      const rawParityPercent = (matchedEvaluations / totalEvaluations) * 100;
      const effectiveParityPercent =
        ((matchedEvaluations + boundaryDiscretizations) / totalEvaluations) * 100;

      console.log(`\n=== Parity Verification Results ===`);
      console.log(`Total evaluations: ${totalEvaluations}`);
      console.log(`Matches: ${matchedEvaluations} (${rawParityPercent.toFixed(3)}%)`);
      console.log(`True Positives: ${truePositives}`);
      console.log(`True Negatives: ${trueNegatives}`);
      console.log(`False Positives: ${falsePositives}`);
      console.log(`False Negatives: ${falseNegatives}`);
      console.log(`Boundary Discretizations: ${boundaryDiscretizations}`);
      console.log(`Effective Parity (with boundary tolerance): ${effectiveParityPercent.toFixed(3)}%`);

      // Agreement must be >= 99.8%
      expect(rawParityPercent).toBeGreaterThanOrEqual(99.8);
      expect(effectiveParityPercent).toBeGreaterThanOrEqual(99.8);
    });
  });

  describe('Zero False Positives in Broad Daylight (Solar Noon)', () => {
    it('confirms 0 false positives out of 1,500 tests at local solar noon across all 500 settlements', () => {
      const singleEngines = testSettlements.map(
        (s) => new AdhanEventEngine([s], { convention: 'UmmAlQura', madhab: 'Shafi' })
      );

      const testDates = ['2026-03-20', '2026-06-21', '2026-12-21'];
      let solarNoonEvaluations = 0;
      let daylightFalsePositives = 0;

      for (const dateStr of testDates) {
        for (let i = 0; i < testSettlements.length; i++) {
          const s = testSettlements[i];
          const engine = singleEngines[i];

          // Determine exact solar noon / Dhuhr for this settlement
          const noonDateCandidate = new Date(`${dateStr}T12:00:00.000Z`);
          const sched = calculatePrayerTimes(s.latitude, s.longitude, noonDateCandidate, {
            convention: 'UmmAlQura',
            madhab: 'Shafi',
          });

          // Use Dhuhr (solar transit) or fallback to local mean noon (12:00 - lon*4min)
          const noonTime =
            sched.dhuhr.date ??
            new Date(noonDateCandidate.getTime() - Math.round(s.longitude * 4 * 60 * 1000));

          solarNoonEvaluations++;
          const inLastThird = engine.countSettlementsInLastThird(noonTime);

          if (inLastThird !== 0) {
            daylightFalsePositives++;
            console.error(
              `Daylight false positive detected: ${s.name} (${s.latitude}, ${s.longitude}) at ${noonTime.toISOString()}`
            );
          }
        }
      }

      console.log(`\n=== Solar Noon Daylight Safety Results ===`);
      console.log(`Solar noon evaluations: ${solarNoonEvaluations}`);
      console.log(`Daylight false positives: ${daylightFalsePositives}`);

      // Must be strictly ZERO
      expect(daylightFalsePositives).toBe(0);
      expect(solarNoonEvaluations).toBe(1500);
    });
  });

  describe('Aggregate Batch Parity on 500-Settlement Engine', () => {
    it('verifies batch engine count strictly matches the sum of single settlement determinations', () => {
      const batchEngine = new AdhanEventEngine(testSettlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      const singleEngines = testSettlements.map(
        (s) => new AdhanEventEngine([s], { convention: 'UmmAlQura', madhab: 'Shafi' })
      );

      // Test across 12 arbitrary hourly snapshots on March 20
      for (let h = 0; h < 24; h += 2) {
        const timestamp = new Date(`2026-03-20T${String(h).padStart(2, '0')}:30:00.000Z`);
        const batchCount = batchEngine.countSettlementsInLastThird(timestamp);

        let sumSingle = 0;
        for (let i = 0; i < singleEngines.length; i++) {
          sumSingle += singleEngines[i].countSettlementsInLastThird(timestamp);
        }

        expect(batchCount).toBe(sumSingle);
      }
    });

    it('verifies 100% parity specifically across extreme polar settlements under midnight sun and polar night', () => {
      const polarCities: Settlement[] = [
        {
          name: 'Alert',
          nameAr: 'أليرت',
          latitude: 82.5018,
          longitude: -62.3481,
          countryCode: 'CA',
          population: 62,
          timezone: 'America/Pangnirtung',
        },
        {
          name: 'Barrow',
          nameAr: 'بارو',
          latitude: 71.2906,
          longitude: -156.7886,
          countryCode: 'US',
          population: 4400,
          timezone: 'America/Anchorage',
        },
        {
          name: 'Resolute',
          nameAr: 'ريزولوت',
          latitude: 74.6973,
          longitude: -94.8297,
          countryCode: 'CA',
          population: 198,
          timezone: 'America/Resolute',
        },
        {
          name: 'Longyearbyen',
          nameAr: 'لونغياربين',
          latitude: 78.2232,
          longitude: 15.6267,
          countryCode: 'SJ',
          population: 2500,
          timezone: 'Arctic/Longyearbyen',
        },
        {
          name: 'Tromso',
          nameAr: 'ترومسو',
          latitude: 69.6492,
          longitude: 18.9553,
          countryCode: 'NO',
          population: 75000,
          timezone: 'Europe/Oslo',
        },
        {
          name: 'Ushuaia',
          nameAr: 'أوشوايا',
          latitude: -54.8019,
          longitude: -68.303,
          countryCode: 'AR',
          population: 75000,
          timezone: 'America/Argentina/Ushuaia',
        },
      ];

      const polarEngine = new AdhanEventEngine(polarCities, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      const singleEngines = polarCities.map(
        (s) =>
          new AdhanEventEngine([s], {
            convention: 'UmmAlQura',
            madhab: 'Shafi',
            highLatitudeRule: 'MiddleOfTheNight',
          })
      );

      const dates = ['2026-06-21', '2026-12-21'];
      for (const d of dates) {
        for (let h = 0; h < 24; h++) {
          const timestamp = new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`);

          for (let i = 0; i < polarCities.length; i++) {
            const city = polarCities[i];
            const engineActive = singleEngines[i].countSettlementsInLastThird(timestamp) === 1;

            const sched = calculatePrayerTimes(city.latitude, city.longitude, timestamp, {
              convention: 'UmmAlQura',
              madhab: 'Shafi',
              highLatitudeRule: 'MiddleOfTheNight',
              now: timestamp,
            });
            const groundTruthActive = sched.islamicNight?.isCurrentlyLastThird === true;

            expect(engineActive).toBe(groundTruthActive);
          }
        }
      }
    });

    it('verifies convention switching and high-latitude rule parity across MuslimWorldLeague, SeventhOfTheNight, and AngleBased', () => {
      const sampleSettlements = testSettlements.slice(0, 50);
      const testConventions: ('MuslimWorldLeague' | 'Egyptian' | 'Karachi')[] = [
        'MuslimWorldLeague',
        'Egyptian',
        'Karachi',
      ];
      const testRules: ('MiddleOfTheNight' | 'SeventhOfTheNight' | 'AngleBased')[] = [
        'MiddleOfTheNight',
        'SeventhOfTheNight',
        'AngleBased',
      ];

      for (const conv of testConventions) {
        for (const rule of testRules) {
          const engine = new AdhanEventEngine(sampleSettlements, {
            convention: conv,
            madhab: 'Shafi',
            highLatitudeRule: rule,
          });

          // Test across 4 timestamps on equinox
          for (const h of [2, 6, 14, 20]) {
            const timestamp = new Date(`2026-03-20T${String(h).padStart(2, '0')}:00:00.000Z`);
            const engineCount = engine.countSettlementsInLastThird(timestamp);

            let expectedCount = 0;
            for (const s of sampleSettlements) {
              const sched = calculatePrayerTimes(s.latitude, s.longitude, timestamp, {
                convention: conv,
                madhab: 'Shafi',
                highLatitudeRule: rule,
                now: timestamp,
              });
              if (sched.islamicNight?.isCurrentlyLastThird) {
                expectedCount++;
              }
            }

            // High parity between batch count and single calculatePrayerTimes determinations
            expect(Math.abs(engineCount - expectedCount)).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });
});

