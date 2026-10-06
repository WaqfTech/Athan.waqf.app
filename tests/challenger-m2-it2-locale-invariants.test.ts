import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
  detectLocale,
} from '../src/i18n/config';
import {
  DICTIONARIES,
  Translations,
  getTranslations,
} from '../src/i18n/translations';

describe('Challenger 2 M2 It2: Locale Invariants & Typography Verification', () => {
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

  const requiredNightKeys = [
    'inspector.lastThird',
    'inspector.nightDuration',
    'inspector.lastThirdStart',
    'inspector.lastThirdEnd',
    'inspector.lastThirdActive',
    'inspector.countdown',
    'controls.lastThirdActive',
    'timeline.lastThirdCities',
    'timeline.lastThirdTip',
    'stats.citiesInLastThird',
    'stats.lastThirdTip',
  ] as const;

  function getAllLeafStrings(
    obj: Record<string, unknown>,
    prefix = '',
  ): Array<{ path: string; value: string }> {
    const results: Array<{ path: string; value: string }> = [];
    for (const [key, val] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'string') {
        results.push({ path: fullPath, value: val });
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        results.push(...getAllLeafStrings(val as Record<string, unknown>, fullPath));
      }
    }
    return results;
  }

  // =========================================================================
  // Requirement 1: Night Division Key Completeness Across All 10 Locales
  // =========================================================================
  describe('Requirement 1: Night Division Keys Completeness & Value Hygiene', () => {
    it('verifies all 10 locales contain all 11 required night division keys', () => {
      for (const locale of supportedLocales) {
        const trans = getTranslations(locale);

        expect(trans.inspector.lastThird, `${locale}.inspector.lastThird`).toBeDefined();
        expect(trans.inspector.nightDuration, `${locale}.inspector.nightDuration`).toBeDefined();
        expect(trans.inspector.lastThirdStart, `${locale}.inspector.lastThirdStart`).toBeDefined();
        expect(trans.inspector.lastThirdEnd, `${locale}.inspector.lastThirdEnd`).toBeDefined();
        expect(trans.inspector.lastThirdActive, `${locale}.inspector.lastThirdActive`).toBeDefined();
        expect(trans.inspector.countdown, `${locale}.inspector.countdown`).toBeDefined();

        expect(trans.controls.lastThirdActive, `${locale}.controls.lastThirdActive`).toBeDefined();

        expect(trans.timeline.lastThirdCities, `${locale}.timeline.lastThirdCities`).toBeDefined();
        expect(trans.timeline.lastThirdTip, `${locale}.timeline.lastThirdTip`).toBeDefined();

        expect(trans.stats.citiesInLastThird, `${locale}.stats.citiesInLastThird`).toBeDefined();
        expect(trans.stats.lastThirdTip, `${locale}.stats.lastThirdTip`).toBeDefined();
      }
    });

    it('verifies all 11 required night division keys are non-empty and non-stub across all 10 locales', () => {
      for (const locale of supportedLocales) {
        const trans = getTranslations(locale);
        const map: Record<string, string> = {
          'inspector.lastThird': trans.inspector.lastThird,
          'inspector.nightDuration': trans.inspector.nightDuration,
          'inspector.lastThirdStart': trans.inspector.lastThirdStart,
          'inspector.lastThirdEnd': trans.inspector.lastThirdEnd,
          'inspector.lastThirdActive': trans.inspector.lastThirdActive,
          'inspector.countdown': trans.inspector.countdown,
          'controls.lastThirdActive': trans.controls.lastThirdActive,
          'timeline.lastThirdCities': trans.timeline.lastThirdCities,
          'timeline.lastThirdTip': trans.timeline.lastThirdTip,
          'stats.citiesInLastThird': trans.stats.citiesInLastThird,
          'stats.lastThirdTip': trans.stats.lastThirdTip,
        };

        for (const [keyPath, val] of Object.entries(map)) {
          expect(typeof val, `${locale} key ${keyPath} should be string`).toBe('string');
          expect(val.trim().length, `${locale} key ${keyPath} must not be empty or whitespace`).toBeGreaterThan(0);
          expect(val, `${locale} key ${keyPath} must not be literal undefined`).not.toBe('undefined');
          expect(val, `${locale} key ${keyPath} must not be literal null`).not.toBe('null');
        }
      }
    });

    it('verifies classical Islamic terminology for Arabic night division keys', () => {
      const ar = getTranslations('ar');
      expect(ar.inspector.lastThird).toBe('الثلث الأخير من الليل');
      expect(ar.inspector.nightDuration).toBe('مدة الليل');
      expect(ar.inspector.lastThirdStart).toBe('بداية الثلث الأخير');
      expect(ar.inspector.lastThirdEnd).toBe('نهاية الثلث الأخير (الفجر)');
      expect(ar.inspector.lastThirdActive).toBe('نشط الآن');
      expect(ar.controls.lastThirdActive).toBe('الثلث الأخير نشط');
      expect(ar.timeline.lastThirdCities).toBe('مدن في الثلث الأخير');
      expect(ar.stats.citiesInLastThird).toBe('مدن في الثلث الأخير');
    });
  });

  // =========================================================================
  // Requirement 2: Strict Exclusion of Eastern Arabic-Indic and Persian Digits
  // =========================================================================
  describe('Requirement 2: Zero Eastern Arabic-Indic and Zero Persian Digits', () => {
    // Eastern Arabic-Indic: U+0660 to U+0669 (٠-٩)
    const easternArabicIndicRegex = /[\u0660-\u0669]/;
    // Extended Arabic-Indic / Persian: U+06F0 to U+06F9 (۰-۹)
    const persianDigitsRegex = /[\u06F0-\u06F9]/;

    it('verifies zero Eastern Arabic-Indic digits exist in any string across all 10 dictionaries', () => {
      const violations: Array<{ locale: string; path: string; text: string; codePoint: string }> = [];

      for (const locale of supportedLocales) {
        const leafStrings = getAllLeafStrings(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leafStrings) {
          if (easternArabicIndicRegex.test(leaf.value)) {
            for (const ch of leaf.value) {
              const cp = ch.codePointAt(0) ?? 0;
              if (cp >= 0x0660 && cp <= 0x0669) {
                violations.push({
                  locale,
                  path: leaf.path,
                  text: leaf.value,
                  codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
                });
              }
            }
          }
        }
      }

      expect(violations, `Violations found: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies zero Persian digits exist in any string across all 10 dictionaries', () => {
      const violations: Array<{ locale: string; path: string; text: string; codePoint: string }> = [];

      for (const locale of supportedLocales) {
        const leafStrings = getAllLeafStrings(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leafStrings) {
          if (persianDigitsRegex.test(leaf.value)) {
            for (const ch of leaf.value) {
              const cp = ch.codePointAt(0) ?? 0;
              if (cp >= 0x06F0 && cp <= 0x06F9) {
                violations.push({
                  locale,
                  path: leaf.path,
                  text: leaf.value,
                  codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
                });
              }
            }
          }
        }
      }

      expect(violations, `Violations found: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies JSON serialization of each dictionary contains zero Eastern Arabic-Indic or Persian digits', () => {
      const forbiddenDigitsRegex = /[\u0660-\u0669\u06F0-\u06F9]/;
      for (const locale of supportedLocales) {
        const serialized = JSON.stringify(DICTIONARIES[locale]);
        expect(forbiddenDigitsRegex.test(serialized), `Found forbidden digits in ${locale}`).toBe(false);
      }
    });

    it('verifies that any numeral occurring in any dictionary is strictly in ASCII 0-9', () => {
      for (const locale of supportedLocales) {
        const leafStrings = getAllLeafStrings(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leafStrings) {
          for (const ch of leaf.value) {
            const cp = ch.codePointAt(0) ?? 0;
            // Check non-ASCII Arabic, Persian, Devanagari, Bengali, etc.
            const isNonAsciiDigit =
              (cp >= 0x0660 && cp <= 0x0669) || // Arabic-Indic
              (cp >= 0x06F0 && cp <= 0x06F9) || // Persian
              (cp >= 0x0966 && cp <= 0x096F) || // Devanagari
              (cp >= 0x09E6 && cp <= 0x09EF);   // Bengali

            expect(
              isNonAsciiDigit,
              `Found non-ASCII digit character U+${cp.toString(16).toUpperCase()} in ${locale}.${leaf.path}: "${leaf.value}"`,
            ).toBe(false);
          }
        }
      }
    });
  });

  // =========================================================================
  // Requirement 3: Zero Em Dashes Across Any Translation Text
  // =========================================================================
  describe('Requirement 3: Zero Em Dashes In Translation Text', () => {
    // Unicode em dash variants:
    // U+2014: EM DASH (—)
    // U+2015: HORIZONTAL BAR / QUOTATION DASH (―)
    // U+2E3A: TWO-EM DASH (⸺)
    // U+2E3B: THREE-EM DASH (⸻)
    const emDashRegex = /[\u2014\u2015\u2E3A\u2E3B]/;

    it('verifies zero em dashes exist across all 10 translation dictionaries', () => {
      const violations: Array<{ locale: string; path: string; text: string; codePoint: string }> = [];

      for (const locale of supportedLocales) {
        const leafStrings = getAllLeafStrings(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leafStrings) {
          if (emDashRegex.test(leaf.value)) {
            for (const ch of leaf.value) {
              const cp = ch.codePointAt(0) ?? 0;
              if (cp === 0x2014 || cp === 0x2015 || cp === 0x2E3A || cp === 0x2E3B) {
                violations.push({
                  locale,
                  path: leaf.path,
                  text: leaf.value,
                  codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
                });
              }
            }
          }
        }
      }

      expect(violations, `Found em dashes in translations: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies serialized JSON of all 10 dictionaries does not contain em dash characters', () => {
      for (const locale of supportedLocales) {
        const serialized = JSON.stringify(DICTIONARIES[locale]);
        expect(serialized).not.toContain('\u2014');
        expect(serialized).not.toContain('—');
        expect(serialized).not.toContain('\u2015');
      }
    });
  });

  // =========================================================================
  // Requirement 4: Locale Resolution & Fallback Oracle
  // =========================================================================
  describe('Requirement 4: Locale Resolution and getTranslations Oracle', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    afterEach(() => {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    });

    it('verifies getTranslations returns exact dictionary for all 10 supported locales', () => {
      for (const locale of supportedLocales) {
        const trans = getTranslations(locale);
        expect(trans).toBeDefined();
        expect(trans).toBe(DICTIONARIES[locale]);
        expect(trans.brand.title.length).toBeGreaterThan(0);
        expect(trans.inspector.lastThird.length).toBeGreaterThan(0);
      }
    });

    it('verifies getTranslations falls back to English for unknown or invalid locale strings', () => {
      const invalidLocales = [
        'de',
        'es',
        'zh',
        'jp',
        '',
        '   ',
        'invalid_locale',
        'EN',
        'AR',
        'null',
        'undefined',
        '__proto__',
        'constructor',
        'toString',
      ];

      for (const bad of invalidLocales) {
        const trans = getTranslations(bad as SupportedLocale);
        expect(trans).toBeDefined();
        expect(trans).toBe(DICTIONARIES.en);
        expect(trans.brand.title).toBe(DICTIONARIES.en.brand.title);
      }
    });

    it('verifies isSupportedLocale validates true only for supported codes', () => {
      for (const loc of supportedLocales) {
        expect(isSupportedLocale(loc)).toBe(true);
      }

      expect(isSupportedLocale('de')).toBe(false);
      expect(isSupportedLocale('es')).toBe(false);
      expect(isSupportedLocale('EN')).toBe(false);
      expect(isSupportedLocale('')).toBe(false);
      expect(isSupportedLocale(null)).toBe(false);
      expect(isSupportedLocale(undefined)).toBe(false);
      expect(isSupportedLocale(123)).toBe(false);
      expect(isSupportedLocale('toString')).toBe(false);
      expect(isSupportedLocale('constructor')).toBe(false);
      expect(isSupportedLocale('__proto__')).toBe(false);
    });

    it('verifies detectLocale resolves path-based prefix for all 10 locales', () => {
      for (const loc of supportedLocales) {
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/${loc}`),
        } as unknown as Window & typeof globalThis;

        expect(detectLocale()).toBe(loc);
      }
    });

    it('verifies detectLocale resolves URL search param (?lang=) at root', () => {
      for (const loc of supportedLocales) {
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/?lang=${loc}`),
        } as unknown as Window & typeof globalThis;

        expect(detectLocale()).toBe(loc);
      }
    });

    it('verifies path prefix takes precedence over search param', () => {
      globalThis.window = {
        location: new URL('https://athan.waqf.app/ar?lang=fr'),
      } as unknown as Window & typeof globalThis;

      expect(detectLocale()).toBe('ar');
    });

    it('verifies detectLocale falls back to DEFAULT_LOCALE when window is undefined', () => {
      globalThis.window = undefined as unknown as Window & typeof globalThis;
      expect(detectLocale()).toBe(DEFAULT_LOCALE);
    });

    it('verifies detectLocale falls back to DEFAULT_LOCALE for invalid paths and query params', () => {
      globalThis.window = {
        location: new URL('https://athan.waqf.app/unsupported?lang=invalid'),
      } as unknown as Window & typeof globalThis;

      expect(detectLocale()).toBe(DEFAULT_LOCALE);
    });

    it('verifies detectLocale guards against prototype property injection in URL and query', () => {
      const prototypeAttackKeys = ['constructor', 'toString', 'valueOf', '__proto__', 'isPrototypeOf'];

      for (const key of prototypeAttackKeys) {
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/${key}`),
        } as unknown as Window & typeof globalThis;

        expect(detectLocale(), `Path /${key} should fall back to default`).toBe(DEFAULT_LOCALE);

        globalThis.window = {
          location: new URL(`https://athan.waqf.app/?lang=${key}`),
        } as unknown as Window & typeof globalThis;

        expect(detectLocale(), `Query ?lang=${key} should fall back to default`).toBe(DEFAULT_LOCALE);
      }
    });
  });
});
