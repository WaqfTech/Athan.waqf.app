import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createInspectorPanel,
  getInspectorSchedule,
  formatDuration,
} from '../src/ui/inspector';
import { Settlement } from '../src/population/loader';
import { DICTIONARIES } from '../src/i18n/translations';
import { i18n } from '../src/i18n/manager';
import { SupportedLocale } from '../src/i18n/config';

describe('Challenger 2 Milestone 3: Inspector Panel Numeral, Typography, and i18n Invariants', () => {
  const supportedLocales: SupportedLocale[] = [
    'ar',
    'en',
    'tr',
    'id',
    'ms',
    'ur',
    'fa',
    'bn',
    'fr',
    'ru',
  ];

  const testSettlements: Settlement[] = [
    {
      name: 'Makkah',
      nameAr: 'مكة المكرمة',
      latitude: 21.42,
      longitude: 39.83,
      countryCode: 'SA',
      population: 2000000,
      timezone: 'Asia/Riyadh',
    },
    {
      name: 'Tokyo',
      nameAr: 'طوكيو',
      latitude: 35.68,
      longitude: 139.76,
      countryCode: 'JP',
      population: 14000000,
      timezone: 'Asia/Tokyo',
    },
    {
      name: 'Cairo',
      nameAr: 'القاهرة',
      latitude: 30.04,
      longitude: 31.24,
      countryCode: 'EG',
      population: 9500000,
      timezone: 'Africa/Cairo',
    },
    {
      name: 'Honolulu',
      nameAr: 'هونولولو',
      latitude: 21.30,
      longitude: -157.85,
      countryCode: 'US',
      population: 350000,
      timezone: 'Pacific/Honolulu',
    },
    {
      name: 'London',
      nameAr: 'لندن',
      latitude: 51.51,
      longitude: -0.13,
      countryCode: 'GB',
      population: 9000000,
      timezone: 'Europe/London',
    },
    {
      name: 'Istanbul',
      nameAr: 'إسطنبول',
      latitude: 41.01,
      longitude: 28.98,
      countryCode: 'TR',
      population: 15500000,
      timezone: 'Europe/Istanbul',
    },
    {
      name: 'Jakarta',
      nameAr: 'جاكرتا',
      latitude: -6.21,
      longitude: 106.85,
      countryCode: 'ID',
      population: 10500000,
      timezone: 'Asia/Jakarta',
    },
    {
      name: 'Tromso',
      nameAr: 'ترومسو',
      latitude: 69.65,
      longitude: 18.96,
      countryCode: 'NO',
      population: 75000,
      timezone: 'Europe/Oslo',
    },
  ];

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

  // =========================================================================
  // Requirement 1: Zero Eastern Arabic-Indic & Zero Persian Digits Across 10 Locales
  // =========================================================================
  describe('Requirement 1: Zero Eastern Arabic-Indic (0660-0669) and Persian (06F0-06F9) Digits', () => {
    it('empirically verifies zero Eastern digits in rendered HTML across 10 locales and all test settlements', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const testInstants = [
        new Date('2026-10-05T01:00:00Z'), // Makkah last third active
        new Date('2026-10-04T12:00:00Z'), // Daytime
        new Date('2026-10-04T18:00:00Z'), // Evening first third
        new Date('2026-10-04T19:12:01.579Z'), // Tokyo Fajr active
        new Date('2026-12-21T12:00:00Z'), // Winter solstice polar night
      ];

      const easternDigitRegex = /[\u0660-\u0669\u06F0-\u06F9]/;

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);

        for (const settlement of testSettlements) {
          for (const instant of testInstants) {
            panel.inspectSettlement(settlement, instant);
            const html = panel.element.innerHTML;

            const match = easternDigitRegex.exec(html);
            expect(
              match,
              `Found Eastern Arabic-Indic or Persian digit in locale=${loc}, city=${settlement.name}, instant=${instant.toISOString()}: ${match?.[0]}`,
            ).toBeNull();
          }
        }
      }
      panel.dispose();
    });

    it('empirically verifies zero Eastern digits for raw geographic coordinates across 10 locales', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const rawCoords = [
        { lat: 0, lon: 0 },
        { lat: 21.4225, lon: 39.8262 }, // at Kaaba
        { lat: 35.68, lon: 139.76 },
        { lat: 69.65, lon: 18.96 }, // Polar winter
        { lat: -33.86, lon: 151.21 }, // Sydney
        { lat: -12.04, lon: -77.04 }, // Lima
      ];
      const instant = new Date('2026-10-05T01:00:00Z');
      const easternDigitRegex = /[\u0660-\u0669\u06F0-\u06F9]/;

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);

        for (const coord of rawCoords) {
          panel.inspectCoordinates(coord.lat, coord.lon, instant);
          const html = panel.element.innerHTML;

          const match = easternDigitRegex.exec(html);
          expect(
            match,
            `Found Eastern digit in raw coordinates (${coord.lat}, ${coord.lon}) for locale=${loc}: ${match?.[0]}`,
          ).toBeNull();
        }
      }
      panel.dispose();
    });
  });

  // =========================================================================
  // Requirement 2: Western ASCII Numerals (0-9) Strictly Used for Times, Durations, Countdowns
  // =========================================================================
  describe('Requirement 2: Western ASCII Numerals for Times, Durations, and Countdowns', () => {
    it('verifies all time strings in the inspector match ASCII HH:MM:SS format across 10 locales', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const instant = new Date('2026-10-05T01:00:00Z');
      const makkah = testSettlements[0];

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);
        panel.inspectSettlement(makkah, instant);
        const html = panel.element.innerHTML;

        // Extract all time patterns HH:MM:SS
        const timeMatches = html.match(/\b\d{2}:\d{2}:\d{2}\b/g) || [];
        expect(timeMatches.length).toBeGreaterThan(0);

        for (const timeStr of timeMatches) {
          // Strictly ASCII digits 0-9
          expect(/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(timeStr)).toBe(true);
        }
      }
      panel.dispose();
    });

    it('verifies duration strings match strictly ASCII format across all ranges', () => {
      const testCases = [
        { ms: 0, expected: '0h 0m' },
        { ms: 60000, expected: '0h 1m' },
        { ms: 3600000, expected: '1h 0m' },
        { ms: 3600000 * 9 + 60000 * 45, expected: '9h 45m' },
        { ms: 3600000 * 12 + 60000 * 30, expected: '12h 30m' },
        { ms: 3600000 * 23 + 60000 * 59, expected: '23h 59m' },
        { ms: null, expected: '--h --m' },
        { ms: undefined, expected: '--h --m' },
        { ms: -1000, expected: '--h --m' },
        { ms: NaN, expected: '--h --m' },
        { ms: Infinity, expected: '--h --m' },
      ];

      for (const tc of testCases) {
        const formatted = formatDuration(tc.ms);
        expect(formatted).toBe(tc.expected);
        expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(formatted)).toBe(false);
      }
    });

    it('verifies countdown values strictly use Western ASCII numerals (0-9)', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const makkah = testSettlements[0];
      const instant = new Date('2026-10-05T01:00:00Z');

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);
        panel.inspectSettlement(makkah, instant);
        const html = panel.element.innerHTML;

        // Check countdown container value
        const countdownMatch = html.match(/inspector-night-countdown-value">([^<]+)<\/span>/);
        expect(countdownMatch).not.toBeNull();
        const countdownVal = countdownMatch![1].trim();
        expect(/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(countdownVal)).toBe(true);
      }
      panel.dispose();
    });
  });

  // =========================================================================
  // Requirement 3: Zero Physical Directional CSS Properties in main.css
  // =========================================================================
  describe('Requirement 3: Zero Physical Directional CSS Properties in inspector night selectors', () => {
    it('empirically parses src/styles/main.css and verifies zero physical directional properties in inspector night rules', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/main.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Extract all rule blocks matching .inspector-night
      const lines = cssContent.split('\n');
      let inNightRule = false;
      let currentSelector = '';
      let braceDepth = 0;
      const physicalViolations: Array<{ selector: string; line: number; text: string }> = [];

      const physicalPropertyRegex = /\b(margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius|left|right)\s*:/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.includes('.inspector-night')) {
          inNightRule = true;
          currentSelector = trimmed;
        }

        if (inNightRule) {
          const openCount = (line.match(/\{/g) || []).length;
          const closeCount = (line.match(/\}/g) || []).length;
          braceDepth += openCount - closeCount;

          if (physicalPropertyRegex.test(trimmed)) {
            physicalViolations.push({
              selector: currentSelector,
              line: i + 1,
              text: trimmed,
            });
          }

          if (braceDepth <= 0 && closeCount > 0) {
            inNightRule = false;
            braceDepth = 0;
            currentSelector = '';
          }
        }
      }

      expect(
        physicalViolations,
        `Found physical directional CSS properties in .inspector-night selectors: ${JSON.stringify(physicalViolations, null, 2)}`,
      ).toEqual([]);
    });

    it('verifies presence of CSS logical properties in inspector night card selectors', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/main.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).toContain('.inspector-night-card');
      expect(cssContent).toContain('padding-block: var(--space-xs);');
      expect(cssContent).toContain('padding-inline: var(--space-sm);');
      expect(cssContent).toContain('border-inline-start: 3px solid var(--color-emerald);');
      expect(cssContent).toContain('text-align: start;');
      expect(cssContent).toContain('text-align: end;');
    });
  });

  // =========================================================================
  // Requirement 4: Zero Em Dashes in Inspector Text or Template Literals
  // =========================================================================
  describe('Requirement 4: Zero Em Dashes in Inspector Text and Templates', () => {
    it('empirically verifies inspector HTML across all 10 locales contains zero em dashes', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const testInstants = [
        new Date('2026-10-05T01:00:00Z'),
        new Date('2026-10-04T12:00:00Z'),
        new Date('2026-12-21T12:00:00Z'),
      ];

      const emDashRegex = /[\u2014\u2015\u2E3A\u2E3B]|&mdash;|&#8212;/;

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);

        for (const settlement of testSettlements) {
          for (const instant of testInstants) {
            panel.inspectSettlement(settlement, instant);
            const html = panel.element.innerHTML;

            const match = emDashRegex.exec(html);
            expect(
              match,
              `Found em dash in HTML for locale=${loc}, city=${settlement.name}: ${match?.[0]}`,
            ).toBeNull();
          }
        }
      }
      panel.dispose();
    });

    it('empirically verifies src/ui/inspector.ts contains zero em dashes in source code', () => {
      const inspectorTsPath = path.resolve(__dirname, '../src/ui/inspector.ts');
      const source = fs.readFileSync(inspectorTsPath, 'utf8');

      const emDashRegex = /[\u2014\u2015\u2E3A\u2E3B]|&mdash;|&#8212;/;
      const match = emDashRegex.exec(source);
      expect(match, `Found em dash in src/ui/inspector.ts: ${match?.[0]}`).toBeNull();
    });

    it('empirically verifies inspector dictionaries across all 10 locales contain zero em dashes', () => {
      const emDashRegex = /[\u2014\u2015\u2E3A\u2E3B]|&mdash;|&#8212;/;

      for (const loc of supportedLocales) {
        const inspectorDict = DICTIONARIES[loc].inspector;
        const serialized = JSON.stringify(inspectorDict);
        const match = emDashRegex.exec(serialized);
        expect(match, `Found em dash in DICTIONARIES[${loc}].inspector: ${match?.[0]}`).toBeNull();
      }
    });
  });

  // =========================================================================
  // Requirement 5: All 10 Locales Render Non-Empty Localized Titles and Badges
  // =========================================================================
  describe('Requirement 5: Non-Empty Localized Titles and Badges Across All 10 Locales', () => {
    it('verifies dictionary inspector night keys are present and non-empty for all 10 locales', () => {
      for (const loc of supportedLocales) {
        const trans = DICTIONARIES[loc].inspector;

        expect(typeof trans.lastThird, `${loc}.lastThird type`).toBe('string');
        expect(trans.lastThird.trim().length, `${loc}.lastThird non-empty`).toBeGreaterThan(0);

        expect(typeof trans.nightDuration, `${loc}.nightDuration type`).toBe('string');
        expect(trans.nightDuration.trim().length, `${loc}.nightDuration non-empty`).toBeGreaterThan(0);

        expect(typeof trans.lastThirdStart, `${loc}.lastThirdStart type`).toBe('string');
        expect(trans.lastThirdStart.trim().length, `${loc}.lastThirdStart non-empty`).toBeGreaterThan(0);

        expect(typeof trans.lastThirdEnd, `${loc}.lastThirdEnd type`).toBe('string');
        expect(trans.lastThirdEnd.trim().length, `${loc}.lastThirdEnd non-empty`).toBeGreaterThan(0);

        expect(typeof trans.lastThirdActive, `${loc}.lastThirdActive type`).toBe('string');
        expect(trans.lastThirdActive.trim().length, `${loc}.lastThirdActive non-empty`).toBeGreaterThan(0);

        expect(typeof trans.countdown, `${loc}.countdown type`).toBe('string');
        expect(trans.countdown.trim().length, `${loc}.countdown non-empty`).toBeGreaterThan(0);
      }
    });

    it('verifies rendered inspector HTML contains exact localized title and active badge across all 10 locales', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const makkah = testSettlements[0];
      const activeInstant = new Date('2026-10-05T01:00:00Z'); // In last third

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);
        panel.inspectSettlement(makkah, activeInstant);
        const html = panel.element.innerHTML;

        const trans = DICTIONARIES[loc].inspector;

        // Title match
        expect(html).toContain(`inspector-night-title">${trans.lastThird}</span>`);

        // Active badge match
        expect(html).toContain(`inspector-night-badge active">${trans.lastThirdActive}</div>`);

        // Time labels match
        expect(html).toContain(`inspector-night-time-label">${trans.lastThirdStart}</span>`);
        expect(html).toContain(`inspector-night-time-label">${trans.lastThirdEnd}</span>`);
        expect(html).toContain(`inspector-night-time-label">${trans.nightDuration}</span>`);

        // Countdown label match
        expect(html).toContain(`inspector-night-countdown-label">${trans.countdown}</span>`);
      }
      panel.dispose();
    });

    it('verifies rendered unresolved badge is localized and non-empty when night calculations are unresolved', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const winterPolarInstant = new Date('2026-12-21T12:00:00Z');

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);
        // Inspect polar coordinate
        panel.inspectCoordinates(69.65, 18.96, winterPolarInstant);
        const html = panel.element.innerHTML;

        const trans = DICTIONARIES[loc].inspector;
        expect(html).toContain('inspector-night-card unresolved');
        expect(html).toContain(`inspector-night-title">${trans.lastThird}</span>`);
        expect(html).toContain('prayer-provenance-unresolved');
        expect(html).toContain(trans.provenance.unresolved.label);
      }
      panel.dispose();
    });
  });

  // =========================================================================
  // Requirement 6: Dynamic Active Badge Toggling and Boundary Precision
  // =========================================================================
  describe('Requirement 6: Dynamic Active Badge Toggling and Boundary Precision', () => {
    it('toggles active badge exactly at last third start and end boundaries across locales', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const settlement = testSettlements[1]; // Tokyo
      const refInstant = new Date('2026-10-04T19:12:01.579Z');

      const sched = getInspectorSchedule(settlement.latitude, settlement.longitude, refInstant, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: settlement.timezone,
      });

      expect(sched.islamicNight).toBeDefined();
      const startMs = sched.islamicNight!.lastThirdStart.getTime();
      const endMs = sched.islamicNight!.lastThirdEnd.getTime();

      for (const loc of ['en', 'ar', 'ur', 'fr'] as const) {
        i18n.setLocale(loc);
        panel.inspectSettlement(settlement, refInstant);

        // 1. 1000ms before last third start: NOT active
        panel.updateTime(new Date(startMs - 1000));
        let html = panel.element.innerHTML;
        expect(html).not.toContain('inspector-night-card active');
        expect(html).not.toContain('inspector-night-badge active');

        // 2. Exactly at last third start: ACTIVE
        panel.updateTime(new Date(startMs));
        html = panel.element.innerHTML;
        expect(html).toContain('inspector-night-card active');
        expect(html).toContain('inspector-night-badge active');
        expect(html).toContain(DICTIONARIES[loc].inspector.lastThirdActive);

        // 3. Middle of last third: ACTIVE
        panel.updateTime(new Date((startMs + endMs) / 2));
        html = panel.element.innerHTML;
        expect(html).toContain('inspector-night-card active');
        expect(html).toContain('inspector-night-badge active');

        // 4. Exactly at last third end (Fajr): NOT active
        panel.updateTime(new Date(endMs));
        html = panel.element.innerHTML;
        expect(html).not.toContain('inspector-night-card active');
        expect(html).not.toContain('inspector-night-badge active');
      }
      panel.dispose();
    });
  });
});
