import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveObserverCivilDate,
  getInspectorSchedule,
  createInspectorPanel,
  renderProvenanceBadge,
  formatDuration,
} from './inspector';
import { calculatePrayerTimes, PrayerEntry } from '../prayer/calculator';
import { Settlement } from '../population/loader';
import { DICTIONARIES } from '../i18n/translations';
import { i18n } from '../i18n/manager';

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

  describe('Group 6: Last Third of the Night Inspector Card (R3)', () => {
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalDocument = globalThis.document;
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
          remove: () => {},
        };
        return el;
      };

      globalThis.document = {
        createElement: (tag: string) => createFakeElement(tag),
        documentElement: { lang: 'en', dir: 'ltr' },
      } as unknown as Document;
    });

    afterEach(() => {
      i18n.setLocale('en');
      globalThis.document = originalDocument;
    });

    it('1. renders Last Third card when islamicNight is present', () => {
      const makkahSettlement: Settlement = {
        name: 'Makkah',
        nameAr: 'مكة المكرمة',
        latitude: 21.42,
        longitude: 39.83,
        countryCode: 'SA',
        population: 2000000,
        timezone: 'Asia/Riyadh',
      };
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      panel.inspectSettlement(makkahSettlement, new Date('2026-10-04T12:00:00Z'));

      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-night-card');
      expect(html).toContain('inspector-night-times');
      expect(html).toContain('inspector-night-countdown');
      expect(html).toContain(DICTIONARIES.en.inspector.lastThird);
      expect(html).toContain(DICTIONARIES.en.inspector.lastThirdStart);
      expect(html).toContain(DICTIONARIES.en.inspector.lastThirdEnd);
      expect(html).toContain(DICTIONARIES.en.inspector.nightDuration);
      expect(html).toContain(DICTIONARIES.en.inspector.countdown);
      panel.dispose();
    });

    it('2. formats times and durations strictly with Western numerals (0-9) across locales', () => {
      const tokyoSettlement: Settlement = {
        name: 'Tokyo',
        nameAr: 'طوكيو',
        latitude: 35.68,
        longitude: 139.76,
        countryCode: 'JP',
        population: 14000000,
        timezone: 'Asia/Tokyo',
      };
      const testDate = new Date('2026-10-04T19:12:01.579Z');
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });

      // English locale check
      panel.inspectSettlement(tokyoSettlement, testDate);
      const htmlEn = panel.element.innerHTML;
      expect(htmlEn).toMatch(/\b\d{2}:\d{2}:\d{2}\b/);
      expect(htmlEn).toMatch(/\b\d+h\s*\d+m\b/);

      // Verify formatDuration utility directly
      expect(formatDuration(3600000 * 9 + 60000 * 45)).toBe('9h 45m');
      expect(formatDuration(null)).toBe('--h --m');

      // Switch to Arabic locale and verify no Eastern Arabic-Indic numerals in timestamps and durations
      i18n.setLocale('ar');
      panel.inspectSettlement(tokyoSettlement, testDate);
      const htmlAr = panel.element.innerHTML;
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(htmlAr)).toBe(false);
      expect(htmlAr).toMatch(/\b\d{2}:\d{2}:\d{2}\b/);
      expect(htmlAr).toMatch(/\b\d+h\s*\d+m\b/);
      panel.dispose();
    });

    it('3. displays active badge when current time is in the last third', () => {
      const makkahSettlement: Settlement = {
        name: 'Makkah',
        nameAr: 'مكة المكرمة',
        latitude: 21.42,
        longitude: 39.83,
        countryCode: 'SA',
        population: 2000000,
        timezone: 'Asia/Riyadh',
      };
      // At 2026-10-05T01:00:00Z in Makkah (04:00 local, Fajr is around 04:55 local),
      // it is pre-dawn inside the last third
      const instant = new Date('2026-10-05T01:00:00Z');
      const sched = getInspectorSchedule(21.42, 39.83, instant, { timezone: 'Asia/Riyadh' });
      expect(sched.islamicNight?.isCurrentlyLastThird).toBe(true);

      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      panel.inspectSettlement(makkahSettlement, instant);

      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-night-badge active');
      expect(html).toContain('inspector-night-card active');
      expect(html).toContain(DICTIONARIES.en.inspector.lastThirdActive);
      panel.dispose();
    });

    it('4. displays inactive state and countdown when before the last third', () => {
      const makkahSettlement: Settlement = {
        name: 'Makkah',
        nameAr: 'مكة المكرمة',
        latitude: 21.42,
        longitude: 39.83,
        countryCode: 'SA',
        population: 2000000,
        timezone: 'Asia/Riyadh',
      };
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });

      // Daytime (12:00 UTC = 15:00 local) before Maghrib
      const instantDay = new Date('2026-10-04T12:00:00Z');
      panel.inspectSettlement(makkahSettlement, instantDay);
      expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
      expect(panel.element.innerHTML).not.toContain('inspector-night-card active');
      expect(panel.element.innerHTML).toMatch(/\b\d{2}:\d{2}:\d{2}\b/);

      // Evening (18:00 UTC = 21:00 local) in the first third of the night
      const instantEvening = new Date('2026-10-04T18:00:00Z');
      panel.inspectSettlement(makkahSettlement, instantEvening);
      expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
      expect(panel.element.innerHTML).not.toContain('inspector-night-card active');
      expect(panel.element.innerHTML).toMatch(/\b\d{2}:\d{2}:\d{2}\b/);
      panel.dispose();
    });

    it('5. updates countdown dynamically on time tick and boundary crossing in panel.updateTime(date)', () => {
      const tokyoSettlement: Settlement = {
        name: 'Tokyo',
        nameAr: 'طوكيو',
        latitude: 35.68,
        longitude: 139.76,
        countryCode: 'JP',
        population: 14000000,
        timezone: 'Asia/Tokyo',
      };
      const initialInstant = new Date('2026-10-04T19:12:01.579Z');
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      panel.inspectSettlement(tokyoSettlement, initialInstant);

      const sched = getInspectorSchedule(35.68, 139.76, initialInstant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: 'Asia/Tokyo',
      });
      const lastThirdStartMs = sched.islamicNight!.lastThirdStart.getTime();
      const lastThirdEndMs = sched.islamicNight!.lastThirdEnd.getTime();

      // 1000ms before last third start -> not active, countdown shows 00:00:01
      panel.updateTime(new Date(lastThirdStartMs - 1000));
      expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
      expect(panel.element.innerHTML).toContain('00:00:01');

      // Exactly at last third start -> active badge appears
      panel.updateTime(new Date(lastThirdStartMs));
      expect(panel.element.innerHTML).toContain('inspector-night-badge active');
      expect(panel.element.innerHTML).toContain('inspector-night-card active');

      // Exactly at last third end (Fajr) -> active badge disappears
      panel.updateTime(new Date(lastThirdEndMs));
      expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
      expect(panel.element.innerHTML).not.toContain('inspector-night-card active');
      panel.dispose();
    });

    it('6. gracefully renders when islamicNight is undefined in polar coordinates', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const winterDate = new Date('2026-12-21T12:00:00Z');

      expect(() => panel.inspectCoordinates(69.65, 18.96, winterDate)).not.toThrow();
      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-night-card unresolved');
      expect(html).toContain('--:--:--');
      expect(html).toContain('--h --m');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
      panel.dispose();
    });

    it('7. verifies multilingual and RTL integrity across all 10 locales', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const settlement: Settlement = {
        name: 'Makkah',
        nameAr: 'مكة المكرمة',
        latitude: 21.42,
        longitude: 39.83,
        countryCode: 'SA',
        population: 2000000,
        timezone: 'Asia/Riyadh',
      };
      const instant = new Date('2026-10-05T01:00:00Z');

      const localeList = ['en', 'ar', 'fr', 'tr', 'ur', 'fa', 'bn', 'id', 'ms', 'ru'] as const;
      for (const loc of localeList) {
        const dict = DICTIONARIES[loc];
        expect(dict.inspector.lastThird).toBeTruthy();
        expect(dict.inspector.nightDuration).toBeTruthy();
        expect(dict.inspector.lastThirdStart).toBeTruthy();
        expect(dict.inspector.lastThirdEnd).toBeTruthy();
        expect(dict.inspector.lastThirdActive).toBeTruthy();
        expect(dict.inspector.countdown).toBeTruthy();

        i18n.setLocale(loc);
        panel.inspectSettlement(settlement, instant);
        const html = panel.element.innerHTML;
        expect(html).toContain('inspector-night-card');
        expect(html).toContain(dict.inspector.lastThird);
        expect(html).toContain(dict.inspector.lastThirdActive);
        expect(html).not.toContain('NaN');
        // Ensure strictly Western numerals (0-9) and no Eastern Arabic-Indic numerals
        expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(html)).toBe(false);
      }
      i18n.setLocale('en');
      panel.dispose();
    });
  });
});
