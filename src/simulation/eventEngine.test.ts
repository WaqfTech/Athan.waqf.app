import { describe, it, expect } from 'vitest';
import { SimulationClock } from './clock';
import { AdhanEventEngine } from './eventEngine';
import { Settlement } from '../population/loader';
import { calculatePrayerTimes } from '../prayer/calculator';

describe('Simulation Clock', () => {
  it('advances time according to speed multiplier', () => {
    const start = new Date('2026-10-04T12:00:00Z');
    const clock = new SimulationClock(start);
    clock.setSpeed(60); // 60x speed

    // Tick 1 real second
    const newTime = clock.tick(1.0);
    expect(newTime.getTime() - start.getTime()).toBe(60000); // 60 simulated seconds = 1 minute
  });

  it('pauses when speed is 0', () => {
    const start = new Date('2026-10-04T12:00:00Z');
    const clock = new SimulationClock(start);
    clock.setSpeed(0);

    const newTime = clock.tick(5.0);
    expect(newTime.getTime()).toBe(start.getTime());
  });
});

describe('Adhan Event Engine', () => {
  const sampleSettlements: Settlement[] = [
    {
      name: 'Mecca',
      nameAr: 'مكة المكرمة',
      latitude: 21.42,
      longitude: 39.83,
      countryCode: 'SA',
      population: 2000000,
      timezone: 'Asia/Riyadh',
    },
    {
      name: 'Jakarta',
      nameAr: 'جاكرتا',
      latitude: -6.21,
      longitude: 106.85,
      countryCode: 'ID',
      population: 11000000,
      timezone: 'Asia/Jakarta',
    },
  ];

  const engine = new AdhanEventEngine(sampleSettlements, {
    adhanDurationMinutes: 4,
  });

  it('marks settlement active at exact prayer time', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const meccaSched = calculatePrayerTimes(21.42, 39.83, date);

    // Test exactly at Dhuhr
    const activeAtDhuhr = engine.getActiveEvents(meccaSched.dhuhr);
    const meccaEvent = activeAtDhuhr.find((e) => e.settlementIndex === 0);

    expect(meccaEvent).toBeDefined();
    expect(meccaEvent?.prayer).toBe('dhuhr');
    expect(meccaEvent?.progress).toBeCloseTo(0.0, 2);
  });

  it('marks settlement inactive after adhan duration ends', () => {
    const date = new Date('2026-10-04T12:00:00Z');
    const meccaSched = calculatePrayerTimes(21.42, 39.83, date);

    // 5 minutes after Dhuhr (duration is 4 min)
    const afterDhuhr = new Date(meccaSched.dhuhr.getTime() + 5 * 60000);
    const activeAfter = engine.getActiveEvents(afterDhuhr);
    const meccaEvent = activeAfter.find((e) => e.settlementIndex === 0);

    expect(meccaEvent).toBeUndefined();
  });
});
