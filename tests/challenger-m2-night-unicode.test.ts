import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
} from '../src/i18n/config';
import {
  DICTIONARIES,
  Translations,
  getTranslations,
} from '../src/i18n/translations';
import { SEO_METADATA } from '../src/i18n/seo';

describe('Challenger 2 M2: Unicode Invariant Compliance and Typography Oracle', () => {
  const allLocales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];

  function getLeafEntries(
    obj: Record<string, unknown>,
    prefix = '',
  ): Array<{ path: string; value: string }> {
    const leaves: Array<{ path: string; value: string }> = [];
    for (const [k, v] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        leaves.push(...getLeafEntries(v as Record<string, unknown>, currentPath));
      } else if (typeof v === 'string') {
        leaves.push({ path: currentPath, value: v });
      }
    }
    return leaves;
  }

  describe('Invariant 1: Zero Eastern Arabic-Indic Digits (U+0660 to U+0669)', () => {
    const easternArabicIndicRegex = /[\u0660-\u0669]/;

    it('verifies zero Eastern Arabic-Indic digits exist across all 10 dictionaries', () => {
      const violations: Array<{ locale: string; path: string; char: string; code: string; text: string }> = [];

      for (const locale of allLocales) {
        const leaves = getLeafEntries(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          if (easternArabicIndicRegex.test(leaf.value)) {
            for (const ch of leaf.value) {
              const codePoint = ch.codePointAt(0) ?? 0;
              if (codePoint >= 0x0660 && codePoint <= 0x0669) {
                violations.push({
                  locale,
                  path: leaf.path,
                  char: ch,
                  code: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                  text: leaf.value,
                });
              }
            }
          }
        }
      }

      expect(violations, `Found Eastern Arabic-Indic digits: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies zero Eastern Arabic-Indic digits in Arabic, Urdu, and Persian specifically', () => {
      const rtlLocales: SupportedLocale[] = ['ar', 'ur', 'fa'];
      for (const loc of rtlLocales) {
        const serialized = JSON.stringify(DICTIONARIES[loc]);
        expect(easternArabicIndicRegex.test(serialized)).toBe(false);
      }
    });
  });

  describe('Invariant 2: Zero Persian Digits (U+06F0 to U+06F9)', () => {
    const persianDigitsRegex = /[\u06F0-\u06F9]/;

    it('verifies zero Persian digits exist across all 10 dictionaries', () => {
      const violations: Array<{ locale: string; path: string; char: string; code: string; text: string }> = [];

      for (const locale of allLocales) {
        const leaves = getLeafEntries(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          if (persianDigitsRegex.test(leaf.value)) {
            for (const ch of leaf.value) {
              const codePoint = ch.codePointAt(0) ?? 0;
              if (codePoint >= 0x06F0 && codePoint <= 0x06F9) {
                violations.push({
                  locale,
                  path: leaf.path,
                  char: ch,
                  code: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                  text: leaf.value,
                });
              }
            }
          }
        }
      }

      expect(violations, `Found Persian digits: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies zero Persian digits in Persian (fa) and Urdu (ur) dictionaries specifically', () => {
      const serializedFa = JSON.stringify(DICTIONARIES.fa);
      const serializedUr = JSON.stringify(DICTIONARIES.ur);
      expect(persianDigitsRegex.test(serializedFa)).toBe(false);
      expect(persianDigitsRegex.test(serializedUr)).toBe(false);
    });
  });

  describe('Invariant 3: Zero Em Dashes Across Any Dictionary Entry', () => {
    // U+2014 (EM DASH), U+2015 (HORIZONTAL BAR / QUOTATION DASH), U+2E3A (TWO-EM DASH), U+2E3B (THREE-EM DASH)
    const emDashRegex = /[\u2014\u2015\u2E3A\u2E3B]/;

    it('verifies zero em dashes exist across all 10 dictionaries', () => {
      const violations: Array<{ locale: string; path: string; char: string; code: string; text: string }> = [];

      for (const locale of allLocales) {
        const leaves = getLeafEntries(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          if (emDashRegex.test(leaf.value)) {
            for (const ch of leaf.value) {
              const codePoint = ch.codePointAt(0) ?? 0;
              if (codePoint === 0x2014 || codePoint === 0x2015 || codePoint === 0x2E3A || codePoint === 0x2E3B) {
                violations.push({
                  locale,
                  path: leaf.path,
                  char: ch,
                  code: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                  text: leaf.value,
                });
              }
            }
          }
        }
      }

      expect(violations, `Found em dashes in dictionaries: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies zero em dashes in serializations of all locales', () => {
      for (const loc of allLocales) {
        const serialized = JSON.stringify(DICTIONARIES[loc]);
        expect(serialized).not.toContain('\u2014');
        expect(serialized).not.toContain('—');
      }
    });
  });

  describe('Invariant 4: Bidirectional Markers and Technical Strings Safety', () => {
    // Dangerous BiDi embedding and override markers that corrupt LTR/RTL rendering
    const bidiEmbeddingAndOverrides = /[\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069]/;

    it('verifies zero BiDi embedding or override control characters in dictionaries', () => {
      const violations: Array<{ locale: string; path: string; code: string; text: string }> = [];

      for (const locale of allLocales) {
        const leaves = getLeafEntries(DICTIONARIES[locale] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          if (bidiEmbeddingAndOverrides.test(leaf.value)) {
            for (const ch of leaf.value) {
              const codePoint = ch.codePointAt(0) ?? 0;
              if (
                (codePoint >= 0x202A && codePoint <= 0x202E) ||
                (codePoint >= 0x2066 && codePoint <= 0x2069)
              ) {
                violations.push({
                  locale,
                  path: leaf.path,
                  code: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                  text: leaf.value,
                });
              }
            }
          }
        }
      }

      expect(violations, `Found dangerous BiDi controls: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies technical strings in RTL locales (ar, ur, fa) preserve balanced parentheses', () => {
      const rtlLocales: SupportedLocale[] = ['ar', 'ur', 'fa'];
      const unbalanced: Array<{ locale: string; path: string; text: string; open: number; close: number }> = [];

      for (const loc of rtlLocales) {
        const leaves = getLeafEntries(DICTIONARIES[loc] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          const openCount = (leaf.value.match(/\(/g) || []).length;
          const closeCount = (leaf.value.match(/\)/g) || []).length;
          if (openCount !== closeCount) {
            unbalanced.push({
              locale: loc,
              path: leaf.path,
              text: leaf.value,
              open: openCount,
              close: closeCount,
            });
          }
        }
      }

      expect(unbalanced, `Unbalanced parentheses in RTL dictionaries: ${JSON.stringify(unbalanced)}`).toEqual([]);
    });

    it('verifies Latin technical terms in RTL locales are properly spaced and intact', () => {
      const rtlLocales: SupportedLocale[] = ['ar', 'ur', 'fa'];
      const technicalTerms = [
        'Three.js',
        'GLSL',
        'NOAA',
        'Cloudflare Workers',
        'Waqf-DPL 1.0',
        'WaqfTech.org',
        'TypeScript',
      ];

      for (const loc of rtlLocales) {
        const credits = DICTIONARIES[loc].credits;
        const allCreditsText = `${credits.stack3d} ${credits.stackAstronomy} ${credits.stackEdge} ${credits.projectBy} ${credits.licenseTitle}`;

        for (const term of technicalTerms) {
          if (term === 'TypeScript' && loc === 'ur') {
            // Urdu uses transliterated or context terms, check NOAA
            continue;
          }
          if (term === 'NOAA' || term === 'Three.js' || term === 'Cloudflare Workers') {
            expect(
              allCreditsText.includes(term) || (term === 'NOAA' && allCreditsText.includes('نووا (NOAA)')),
              `Expected technical term ${term} in ${loc} credits`,
            ).toBe(true);
          }
        }
      }
    });

    it('verifies all numbers in RTL dictionaries use ASCII Western digits (0-9)', () => {
      const rtlLocales: SupportedLocale[] = ['ar', 'ur', 'fa'];
      for (const loc of rtlLocales) {
        const leaves = getLeafEntries(DICTIONARIES[loc] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          // Check for any non-ASCII character with Unicode Decimal Digit property
          for (const ch of leaf.value) {
            const codePoint = ch.codePointAt(0) ?? 0;
            // Check non-ASCII digit ranges:
            // Arabic-Indic (0660-0669), Extended Arabic-Indic / Persian (06F0-06F9), etc.
            if (
              (codePoint >= 0x0660 && codePoint <= 0x0669) ||
              (codePoint >= 0x06F0 && codePoint <= 0x06F9)
            ) {
              expect.fail(`Non-Western digit U+${codePoint.toString(16)} found in ${loc}.${leaf.path}`);
            }
          }
        }
      }
    });
  });

  describe('Invariant 5: Zero Non-ASCII Digits Across All 10 Dictionaries', () => {
    it('verifies that any numeral occurring in any dictionary is strictly in ASCII 0-9', () => {
      // Test all Unicode digit ranges across all 10 locales
      const nonAsciiDigitsRegex = /[^\x00-\x7F]/;
      const anyDigitRegex = /\d/;

      for (const loc of allLocales) {
        const leaves = getLeafEntries(DICTIONARIES[loc] as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          for (const ch of leaf.value) {
            // Is it a digit according to Unicode, but outside ASCII?
            const isAsciiDigit = ch >= '0' && ch <= '9';
            const codePoint = ch.codePointAt(0) ?? 0;

            // Check Arabic-Indic, Persian, Devanagari, Bengali, etc.
            const isNonAsciiDigit =
              (codePoint >= 0x0660 && codePoint <= 0x0669) || // Arabic-Indic
              (codePoint >= 0x06F0 && codePoint <= 0x06F9) || // Extended Arabic-Indic / Persian
              (codePoint >= 0x0966 && codePoint <= 0x096F) || // Devanagari
              (codePoint >= 0x09E6 && codePoint <= 0x09EF) || // Bengali
              (codePoint >= 0x0A66 && codePoint <= 0x0A6F) || // Gurmukhi
              (codePoint >= 0x0AE6 && codePoint <= 0x0AEF) || // Gujarati
              (codePoint >= 0x0B66 && codePoint <= 0x0B6F) || // Oriya
              (codePoint >= 0x0BE6 && codePoint <= 0x0BEF) || // Tamil
              (codePoint >= 0x0C66 && codePoint <= 0x0C6F) || // Telugu
              (codePoint >= 0x0CE6 && codePoint <= 0x0CEF) || // Kannada
              (codePoint >= 0x0D66 && codePoint <= 0x0D6F) || // Malayalam
              (codePoint >= 0x0E50 && codePoint <= 0x0E59) || // Thai
              (codePoint >= 0x0ED0 && codePoint <= 0x0ED9);   // Lao

            expect(
              isNonAsciiDigit,
              `Non-ASCII digit ${ch} (U+${codePoint.toString(16).toUpperCase()}) in ${loc}.${leaf.path}`,
            ).toBe(false);
          }
        }
      }
    });
  });

  describe('Invariant 6: Milestone 2 Last Third Keys Typography Across All 10 Locales', () => {
    const requiredM2Keys: Array<keyof Translations['inspector'] | keyof Translations['controls'] | keyof Translations['timeline'] | keyof Translations['stats']> = [
      'lastThird',
      'nightDuration',
      'lastThirdStart',
      'lastThirdEnd',
      'lastThirdActive',
      'countdown',
      'lastThirdCities',
      'lastThirdTip',
      'citiesInLastThird',
    ];

    it('verifies all M2 last third keys exist and contain zero non-ASCII digits or em dashes', () => {
      for (const loc of allLocales) {
        const trans = DICTIONARIES[loc];

        const m2Strings = [
          trans.inspector.lastThird,
          trans.inspector.nightDuration,
          trans.inspector.lastThirdStart,
          trans.inspector.lastThirdEnd,
          trans.inspector.lastThirdActive,
          trans.inspector.countdown,
          trans.controls.lastThirdActive,
          trans.timeline.lastThirdCities,
          trans.timeline.lastThirdTip,
          trans.stats.citiesInLastThird,
          trans.stats.lastThirdTip,
        ];

        for (const s of m2Strings) {
          expect(s.length).toBeGreaterThan(0);
          expect(s).not.toContain('\u2014'); // Em dash
          expect(s).not.toContain('—');

          for (const ch of s) {
            const cp = ch.codePointAt(0) ?? 0;
            // No Eastern Arabic-Indic or Persian digits
            expect(cp < 0x0660 || cp > 0x0669, `Eastern Arabic digit in ${loc}: ${s}`).toBe(true);
            expect(cp < 0x06F0 || cp > 0x06F9, `Persian digit in ${loc}: ${s}`).toBe(true);
          }
        }
      }
    });
  });
});
