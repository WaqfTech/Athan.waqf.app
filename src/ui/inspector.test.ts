import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveObserverCivilDate,
  getInspectorSchedule,
  createInspectorPanel,
  renderProvenanceBadge,
} from './inspector';
import { calculatePrayerTimes, PrayerEntry } from '../prayer/calculator';
import { Settlement } from '../population/loader';
import { DICTIONARIES } from '../i18n/translations';

describe('Inspector Local Civil Date Resolution', () => {
  describe('Group 1: Observer Civil Date Resolution (resolveObserverCivilDate)', () => {
    it('resolves Tokyo (Asia/Tokyo) at 2026-10-04T19:12:01.579Z to civil date 5 October', () => {
      const instant = new Date('2026-10-04T19:12:01.579Z');
      const civilDate = resolveObserverCivilDate(instant, 139.76, 'Asia/Tokyo');

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9); // October (0-indexed)
      expect(civilDate.getUTCDate()).toBe(5);
      expect(civilDate.getUTCHours()).toBe(12);
    });

    it('resolves Honolulu (Pacific/Honolulu) at 2026-10-05T02:00:00.000Z to civil date 4 October', () => {
      const instant = new Date('2026-10-05T02:00:00.000Z');
      const civilDate = resolveObserverCivilDate(instant, -157.85, 'Pacific/Honolulu');

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9);
      expect(civilDate.getUTCDate()).toBe(4);
      expect(civilDate.getUTCHours()).toBe(12);
    });

    it('resolves Tokyo coordinates without timezone (lon 139.76) to 5 October via solar offset', () => {
      const instant = new Date('2026-10-04T19:12:01.579Z');
      const civilDate = resolveObserverCivilDate(instant, 139.76);

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9);
      expect(civilDate.getUTCDate()).toBe(5);
    });

    it('resolves Honolulu coordinates without timezone (lon -157.85) to 4 October via solar offset', () => {
      const instant = new Date('2026-10-05T02:00:00.000Z');
      const civilDate = resolveObserverCivilDate(instant, -157.85);

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9);
      expect(civilDate.getUTCDate()).toBe(4);
    });

    it('resolves Greenwich coordinates (lon 0.0) at UTC midnight boundary', () => {
      const instant = new Date('2026-10-05T00:30:00.000Z');
      const civilDate = resolveObserverCivilDate(instant, 0.0);

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9);
      expect(civilDate.getUTCDate()).toBe(5);
    });

    it('resolves Auckland (Pacific/Auckland, UTC+13) across date lines', () => {
      const instant = new Date('2026-10-04T11:30:00.000Z');
      const civilDate = resolveObserverCivilDate(instant, 174.76, 'Pacific/Auckland');

      // 11:30 UTC on 4 Oct + 13 hours = 00:30 on 5 Oct
      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9);
      expect(civilDate.getUTCDate()).toBe(5);
    });

    it('gracefully falls back to longitude offset when an invalid timezone string is passed', () => {
      const instant = new Date('2026-10-04T19:12:01.579Z');
      const civilDate = resolveObserverCivilDate(instant, 139.76, 'Invalid/Timezone');

      expect(civilDate.getUTCFullYear()).toBe(2026);
      expect(civilDate.getUTCMonth()).toBe(9);
      expect(civilDate.getUTCDate()).toBe(5);
    });
  });

  describe('Group 2: Inspector Schedule Resolution (getInspectorSchedule)', () => {
    it('Tokyo W06 at 2026-10-04T19:12:01.579Z returns currentPrayer fajr and positive countdown', () => {
      const instant = new Date('2026-10-04T19:12:01.579Z');
      const sched = getInspectorSchedule(35.68, 139.76, instant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: 'Asia/Tokyo',
      });

      expect(sched.currentPrayer).toBe('fajr');
      expect(sched.nextPrayer).toBe('dhuhr');
      expect(sched.countdownMs).not.toBeNull();
      expect(sched.countdownMs!).toBeGreaterThan(0);
    });

    it('Honolulu at 2026-10-05T02:00:00.000Z returns currentPrayer asr and positive countdown', () => {
      const instant = new Date('2026-10-05T02:00:00.000Z');
      const sched = getInspectorSchedule(21.30, -157.85, instant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: 'Pacific/Honolulu',
      });

      expect(sched.currentPrayer).toBe('asr');
      expect(sched.nextPrayer).toBe('maghrib');
      expect(sched.countdownMs).not.toBeNull();
      expect(sched.countdownMs!).toBeGreaterThan(0);
    });

    it('coordinates query without settlement metadata returns active fajr for Tokyo coordinates', () => {
      const instant = new Date('2026-10-04T19:12:01.579Z');
      const sched = getInspectorSchedule(35.68, 139.76, instant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      expect(sched.currentPrayer).toBe('fajr');
      expect(sched.countdownMs).toBeGreaterThan(0);
    });

    it('transitions currentPrayer from isha to fajr across Tokyo Fajr start boundary', () => {
      const schedOct5 = calculatePrayerTimes(35.68, 139.76, new Date('2026-10-05T12:00:00Z'), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const fajrStart = schedOct5.fajr.date!.getTime();

      // 1 ms before Fajr -> isha
      const schedBefore = getInspectorSchedule(35.68, 139.76, new Date(fajrStart - 1), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: 'Asia/Tokyo',
      });
      expect(schedBefore.currentPrayer).toBe('isha');

      // Exactly at Fajr -> fajr
      const schedAt = getInspectorSchedule(35.68, 139.76, new Date(fajrStart), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: 'Asia/Tokyo',
      });
      expect(schedAt.currentPrayer).toBe('fajr');
    });
  });

  describe('Group 3: Backwards Compatibility in calculatePrayerTimes', () => {
    it('calculatePrayerTimes without options.now retains legacy behavior evaluating against date', () => {
      const date = new Date('2026-10-04T12:00:00Z');
      const schedLegacy = calculatePrayerTimes(21.42, 39.83, date);

      expect(schedLegacy.currentPrayer).toBe('dhuhr');
      expect(schedLegacy.nextPrayer).toBe('asr');
    });

    it('calculatePrayerTimes with options.now decouples ephemeris date from evaluation instant', () => {
      const ephemerisDate = new Date('2026-10-05T12:00:00Z');
      const now = new Date('2026-10-04T19:12:01.579Z');

      const sched = calculatePrayerTimes(35.68, 139.76, ephemerisDate, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        now,
      });

      expect(sched.currentPrayer).toBe('fajr');
      expect(sched.nextPrayer).toBe('dhuhr');
    });
  });

  describe('Group 4: Inspector Panel Component Rendering', () => {
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalDocument = globalThis.document;
      // Minimal fake DOM element to test inspector rendering
      const createFakeElement = (tag: string) => {
        const el: Record<string, unknown> = {
          tagName: tag.toUpperCase(),
          className: '',
          style: { display: '' },
          innerHTML: '',
          children: [] as unknown[],
          classList: {
            add: (cls: string) => {
              if (!el.className) el.className = cls;
              else el.className += ` ${cls}`;
            },
            remove: (cls: string) => {
              el.className = (el.className as string)
                .split(' ')
                .filter((c) => c !== cls)
                .join(' ');
            },
            contains: (cls: string) => (el.className as string).split(' ').includes(cls),
          },
          addEventListener: () => {},
          removeEventListener: () => {},
          appendChild: (child: unknown) => {
            (el.children as unknown[]).push(child);
            return child;
          },
          querySelector: () => null,
          querySelectorAll: () => [],
        };
        return el;
      };

      globalThis.document = {
        createElement: (tag: string) => createFakeElement(tag),
      } as unknown as Document;
    });

    afterEach(() => {
      globalThis.document = originalDocument;
    });

    it('inspectSettlement for Tokyo highlights Fajr row with active class and valid countdown', () => {
      const tokyoSettlement: Settlement = {
        name: 'Tokyo',
        nameAr: 'طوكيو',
        latitude: 35.68,
        longitude: 139.76,
        countryCode: 'JP',
        population: 14000000,
        timezone: 'Asia/Tokyo',
      };

      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const queryInstant = new Date('2026-10-04T19:12:01.579Z');

      panel.inspectSettlement(tokyoSettlement, queryInstant);

      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-prayer-row active');
      expect(html).toContain('Fajr');
      expect(html).not.toContain('--:--:--');
    });

    it('inspectSettlement for Honolulu highlights Asr row with active class and valid countdown', () => {
      const honoluluSettlement: Settlement = {
        name: 'Honolulu',
        nameAr: 'هونولولو',
        latitude: 21.30,
        longitude: -157.85,
        countryCode: 'US',
        population: 350000,
        timezone: 'Pacific/Honolulu',
      };

      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const queryInstant = new Date('2026-10-05T02:00:00.000Z');

      panel.inspectSettlement(honoluluSettlement, queryInstant);

      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-prayer-row active');
      expect(html).toContain('Asr');
      expect(html).not.toContain('--:--:--');
    });

    it('renders localized Solar Altitude and Geographic Point for raw coordinates', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      panel.inspectCoordinates(35.68, 139.76, new Date('2026-10-04T19:12:01.579Z'));

      const html = panel.element.innerHTML;
      expect(html).toContain('Solar Altitude');
      expect(html).toContain('Lat 35.68°, Lon 139.76°');
    });
  });

  describe('Group 5: Localized Provenance Badges (renderProvenanceBadge)', () => {
    it('renders astronomicalSign badge with localized label and CSS classes', () => {
      const entry: PrayerEntry = {
        date: new Date('2026-10-05T04:00:00Z'),
        provenance: 'astronomicalSign',
      };

      const htmlEn = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(htmlEn).toContain('prayer-provenance-badge');
      expect(htmlEn).toContain('prayer-provenance-astronomicalSign');
      expect(htmlEn).toContain('badge-astro');
      expect(htmlEn).toContain('Astro');

      const htmlAr = renderProvenanceBadge(entry, DICTIONARIES.ar);
      expect(htmlAr).toContain('prayer-provenance-badge');
      expect(htmlAr).toContain('فلكي');
    });

    it('renders fixedInterval badge with localized label and CSS classes', () => {
      const entry: PrayerEntry = {
        date: new Date('2026-10-05T19:30:00Z'),
        provenance: 'fixedInterval',
        note: 'Fixed 90-minute delay',
      };

      const htmlEn = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(htmlEn).toContain('prayer-provenance-fixedInterval');
      expect(htmlEn).toContain('badge-fixed');
      expect(htmlEn).toContain('Fixed');

      const htmlAr = renderProvenanceBadge(entry, DICTIONARIES.ar);
      expect(htmlAr).toContain('ثابت');
    });

    it('renders highLatitudeAdjustment AngleBased and rule badges', () => {
      const entryAngle: PrayerEntry = {
        date: new Date('2026-10-05T03:00:00Z'),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: 'AngleBased',
      };

      const htmlAngleEn = renderProvenanceBadge(entryAngle, DICTIONARIES.en);
      expect(htmlAngleEn).toContain('prayer-provenance-highLatitudeAdjustment');
      expect(htmlAngleEn).toContain('badge-high-lat');
      expect(htmlAngleEn).toContain('Angle');

      const htmlAngleAr = renderProvenanceBadge(entryAngle, DICTIONARIES.ar);
      expect(htmlAngleAr).toContain('بالزاوية');

      const entryOther: PrayerEntry = {
        date: new Date('2026-10-05T03:00:00Z'),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: 'MiddleOfTheNight',
      };
      const htmlOtherAr = renderProvenanceBadge(entryOther, DICTIONARIES.ar);
      expect(htmlOtherAr).toContain('مقدّر');
    });

    it('renders unresolved badge with localized label and CSS classes', () => {
      const entry: PrayerEntry = {
        date: null,
        provenance: 'unresolved',
      };

      const htmlEn = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(htmlEn).toContain('prayer-provenance-unresolved');
      expect(htmlEn).toContain('badge-unresolved');
      expect(htmlEn).toContain('No Event');

      const htmlAr = renderProvenanceBadge(entry, DICTIONARIES.ar);
      expect(htmlAr).toContain('غائب');
    });
  });
});
