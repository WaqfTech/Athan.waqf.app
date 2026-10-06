import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  DEFAULT_LOCALE,
  detectLocale,
  isSupportedLocale,
} from '../src/i18n/config';
import {
  DICTIONARIES,
  Translations,
  getTranslations,
} from '../src/i18n/translations';
import { i18n } from '../src/i18n/manager';

describe('Challenger M2: Internationalization & Translation Dictionary Stress Oracle', () => {
  const allLocales: SupportedLocale[] = [
    'en',
    'ar',
    'tr',
    'id',
    'ms',
    'ur',
    'fa',
    'bn',
    'fr',
    'ru',
  ];

  function getLeafEntries(
    obj: Record<string, unknown>,
    prefix = '',
  ): Array<{ path: string; value: unknown }> {
    const leaves: Array<{ path: string; value: unknown }> = [];
    for (const [k, v] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        leaves.push(...getLeafEntries(v as Record<string, unknown>, currentPath));
      } else {
        leaves.push({ path: currentPath, value: v });
      }
    }
    return leaves;
  }

  describe('Suite 1: Strict Structural Parity Across All 10 Locales', () => {
    it('defines exactly the 10 required locales in both config and dictionaries', () => {
      const configLocales = Object.keys(SUPPORTED_LOCALES).sort();
      const dictLocales = Object.keys(DICTIONARIES).sort();
      const expected = [...allLocales].sort();

      expect(configLocales).toEqual(expected);
      expect(dictLocales).toEqual(expected);
    });

    it('verifies every section and key in English exists symmetrically in all 9 other locales', () => {
      const enLeaves = getLeafEntries(
        DICTIONARIES.en as unknown as Record<string, unknown>,
      );
      const enKeySet = new Set(enLeaves.map((l) => l.path));

      for (const locale of allLocales) {
        if (locale === 'en') continue;

        const locDict = DICTIONARIES[locale] as unknown as Record<
          string,
          unknown
        >;
        const locLeaves = getLeafEntries(locDict);
        const locKeySet = new Set(locLeaves.map((l) => l.path));

        const missingInLocale = [...enKeySet].filter((k) => !locKeySet.has(k));
        const extraInLocale = [...locKeySet].filter((k) => !enKeySet.has(k));

        expect(
          missingInLocale,
          `Locale ${locale} is missing keys present in English reference`,
        ).toEqual([]);

        expect(
          extraInLocale,
          `Locale ${locale} contains unexpected extra keys not in English reference`,
        ).toEqual([]);
      }
    });

    it('verifies all Milestone 2 Islamic night division keys exist across all 10 locales', () => {
      const requiredM2Keys = [
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
      ];

      for (const locale of allLocales) {
        const dict = DICTIONARIES[locale] as unknown as Record<
          string,
          unknown
        >;
        const leaves = getLeafEntries(dict);
        const keyMap = new Map(leaves.map((l) => [l.path, l.value]));

        for (const reqKey of requiredM2Keys) {
          expect(
            keyMap.has(reqKey),
            `Locale ${locale} must define Milestone 2 key: ${reqKey}`,
          ).toBe(true);
        }
      }
    });
  });

  describe('Suite 2: Value Hygiene, Non-Emptiness, and Format Invariants', () => {
    it('verifies no key has undefined, null, empty string, or whitespace-only content', () => {
      const whitespaceOnlyRegex = /^\s*$/;
      const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF]/;

      for (const locale of allLocales) {
        const dict = DICTIONARIES[locale] as unknown as Record<
          string,
          unknown
        >;
        const leaves = getLeafEntries(dict);

        for (const leaf of leaves) {
          expect(
            leaf.value,
            `Locale ${locale} key ${leaf.path} must not be undefined or null`,
          ).not.toBeUndefined();
          expect(
            leaf.value,
            `Locale ${locale} key ${leaf.path} must not be null`,
          ).not.toBeNull();

          expect(
            typeof leaf.value,
            `Locale ${locale} key ${leaf.path} must be a string`,
          ).toBe('string');

          const strVal = leaf.value as string;

          expect(
            strVal.length,
            `Locale ${locale} key ${leaf.path} must have length > 0`,
          ).toBeGreaterThan(0);

          expect(
            whitespaceOnlyRegex.test(strVal),
            `Locale ${locale} key ${leaf.path} must not be whitespace-only`,
          ).toBe(false);

          expect(
            strVal.trim().length,
            `Locale ${locale} key ${leaf.path} trimmed length must be > 0`,
          ).toBeGreaterThan(0);

          expect(
            strVal,
            `Locale ${locale} key ${leaf.path} must not be literal string "undefined"`,
          ).not.toBe('undefined');

          expect(
            strVal,
            `Locale ${locale} key ${leaf.path} must not be literal string "null"`,
          ).not.toBe('null');

          expect(
            strVal,
            `Locale ${locale} key ${leaf.path} must not be literal string "[object Object]"`,
          ).not.toBe('[object Object]');
        }
      }
    });

    it('verifies strict absence of Eastern Arabic-Indic numerals across all dictionaries', () => {
      const easternNumeralsRegex = /[\u0660-\u0669\u06F0-\u06F9]/;

      for (const locale of allLocales) {
        const dict = DICTIONARIES[locale] as unknown as Record<
          string,
          unknown
        >;
        const leaves = getLeafEntries(dict);

        for (const leaf of leaves) {
          const strVal = String(leaf.value);
          const hasEastern = easternNumeralsRegex.test(strVal);
          expect(
            hasEastern,
            `Locale ${locale} key ${leaf.path} contains Eastern numerals: "${strVal}"`,
          ).toBe(false);
        }
      }
    });
  });

  describe('Suite 3: Dynamic Translation Retrieval & Fallback Safety', () => {
    it('returns valid Translations object for every valid supported locale', () => {
      for (const locale of allLocales) {
        const trans = getTranslations(locale);
        expect(trans).toBeDefined();
        expect(trans).toBe(DICTIONARIES[locale]);
        expect(trans.brand.title.length).toBeGreaterThan(0);
        expect(trans.inspector.lastThird.length).toBeGreaterThan(0);
      }
    });

    it('falls back safely to English for unsupported, empty, or malformed locale codes', () => {
      const invalidLocales = [
        'de',
        'es',
        'zh',
        'jp',
        '',
        '   ',
        'unknown',
        'EN',
        'AR',
        'null',
        'undefined',
        '!@#$',
        '../../etc/passwd',
      ];

      for (const badLocale of invalidLocales) {
        const trans = getTranslations(badLocale as SupportedLocale);
        expect(
          trans,
          `getTranslations("${badLocale}") must return a valid dictionary`,
        ).toBeDefined();
        expect(
          trans,
          `getTranslations("${badLocale}") must fall back to English dictionary`,
        ).toBe(DICTIONARIES.en);
        expect(trans.brand.title).toBe(DICTIONARIES.en.brand.title);
      }
    });

    it('falls back safely for Object prototype property names passed as locale', () => {
      const protoKeys = [
        'toString',
        'valueOf',
        'constructor',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        '__proto__',
      ];

      for (const key of protoKeys) {
        const trans = getTranslations(key as SupportedLocale);
        expect(
          trans,
          `getTranslations("${key}") must not return prototype method or object`,
        ).toBe(DICTIONARIES.en);
        expect(
          trans.brand,
          `getTranslations("${key}").brand must be defined`,
        ).toBeDefined();
        expect(
          trans.brand.title,
          `getTranslations("${key}").brand.title must be defined`,
        ).toBe(DICTIONARIES.en.brand.title);
      }
    });

    it('rejects Object prototype property names in detectLocale() URL pathname and query params', () => {
      const originalWindow = globalThis.window;
      const protoKeys = ['constructor', 'toString', 'valueOf', '__proto__'];

      for (const key of protoKeys) {
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/${key}`),
        } as unknown as Window & typeof globalThis;

        const pathDetected = detectLocale();
        expect(
          pathDetected,
          `detectLocale() for path /${key} must fall back to default locale`,
        ).toBe(DEFAULT_LOCALE);

        globalThis.window = {
          location: new URL(`https://athan.waqf.app/?lang=${key}`),
        } as unknown as Window & typeof globalThis;

        const queryDetected = detectLocale();
        expect(
          queryDetected,
          `detectLocale() for query ?lang=${key} must fall back to default locale`,
        ).toBe(DEFAULT_LOCALE);
      }

      globalThis.window = originalWindow;
    });

    it('falls back safely when passed null or undefined coerced as locale', () => {
      const nullResult = getTranslations(null as unknown as SupportedLocale);
      expect(nullResult).toBe(DICTIONARIES.en);

      const undefResult = getTranslations(undefined as unknown as SupportedLocale);
      expect(undefResult).toBe(DICTIONARIES.en);
    });
  });

  describe('Suite 4: Rapid Locale Switching Stress & Concurrency Simulation', () => {
    const originalDoc = globalThis.document;
    const originalWindow = globalThis.window;

    beforeEach(() => {
      globalThis.document = {
        documentElement: {
          lang: 'en',
          dir: 'ltr',
        },
        title: 'Adhan Earth',
        querySelector: () => null,
      } as unknown as Document;
    });

    afterEach(() => {
      globalThis.document = originalDoc;
      globalThis.window = originalWindow;
    });

    it('survives 10,000 rapid sequential locale transitions without throwing or yielding undefined', () => {
      const iterations = 10000;
      let lastTranslations: Translations | null = null;

      for (let i = 0; i < iterations; i++) {
        const targetLocale = allLocales[i % allLocales.length];
        i18n.setLocale(targetLocale);

        const currentLocale = i18n.getLocale();
        const currentTranslations = i18n.getTranslations();

        expect(currentLocale).toBe(targetLocale);
        expect(currentTranslations).toBeDefined();
        expect(currentTranslations.brand.title.length).toBeGreaterThan(0);
        expect(currentTranslations.inspector.lastThird.length).toBeGreaterThan(0);
        expect(currentTranslations.stats.citiesInLastThird.length).toBeGreaterThan(0);

        lastTranslations = currentTranslations;
      }

      expect(lastTranslations).not.toBeNull();
    });

    it('notifies multiple concurrent listeners correctly across rapid switching cycles', () => {
      const listener1Calls: string[] = [];
      const listener2Calls: string[] = [];
      const listener3Calls: string[] = [];

      const unsub1 = i18n.onLocaleChange((locale) => {
        listener1Calls.push(locale);
      });
      const unsub2 = i18n.onLocaleChange((locale) => {
        listener2Calls.push(locale);
      });
      const unsub3 = i18n.onLocaleChange((locale, trans) => {
        listener3Calls.push(`${locale}:${trans.brand.title}`);
      });

      const sequence: SupportedLocale[] = ['ar', 'tr', 'id', 'ur', 'fr', 'en', 'bn', 'fa', 'ms', 'ru'];

      for (const loc of sequence) {
        i18n.setLocale(loc);
      }

      expect(listener1Calls).toEqual(sequence);
      expect(listener2Calls).toEqual(sequence);
      expect(listener3Calls.length).toBe(sequence.length);

      // Verify unsubscription works cleanly
      unsub1();
      unsub2();
      unsub3();

      i18n.setLocale('en');
      expect(listener1Calls.length).toBe(sequence.length);
      expect(listener2Calls.length).toBe(sequence.length);
      expect(listener3Calls.length).toBe(sequence.length);
    });

    it('isolates listener errors so subsequent listeners still execute during locale change', () => {
      const errorListener = () => {
        throw new Error('Intentional challenge error in listener');
      };
      let healthyListenerCalled = false;
      const healthyListener = () => {
        healthyListenerCalled = true;
      };

      const unsubBad = i18n.onLocaleChange(errorListener);
      const unsubGood = i18n.onLocaleChange(healthyListener);

      expect(() => {
        i18n.setLocale('ar');
      }).not.toThrow();

      expect(healthyListenerCalled).toBe(true);

      unsubBad();
      unsubGood();
    });

    it('operates safely when document or window is undefined (SSR / edge worker context)', () => {
      globalThis.document = undefined as unknown as Document;

      expect(() => {
        i18n.setLocale('ar');
        const trans = i18n.getTranslations();
        expect(trans.inspector.lastThird).toBe('الثلث الأخير من الليل');
      }).not.toThrow();
    });
  });

  describe('Suite 5: Milestone 2 Iteration 2: Exhaustive Object.prototype Security Oracle', () => {
    const requiredProtoKeys = [
      'toString',
      'valueOf',
      'constructor',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
      '__proto__',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
    ] as const;

    // Dynamically retrieve all property names directly on Object.prototype as well
    const allObjectProtoNames = Array.from(
      new Set([
        ...requiredProtoKeys,
        ...Object.getOwnPropertyNames(Object.prototype),
      ]),
    );

    const originalWindow = globalThis.window;
    const origNavigatorDesc = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    const origLocalStorageDesc = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage',
    );

    afterEach(() => {
      globalThis.window = originalWindow;
      if (origNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
      } else {
        delete (globalThis as unknown as Record<string, unknown>).navigator;
      }
      if (origLocalStorageDesc) {
        Object.defineProperty(globalThis, 'localStorage', origLocalStorageDesc);
      } else {
        delete (globalThis as unknown as Record<string, unknown>).localStorage;
      }
    });

    it('verifies required list contains all 12 properties from prompt', () => {
      expect(requiredProtoKeys).toHaveLength(12);
      expect(new Set(requiredProtoKeys).size).toBe(12);
    });

    it('Requirement 2: isSupportedLocale(prop) evaluates to false for all Object.prototype property names', () => {
      for (const prop of allObjectProtoNames) {
        expect(
          isSupportedLocale(prop),
          `isSupportedLocale("${prop}") must be false`,
        ).toBe(false);

        // Also test casing variations
        expect(
          isSupportedLocale(prop.toUpperCase()),
          `isSupportedLocale("${prop.toUpperCase()}") must be false`,
        ).toBe(false);
      }
    });

    it('Requirement 1: getTranslations(prop as any) ALWAYS returns DICTIONARIES.en with full valid structure, never a function or undefined', () => {
      for (const prop of allObjectProtoNames) {
        const trans = getTranslations(prop as unknown as SupportedLocale);

        // Identity and structure
        expect(
          trans,
          `getTranslations("${prop}") must strictly reference DICTIONARIES.en`,
        ).toBe(DICTIONARIES.en);
        expect(
          typeof trans,
          `getTranslations("${prop}") must be object, not function or primitive`,
        ).toBe('object');
        expect(trans).not.toBeNull();
        expect(
          typeof trans !== 'function',
          `getTranslations("${prop}") must never be a function`,
        ).toBe(true);

        // Core sections integrity
        expect(trans.brand).toBeDefined();
        expect(trans.brand.title).toBe(DICTIONARIES.en.brand.title);
        expect(trans.search).toBeDefined();
        expect(trans.controls).toBeDefined();
        expect(trans.credits).toBeDefined();
        expect(trans.prayers).toBeDefined();
        expect(trans.inspector).toBeDefined();
        expect(trans.timeline).toBeDefined();
        expect(trans.stats).toBeDefined();

        // Milestone 2 Islamic night keys presence and non-emptiness
        expect(trans.inspector.lastThird).toBe(DICTIONARIES.en.inspector.lastThird);
        expect(trans.inspector.nightDuration).toBe(DICTIONARIES.en.inspector.nightDuration);
        expect(trans.inspector.lastThirdStart).toBe(DICTIONARIES.en.inspector.lastThirdStart);
        expect(trans.inspector.lastThirdEnd).toBe(DICTIONARIES.en.inspector.lastThirdEnd);
        expect(trans.inspector.lastThirdActive).toBe(DICTIONARIES.en.inspector.lastThirdActive);
        expect(trans.inspector.countdown).toBe(DICTIONARIES.en.inspector.countdown);
        expect(trans.controls.lastThirdActive).toBe(DICTIONARIES.en.controls.lastThirdActive);
        expect(trans.timeline.lastThirdCities).toBe(DICTIONARIES.en.timeline.lastThirdCities);
        expect(trans.timeline.lastThirdTip).toBe(DICTIONARIES.en.timeline.lastThirdTip);
        expect(trans.stats.citiesInLastThird).toBe(DICTIONARIES.en.stats.citiesInLastThird);
        expect(trans.stats.lastThirdTip).toBe(DICTIONARIES.en.stats.lastThirdTip);
      }
    });

    it('Requirement 3 (Path): detectLocale() with prototype keys in path always falls back to en', () => {
      for (const prop of allObjectProtoNames) {
        // Direct root path: /toString
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/${prop}`),
        } as unknown as Window & typeof globalThis;
        expect(
          detectLocale(),
          `detectLocale() for path /${prop} must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);

        // Nested subpath: /toString/detail
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/${prop}/detail`),
        } as unknown as Window & typeof globalThis;
        expect(
          detectLocale(),
          `detectLocale() for subpath /${prop}/detail must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);

        // Multiple leading/trailing slashes: ///toString///
        globalThis.window = {
          location: new URL(`https://athan.waqf.app///${prop}///`),
        } as unknown as Window & typeof globalThis;
        expect(
          detectLocale(),
          `detectLocale() for multi-slash path ///${prop}/// must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);
      }
    });

    it('Requirement 3 (Query): detectLocale() with prototype keys in query parameter always falls back to en', () => {
      for (const prop of allObjectProtoNames) {
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/?lang=${prop}`),
        } as unknown as Window & typeof globalThis;
        expect(
          detectLocale(),
          `detectLocale() for query ?lang=${prop} must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);

        globalThis.window = {
          location: new URL(`https://athan.waqf.app/?foo=1&lang=${prop}&bar=2`),
        } as unknown as Window & typeof globalThis;
        expect(
          detectLocale(),
          `detectLocale() for multi-param query ?lang=${prop} must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);
      }
    });

    it('Requirement 3 (Storage): detectLocale() with prototype keys in localStorage always falls back to en', () => {
      for (const prop of allObjectProtoNames) {
        globalThis.window = {
          location: new URL('https://athan.waqf.app/'),
        } as unknown as Window & typeof globalThis;

        Object.defineProperty(globalThis, 'localStorage', {
          value: {
            getItem: (k: string) => (k === 'adhan_locale' ? prop : null),
          },
          configurable: true,
        });

        expect(
          detectLocale(),
          `detectLocale() with localStorage adhan_locale="${prop}" must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);
      }
    });

    it('Requirement 3 (Navigator): detectLocale() with prototype keys in navigator always falls back to en', () => {
      for (const prop of allObjectProtoNames) {
        globalThis.window = {
          location: new URL('https://athan.waqf.app/'),
        } as unknown as Window & typeof globalThis;

        Object.defineProperty(globalThis, 'localStorage', {
          value: {
            getItem: () => null,
          },
          configurable: true,
        });

        // Test navigator.languages array
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            languages: [prop, `${prop}-US`],
            language: prop,
          },
          configurable: true,
        });

        expect(
          detectLocale(),
          `detectLocale() with navigator.languages=["${prop}"] must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);

        // Test navigator.language fallback when navigator.languages is undefined
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            languages: undefined,
            language: prop,
          },
          configurable: true,
        });

        expect(
          detectLocale(),
          `detectLocale() with navigator.language="${prop}" must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);
      }
    });

    it('Requirement 3 (Compound): detectLocale() with prototype keys in ALL vectors simultaneously falls back to en', () => {
      for (const prop of allObjectProtoNames) {
        globalThis.window = {
          location: new URL(`https://athan.waqf.app/${prop}?lang=${prop}`),
        } as unknown as Window & typeof globalThis;

        Object.defineProperty(globalThis, 'localStorage', {
          value: {
            getItem: (k: string) => (k === 'adhan_locale' ? prop : null),
          },
          configurable: true,
        });

        Object.defineProperty(globalThis, 'navigator', {
          value: {
            languages: [prop],
            language: prop,
          },
          configurable: true,
        });

        const detected = detectLocale();
        expect(
          detected,
          `detectLocale() with all vectors set to "${prop}" must fall back to 'en'`,
        ).toBe(DEFAULT_LOCALE);

        const trans = getTranslations(detected);
        expect(trans).toBe(DICTIONARIES.en);
      }
    });
  });
});
