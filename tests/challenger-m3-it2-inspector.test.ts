import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveObserverCivilDate,
  getInspectorSchedule,
  createInspectorPanel,
} from '../src/ui/inspector';
import { calculatePrayerTimes } from '../src/prayer/calculator';
import { createAppStore, AppStore, AppConfig } from '../src/ui/state';
import { Settlement } from '../population/loader';
import {
  CalculationConventionName,
  CALCULATION_CONVENTIONS,
  Madhab,
  HighLatitudeRule,
} from '../src/prayer/conventions';

/**
 * Deterministic Linear Congruential Generator (LCG) for reproducible fuzzing.
 */
class SeededRng {
  private state: number;
  constructor(seed = 987654321) {
    this.state = seed;
  }
  next(): number {
    this.state = (1103515245 * this.state + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min));
  }
  pick<T>(items: readonly T[]): T {
    return items[this.nextInt(0, items.length)];
  }
}

describe('Challenger M3 It2: Inspector & AppStore Empirical Challenge', () => {
  // --------------------------------------------------------------------------
  // Group 1: Tokyo Witness W06 Local Civil Date & Active Fajr Verification
  // --------------------------------------------------------------------------
  describe('Group 1: Tokyo Witness W06 Verification (lat 35.68, lon 139.76, Asia/Tokyo)', () => {
    const tokyoLat = 35.68;
    const tokyoLon = 139.76;
    const tokyoTz = 'Asia/Tokyo';
    const witnessInstant = new Date('2026-10-04T19:12:01.579Z');

    const tokyoSettlement: Settlement = {
      name: 'Tokyo',
      nameAr: 'طوكيو',
      latitude: tokyoLat,
      longitude: tokyoLon,
      countryCode: 'JP',
      population: 14000000,
      timezone: tokyoTz,
    };

    it('empirically verifies local civil date resolves to 2026-10-05', () => {
      const civilDate = resolveObserverCivilDate(witnessInstant, tokyoLon, tokyoTz);

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9); // October (0-indexed)
      expect(civilDate.getUTCDate()).toBe(5);
      expect(civilDate.getUTCHours()).toBe(12);
    });

    it('empirically verifies schedule yields currentPrayer fajr and positive countdown', () => {
      const sched = getInspectorSchedule(tokyoLat, tokyoLon, witnessInstant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: tokyoTz,
      });

      expect(sched.currentPrayer).toBe('fajr');
      expect(sched.nextPrayer).toBe('dhuhr');
      expect(sched.countdownMs).not.toBeNull();
      expect(sched.countdownMs!).toBeGreaterThan(0);

      // Verify Fajr start time is before or at witness instant, and sunrise is after
      expect(sched.fajr.date).not.toBeNull();
      expect(sched.sunrise.date).not.toBeNull();
      expect(sched.fajr.date!.getTime()).toBeLessThanOrEqual(witnessInstant.getTime());
      expect(sched.sunrise.date!.getTime()).toBeGreaterThan(witnessInstant.getTime());

      // Countdown must equal difference between next prayer (Dhuhr) and witness instant
      expect(sched.dhuhr.date).not.toBeNull();
      const expectedCountdownMs = sched.dhuhr.date!.getTime() - witnessInstant.getTime();
      expect(sched.countdownMs).toBe(expectedCountdownMs);
    });

    it('verifies exact millisecond boundary transition from isha to fajr for Tokyo', () => {
      const schedOct5 = calculatePrayerTimes(tokyoLat, tokyoLon, new Date('2026-10-05T12:00:00Z'), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const fajrStartMs = schedOct5.fajr.date!.getTime();

      // 1 ms before Fajr -> currentPrayer is isha, next is fajr
      const schedBefore = getInspectorSchedule(tokyoLat, tokyoLon, new Date(fajrStartMs - 1), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: tokyoTz,
      });
      expect(schedBefore.currentPrayer).toBe('isha');
      expect(schedBefore.nextPrayer).toBe('fajr');
      expect(schedBefore.countdownMs).toBe(1);

      // Exactly at Fajr -> currentPrayer is fajr, next is dhuhr
      const schedAt = getInspectorSchedule(tokyoLat, tokyoLon, new Date(fajrStartMs), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: tokyoTz,
      });
      expect(schedAt.currentPrayer).toBe('fajr');
      expect(schedAt.nextPrayer).toBe('dhuhr');
      expect(schedAt.countdownMs).toBeGreaterThan(0);
    });

    it('renders inspector DOM component with active Fajr row and valid local time', () => {
      const originalDocument = globalThis.document;
      const fakeElement = {
        className: '',
        style: { display: '' },
        innerHTML: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        querySelector: vi.fn(() => null),
      };
      globalThis.document = {
        createElement: vi.fn(() => fakeElement),
      } as unknown as Document;

      try {
        const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
        panel.inspectSettlement(tokyoSettlement, witnessInstant);

        const html = fakeElement.innerHTML;
        // Verify Fajr row is marked active
        expect(html).toContain('inspector-prayer-row active');
        expect(html).toContain('Fajr');

        // Other prayer rows must not be active
        expect(html).toContain('inspector-prayer-row" style="--prayer-color: var(--color-sunrise);');
        expect(html).toContain('inspector-prayer-row " style="--prayer-color: var(--color-dhuhr);');
        expect(html).toContain('inspector-prayer-row " style="--prayer-color: var(--color-asr);');
        expect(html).toContain('inspector-prayer-row " style="--prayer-color: var(--color-maghrib);');
        expect(html).toContain('inspector-prayer-row " style="--prayer-color: var(--color-isha);');

        // Verify city header and local time
        expect(html).toContain('Tokyo, JP');
        expect(html).toContain('04:12:01');
      } finally {
        globalThis.document = originalDocument;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Group 2: Honolulu Local Civil Date & Active Asr Verification
  // --------------------------------------------------------------------------
  describe('Group 2: Honolulu Verification (lat 21.30, lon -157.85, Pacific/Honolulu)', () => {
    const hnlLat = 21.30;
    const hnlLon = -157.85;
    const hnlTz = 'Pacific/Honolulu';
    const queryInstant = new Date('2026-10-05T02:00:00.000Z');

    const hnlSettlement: Settlement = {
      name: 'Honolulu',
      nameAr: 'هونولولو',
      latitude: hnlLat,
      longitude: hnlLon,
      countryCode: 'US',
      population: 350000,
      timezone: hnlTz,
    };

    it('empirically verifies local civil date resolves to 2026-10-04', () => {
      const civilDate = resolveObserverCivilDate(queryInstant, hnlLon, hnlTz);

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9); // October (0-indexed)
      expect(civilDate.getUTCDate()).toBe(4);
      expect(civilDate.getUTCHours()).toBe(12);
    });

    it('empirically verifies schedule yields currentPrayer asr and positive countdown', () => {
      const sched = getInspectorSchedule(hnlLat, hnlLon, queryInstant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: hnlTz,
      });

      expect(sched.currentPrayer).toBe('asr');
      expect(sched.nextPrayer).toBe('maghrib');
      expect(sched.countdownMs).not.toBeNull();
      expect(sched.countdownMs!).toBeGreaterThan(0);

      // Verify Asr start time is before query instant, and Maghrib is after
      expect(sched.asr.date).not.toBeNull();
      expect(sched.maghrib.date).not.toBeNull();
      expect(sched.asr.date!.getTime()).toBeLessThanOrEqual(queryInstant.getTime());
      expect(sched.maghrib.date!.getTime()).toBeGreaterThan(queryInstant.getTime());

      // Countdown must equal difference between Maghrib and query instant
      const expectedCountdownMs = sched.maghrib.date!.getTime() - queryInstant.getTime();
      expect(sched.countdownMs).toBe(expectedCountdownMs);
    });

    it('renders inspector DOM component with active Asr row and valid local time', () => {
      const originalDocument = globalThis.document;
      const fakeElement = {
        className: '',
        style: { display: '' },
        innerHTML: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        querySelector: vi.fn(() => null),
      };
      globalThis.document = {
        createElement: vi.fn(() => fakeElement),
      } as unknown as Document;

      try {
        const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
        panel.inspectSettlement(hnlSettlement, queryInstant);

        const html = fakeElement.innerHTML;
        // Verify Asr row is marked active
        expect(html).toContain('inspector-prayer-row active');
        expect(html).toContain('Asr');

        // Verify city header and local afternoon time (16:00:00 HST)
        expect(html).toContain('Honolulu, US');
        expect(html).toContain('16:00:00');
      } finally {
        globalThis.document = originalDocument;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Group 3: Solar Longitude Offset Fallback across Arbitrary Coordinates
  // --------------------------------------------------------------------------
  describe('Group 3: Arbitrary Coordinates without Timezone Metadata', () => {
    // Exact mathematical reference model for solar longitude civil date
    function computeExpectedCivilDate(instant: Date, lon: number): {
      year: number;
      month: number;
      day: number;
    } {
      const offsetMs = Math.round((lon / 15) * 3600000);
      const local = new Date(instant.getTime() + offsetMs);
      return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth(),
        day: local.getUTCDate(),
      };
    }

    const testLongitudes = [120, -120, 179, -179, 179.9, -179.9, 0, 45, -45, 90, -90];
    const testInstants = [
      new Date('2026-10-04T12:00:00.000Z'),
      new Date('2026-10-04T19:12:01.579Z'),
      new Date('2026-10-04T23:59:59.000Z'),
      new Date('2026-10-05T00:00:01.000Z'),
      new Date('2026-10-05T02:00:00.000Z'),
      new Date('2026-10-05T07:59:59.000Z'),
      new Date('2026-10-05T08:00:01.000Z'),
      new Date('2026-10-05T12:03:59.000Z'),
      new Date('2026-10-05T12:04:01.000Z'),
    ];

    it('verifies solar longitude fallback matches ground truth across longitudes and instants', () => {
      for (const lon of testLongitudes) {
        for (const instant of testInstants) {
          const expected = computeExpectedCivilDate(instant, lon);
          const resolved = resolveObserverCivilDate(instant, lon);

          expect(resolved.getUTCFullYear()).toBe(expected.year);
          expect(resolved.getUTCMonth()).toBe(expected.month);
          expect(resolved.getUTCDate()).toBe(expected.day);
          expect(resolved.getUTCHours()).toBe(12); // standard noon reference
        }
      }
    });

    it('verifies specific required coordinates lon +120, -120, +179, -179', () => {
      const instant = new Date('2026-10-05T02:00:00.000Z');

      // lon +120: offset is +8h -> 02:00 + 8h = 10:00 on 2026-10-05
      const datePlus120 = resolveObserverCivilDate(instant, 120);
      expect(datePlus120.getUTCDate()).toBe(5);

      // lon -120: offset is -8h -> 02:00 - 8h = 18:00 on 2026-10-04
      const dateMinus120 = resolveObserverCivilDate(instant, -120);
      expect(dateMinus120.getUTCDate()).toBe(4);

      // lon +179: offset is +11h 56m -> 02:00 + 11h 56m = 13:56 on 2026-10-05
      const datePlus179 = resolveObserverCivilDate(instant, 179);
      expect(datePlus179.getUTCDate()).toBe(5);

      // lon -179: offset is -11h 56m -> 02:00 - 11h 56m = 14:04 on 2026-10-04
      const dateMinus179 = resolveObserverCivilDate(instant, -179);
      expect(dateMinus179.getUTCDate()).toBe(4);
    });

    it('falls back gracefully to solar longitude when timezone is invalid or malformed', () => {
      const instant = new Date('2026-10-04T19:12:01.579Z');
      const malformedTimezones = [
        'Invalid/Timezone',
        'Mars/Curiosity',
        'UTC+9', // not an IANA timezone identifier
        'America/NonExistentCity',
        '',
      ];

      for (const tz of malformedTimezones) {
        const resolved = resolveObserverCivilDate(instant, 139.76, tz);
        // Tokyo longitude solar offset yields 2026-10-05
        expect(resolved.getUTCFullYear()).toBe(2026);
        expect(resolved.getUTCMonth()).toBe(9);
        expect(resolved.getUTCDate()).toBe(5);
      }
    });

    it('computes full inspector schedule for raw geographic coordinates without timezone', () => {
      // Tokyo coordinates without timezone at witness instant
      const tokyoCoordsSched = getInspectorSchedule(35.68, 139.76, new Date('2026-10-04T19:12:01.579Z'));
      expect(tokyoCoordsSched.currentPrayer).toBe('fajr');
      expect(tokyoCoordsSched.countdownMs).toBeGreaterThan(0);

      // Honolulu coordinates without timezone at query instant
      const hnlCoordsSched = getInspectorSchedule(21.30, -157.85, new Date('2026-10-05T02:00:00.000Z'));
      expect(hnlCoordsSched.currentPrayer).toBe('asr');
      expect(hnlCoordsSched.countdownMs).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Group 4: Adversarial Fuzzing of AppStore updateConfig Idempotency
  // --------------------------------------------------------------------------
  describe('Group 4: Adversarial Fuzzing of AppStore updateConfig', () => {
    it('verifies updating with identical values increments revision 0 times and notifies 0 times', () => {
      const store = createAppStore({
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
        adhanDurationMinutes: 4,
        mapStyle: 'satellite',
      });

      const initialRev = store.getRevision();
      const stateListener = vi.fn();
      const configListener = vi.fn();

      store.subscribe(stateListener);
      store.subscribeConfig(configListener);

      // 1,000 consecutive identical updates
      for (let i = 0; i < 1000; i++) {
        const result = store.updateConfig({
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          highLatitudeRule: 'MiddleOfTheNight',
          adhanDurationMinutes: 4,
          mapStyle: 'satellite',
        });
        expect(result).toBe(true);
      }

      expect(store.getRevision()).toBe(initialRev);
      expect(stateListener).toHaveBeenCalledTimes(0);
      expect(configListener).toHaveBeenCalledTimes(0);
    });

    it('verifies updating with actual changes increments revision exactly once and notifies once', () => {
      const store = createAppStore({
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      const stateListener = vi.fn();
      const configListener = vi.fn();

      store.subscribe(stateListener);
      store.subscribeConfig(configListener);

      // Change 1: madhab
      const res1 = store.updateConfig({ madhab: 'Hanafi' });
      expect(res1).toBe(true);
      expect(store.getRevision()).toBe(2);
      expect(stateListener).toHaveBeenCalledTimes(1);
      expect(configListener).toHaveBeenCalledTimes(1);
      expect(configListener).toHaveBeenLastCalledWith(store.getConfig(), 2);

      // Identical update: no increment
      const resNoop = store.updateConfig({ madhab: 'Hanafi' });
      expect(resNoop).toBe(true);
      expect(store.getRevision()).toBe(2);
      expect(stateListener).toHaveBeenCalledTimes(1);
      expect(configListener).toHaveBeenCalledTimes(1);

      // Change 2: multi-field update (convention + mapStyle)
      const res2 = store.updateConfig({
        convention: 'MuslimWorldLeague',
        mapStyle: 'roadmap',
      });
      expect(res2).toBe(true);
      expect(store.getRevision()).toBe(3);
      expect(stateListener).toHaveBeenCalledTimes(2);
      expect(configListener).toHaveBeenCalledTimes(2);
      expect(configListener).toHaveBeenLastCalledWith(store.getConfig(), 3);
    });

    it('verifies partial updates with mixed identical and novel fields increment exactly once', () => {
      const store = createAppStore({
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      const stateListener = vi.fn();
      const configListener = vi.fn();
      store.subscribe(stateListener);
      store.subscribeConfig(configListener);

      // Partial object contains 3 identical fields and 1 changed field
      const result = store.updateConfig({
        convention: 'UmmAlQura', // unchanged
        madhab: 'Hanafi',        // changed
        adhanDurationMinutes: 4, // unchanged
      });

      expect(result).toBe(true);
      expect(store.getRevision()).toBe(2);
      expect(stateListener).toHaveBeenCalledTimes(1);
      expect(configListener).toHaveBeenCalledTimes(1);
    });

    it('verifies empty updates and undefined fields do not mutate or notify', () => {
      const store = createAppStore();
      const initialRev = store.getRevision();

      const stateListener = vi.fn();
      const configListener = vi.fn();
      store.subscribe(stateListener);
      store.subscribeConfig(configListener);

      expect(store.updateConfig({})).toBe(true);
      expect(store.updateConfig({ convention: undefined, madhab: undefined })).toBe(true);

      expect(store.getRevision()).toBe(initialRev);
      expect(stateListener).toHaveBeenCalledTimes(0);
      expect(configListener).toHaveBeenCalledTimes(0);
    });

    it('verifies invalid values are rejected with false and do not increment revision', () => {
      const store = createAppStore();
      const initialRev = store.getRevision();
      const stateListener = vi.fn();
      const configListener = vi.fn();
      store.subscribe(stateListener);
      store.subscribeConfig(configListener);

      const invalidInputs: Partial<AppConfig>[] = [
        { convention: 'NonExistent' as CalculationConventionName },
        { madhab: 'Hanbali' as Madhab }, // only Shafi and Hanafi are valid
        { highLatitudeRule: 'InvalidRule' as HighLatitudeRule },
        { adhanDurationMinutes: 0 },
        { adhanDurationMinutes: -1 },
        { adhanDurationMinutes: NaN },
        { mapStyle: 'terrain' as 'satellite' },
        // Compound invalid: valid madhab + invalid convention
        { madhab: 'Hanafi', convention: 'Invalid' as CalculationConventionName },
      ];

      for (const invalidInput of invalidInputs) {
        const result = store.updateConfig(invalidInput);
        expect(result).toBe(false);
      }

      expect(store.getRevision()).toBe(initialRev);
      expect(stateListener).toHaveBeenCalledTimes(0);
      expect(configListener).toHaveBeenCalledTimes(0);
    });

    it('fuzzes AppStore with 500 deterministic pseudo-random operations against an oracle', () => {
      const rng = new SeededRng(42);
      const store = createAppStore();

      const allConventions = Object.keys(CALCULATION_CONVENTIONS) as CalculationConventionName[];
      const allMadhabs: Madhab[] = ['Shafi', 'Hanafi'];
      const allRules: HighLatitudeRule[] = [
        'MiddleOfTheNight',
        'SeventhOfTheNight',
        'AngleBased',
      ];
      const allStyles: ('roadmap' | 'satellite')[] = ['roadmap', 'satellite'];

      // Independent reference model
      let expectedConfig: AppConfig = { ...store.getConfig() };
      let expectedRevision = store.getRevision();
      let expectedNotifications = 0;

      const stateListener = vi.fn();
      const configListener = vi.fn();
      store.subscribe(stateListener);
      store.subscribeConfig(configListener);

      for (let op = 0; op < 500; op++) {
        const opType = rng.nextInt(0, 6);
        let partial: Partial<AppConfig> = {};

        switch (opType) {
          case 0:
            // Identical update of entire config
            partial = { ...expectedConfig };
            break;
          case 1:
            // Random single field update
            {
              const field = rng.nextInt(0, 5);
              if (field === 0) partial.convention = rng.pick(allConventions);
              else if (field === 1) partial.madhab = rng.pick(allMadhabs);
              else if (field === 2) partial.highLatitudeRule = rng.pick(allRules);
              else if (field === 3) partial.adhanDurationMinutes = rng.nextInt(1, 10);
              else partial.mapStyle = rng.pick(allStyles);
            }
            break;
          case 2:
            // Multi-field update
            partial = {
              convention: rng.pick(allConventions),
              madhab: rng.pick(allMadhabs),
              mapStyle: rng.pick(allStyles),
            };
            break;
          case 3:
            // Empty update
            partial = {};
            break;
          case 4:
            // Invalid update
            partial = { convention: 'BadConvention' as CalculationConventionName };
            break;
          case 5:
            // Mixed partial with some identical fields
            partial = {
              convention: expectedConfig.convention,
              highLatitudeRule: rng.pick(allRules),
            };
            break;
        }

        // Determine expected outcome
        let isValid = true;
        if (partial.convention !== undefined && !allConventions.includes(partial.convention)) {
          isValid = false;
        }

        if (!isValid) {
          const res = store.updateConfig(partial);
          expect(res).toBe(false);
        } else {
          // Check if any valid field differs
          let hasDiff = false;
          const candidateKeys = Object.keys(partial) as (keyof AppConfig)[];
          for (const k of candidateKeys) {
            if (partial[k] !== undefined && partial[k] !== expectedConfig[k]) {
              hasDiff = true;
              break;
            }
          }

          const res = store.updateConfig(partial);
          expect(res).toBe(true);

          if (hasDiff) {
            expectedRevision++;
            expectedNotifications++;
            expectedConfig = { ...expectedConfig, ...partial };
          }
        }

        // Assert state invariance after each operation
        expect(store.getRevision()).toBe(expectedRevision);
        expect(store.getConfig()).toEqual(expectedConfig);
        expect(stateListener).toHaveBeenCalledTimes(expectedNotifications);
        expect(configListener).toHaveBeenCalledTimes(expectedNotifications);
      }
    });

    it('verifies listener unsubscribe and error handling resilience', () => {
      const store = createAppStore();
      const errListener = vi.fn(() => {
        throw new Error('Exploding listener');
      });
      const healthyListener = vi.fn();

      const unsubErr = store.subscribe(errListener);
      const unsubHealthy = store.subscribe(healthyListener);

      // Dispatching update with throwing listener should not prevent healthy listener from running
      expect(() => {
        store.updateConfig({ madhab: 'Hanafi' });
      }).not.toThrow();

      expect(errListener).toHaveBeenCalledTimes(1);
      expect(healthyListener).toHaveBeenCalledTimes(1);

      // Unsubscribe error listener
      unsubErr();
      store.updateConfig({ madhab: 'Shafi' });
      expect(errListener).toHaveBeenCalledTimes(1); // not called again
      expect(healthyListener).toHaveBeenCalledTimes(2);

      unsubHealthy();
    });
  });
});
