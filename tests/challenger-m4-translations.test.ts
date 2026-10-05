import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_LOCALES, SupportedLocale } from '../src/i18n/config';
import { DICTIONARIES, Translations, getTranslations } from '../src/i18n/translations';

describe('Challenger M4: i18n & Translation Invariant Oracles', () => {
  const rootDir = path.resolve(__dirname, '..');
  const srcDir = path.resolve(rootDir, 'src');
  const readmePath = path.resolve(rootDir, 'README.md');
  const solarModelPath = path.resolve(rootDir, 'docs/solar-model.md');

  // Helper to collect all file paths in a directory recursively
  function getSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getSourceFiles(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  // Helper to extract all dot-notated leaf key paths and values from an object
  function getLeafEntries(obj: Record<string, unknown>, prefix = ''): Array<{ key: string; value: unknown }> {
    const leaves: Array<{ key: string; value: unknown }> = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        leaves.push(...getLeafEntries(v as Record<string, unknown>, fullKey));
      } else {
        leaves.push({ key: fullKey, value: v });
      }
    }
    return leaves;
  }

  describe('Invariant 1: All 10 locales complete Translations schema with non-empty strings', () => {
    const supportedLocaleKeys = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
    const expectedLocales: SupportedLocale[] = ['en', 'ar', 'tr', 'id', 'ms', 'ur', 'fa', 'bn', 'fr', 'ru'];

    it('contains exactly the 10 specified locales in SUPPORTED_LOCALES and DICTIONARIES', () => {
      expect(supportedLocaleKeys).toHaveLength(10);
      expect(supportedLocaleKeys.sort()).toEqual(expectedLocales.sort());
      expect(Object.keys(DICTIONARIES).sort()).toEqual(expectedLocales.sort());
    });

    const enLeaves = getLeafEntries(DICTIONARIES.en as unknown as Record<string, unknown>);
    const enKeys = enLeaves.map((l) => l.key).sort();

    it('English reference dictionary defines a rich schema with >= 50 leaf keys', () => {
      expect(enKeys.length).toBeGreaterThanOrEqual(50);
    });

    for (const locale of expectedLocales) {
      it(`locale "${locale}" implements all leaf keys without missing, null, or empty values`, () => {
        const dict = DICTIONARIES[locale] as unknown as Record<string, unknown>;
        expect(dict, `Dictionary for locale ${locale} must be defined`).toBeDefined();

        const leaves = getLeafEntries(dict);
        const keys = leaves.map((l) => l.key).sort();

        // Check for missing keys compared to English reference
        const missingKeys = enKeys.filter((k) => !keys.includes(k));
        expect(missingKeys, `Locale ${locale} has missing keys`).toEqual([]);

        // Check for extra undefined keys compared to English reference
        const extraKeys = keys.filter((k) => !enKeys.includes(k));
        expect(extraKeys, `Locale ${locale} has unknown extra keys`).toEqual([]);

        // Validate each leaf value is a valid non-empty string
        for (const leaf of leaves) {
          expect(typeof leaf.value, `${locale}.${leaf.key} must be a string`).toBe('string');
          const str = leaf.value as string;
          expect(str.trim().length, `${locale}.${leaf.key} must not be empty or whitespace-only`).toBeGreaterThan(0);
          expect(str, `${locale}.${leaf.key} must not be stringified "undefined"`).not.toBe('undefined');
          expect(str, `${locale}.${leaf.key} must not be stringified "null"`).not.toBe('null');
          expect(str, `${locale}.${leaf.key} must not be "[object Object]"`).not.toBe('[object Object]');
        }

        // Verify getTranslations(locale) returns identical dictionary
        const resolved = getTranslations(locale);
        expect(resolved).toEqual(DICTIONARIES[locale]);
      });
    }
  });

  describe('Invariant 2: Arabic terminator naming accuracy and dignity', () => {
    it('sets prayers.terminator to exact Fusha phrase "فاصل الليل والنهار"', () => {
      expect(DICTIONARIES.ar.prayers.terminator).toBe('فاصل الليل والنهار');
      expect(getTranslations('ar').prayers.terminator).toBe('فاصل الليل والنهار');
    });

    it('sets apparent and geometric terminators with consistent Fusha terminology', () => {
      expect(DICTIONARIES.ar.prayers.apparentTerminator).toBe('فاصل الشروق والغروب الظاهري (-0.833°)');
      expect(DICTIONARIES.ar.prayers.geometricTerminator).toBe('الفاصل الهندسي (0.0°)');
    });

    it('does not use the deprecated mistranslation "خط الشفق" in Arabic terminator translations', () => {
      expect(DICTIONARIES.ar.prayers.terminator).not.toContain('خط الشفق');
      expect(DICTIONARIES.ar.prayers.apparentTerminator).not.toContain('خط الشفق');
      expect(DICTIONARIES.ar.prayers.geometricTerminator).not.toContain('خط الشفق');
    });
  });

  describe('Invariant 3: Zero Eastern Arabic-Indic numerals across all dictionaries and src/', () => {
    const easternArabicNumeralsRegex = /[\u0660-\u0669\u06F0-\u06F9]/g;

    it('ensures zero Eastern Arabic-Indic numerals in any translation dictionary', () => {
      const violations: Array<{ locale: string; key: string; value: string; match: string }> = [];

      for (const [locale, dict] of Object.entries(DICTIONARIES)) {
        const leaves = getLeafEntries(dict as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          const val = String(leaf.value);
          const matches = val.match(easternArabicNumeralsRegex);
          if (matches) {
            violations.push({
              locale,
              key: leaf.key,
              value: val,
              match: matches.join(','),
            });
          }
        }
      }

      expect(violations, `Found Eastern Arabic-Indic numerals in translations: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('ensures zero Eastern Arabic-Indic numerals in any file under src/', () => {
      const sourceFiles = getSourceFiles(srcDir);
      expect(sourceFiles.length).toBeGreaterThan(0);

      const violations: Array<{ file: string; line: number; match: string }> = [];

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const matches = line.match(easternArabicNumeralsRegex);
          if (matches) {
            violations.push({
              file: path.relative(rootDir, file),
              line: i + 1,
              match: matches.join(','),
            });
          }
        }
      }

      expect(violations, `Found Eastern Arabic-Indic numerals in src/: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('verifies Western numerals (0-9) are used in Arabic strings for numerical values', () => {
      const arSubtitle = DICTIONARIES.ar.timeline.subtitle;
      const arDisclaimer = DICTIONARIES.ar.timeline.modelDisclaimer;

      expect(arSubtitle).toContain('15,000');
      expect(arDisclaimer).toContain('15,000');
      expect(arDisclaimer).toContain('4');
    });
  });

  describe('Invariant 4: Zero em dashes across src/, README.md, and docs/solar-model.md', () => {
    const emDashRegex = /\u2014/g;

    it('ensures zero em dashes in README.md', () => {
      const content = fs.readFileSync(readmePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const violations: Array<{ line: number; text: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('\u2014')) {
          violations.push({ line: i + 1, text: lines[i] });
        }
      }

      expect(violations, `Found em dashes in README.md: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('ensures zero em dashes in docs/solar-model.md', () => {
      const content = fs.readFileSync(solarModelPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const violations: Array<{ line: number; text: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('\u2014')) {
          violations.push({ line: i + 1, text: lines[i] });
        }
      }

      expect(violations, `Found em dashes in docs/solar-model.md: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('ensures zero em dashes in any file under src/', () => {
      const sourceFiles = getSourceFiles(srcDir);
      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('\u2014')) {
            violations.push({
              file: path.relative(rootDir, file),
              line: i + 1,
              text: lines[i],
            });
          }
        }
      }

      expect(violations, `Found em dashes in src/: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('ensures zero em dashes in any dictionary entry across all 10 locales', () => {
      const violations: Array<{ locale: string; key: string; value: string }> = [];

      for (const [locale, dict] of Object.entries(DICTIONARIES)) {
        const leaves = getLeafEntries(dict as unknown as Record<string, unknown>);
        for (const leaf of leaves) {
          const val = String(leaf.value);
          if (val.includes('\u2014')) {
            violations.push({
              locale,
              key: leaf.key,
              value: val,
            });
          }
        }
      }

      expect(violations, `Found em dashes in DICTIONARIES: ${JSON.stringify(violations)}`).toEqual([]);
    });
  });

  describe('Invariant 5: Explicit model qualification in timeline tooltips and subtitles across all 10 locales', () => {
    const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];

    // Pattern matching 15,000 in various international formats (15,000, 15.000, 15 000)
    const settlementsCountPattern = /15[.,\s]?000/;

    // Model or simulation keywords across all 10 supported languages
    const qualificationPattern =
      /(model|simulation|simulated|نموذج|محاك|محاكاة|simülasyon|simulasi|ماڈل|تخمینہ|شبیه‌سازی|مدل|মডেল|সিমুলেশন|modèle|модел|симуляц)/i;

    for (const locale of locales) {
      it(`locale "${locale}" timeline subtitle qualifies model scope (15,000 settlements or simulation)`, () => {
        const subtitle = DICTIONARIES[locale].timeline.subtitle;
        const has15k = settlementsCountPattern.test(subtitle);
        const hasModelOrSim = qualificationPattern.test(subtitle);
        expect(
          has15k || hasModelOrSim,
          `Locale ${locale} subtitle "${subtitle}" must contain 15,000 settlements or model/simulation qualification`,
        ).toBe(true);
      });

      it(`locale "${locale}" timeline modelDisclaimer explicitly cites 15,000 settlements AND simulation/model`, () => {
        const disclaimer = DICTIONARIES[locale].timeline.modelDisclaimer;
        expect(
          settlementsCountPattern.test(disclaimer),
          `Locale ${locale} disclaimer "${disclaimer}" must cite 15,000 settlements`,
        ).toBe(true);
        expect(
          qualificationPattern.test(disclaimer),
          `Locale ${locale} disclaimer "${disclaimer}" must qualify simulation/model`,
        ).toBe(true);
      });

      it(`locale "${locale}" timeline coverageTip qualifies metric as model/simulation or 15,000 settlements`, () => {
        const coverageTip = DICTIONARIES[locale].timeline.coverageTip;
        const has15k = settlementsCountPattern.test(coverageTip);
        const hasModelOrSim = qualificationPattern.test(coverageTip);
        expect(
          has15k || hasModelOrSim,
          `Locale ${locale} coverageTip "${coverageTip}" must qualify model or 15,000 settlements`,
        ).toBe(true);
      });

      it(`locale "${locale}" timeline gapTip qualifies metric as model/simulation or 15,000 settlements`, () => {
        const gapTip = DICTIONARIES[locale].timeline.gapTip;
        const has15k = settlementsCountPattern.test(gapTip);
        const hasModelOrSim = qualificationPattern.test(gapTip);
        expect(
          has15k || hasModelOrSim,
          `Locale ${locale} gapTip "${gapTip}" must qualify model or 15,000 settlements`,
        ).toBe(true);
      });

      it(`locale "${locale}" timeline unbroken qualifies continuity within model bounds`, () => {
        const unbroken = DICTIONARIES[locale].timeline.unbroken;
        expect(
          qualificationPattern.test(unbroken),
          `Locale ${locale} unbroken text "${unbroken}" must qualify that continuity is within the model`,
        ).toBe(true);
      });
    }
  });

  describe('Invariant 6: Markdown line length <= 110 characters (MD013)', () => {
    it('README.md complies with line length <= 110 characters', () => {
      const content = fs.readFileSync(readmePath, 'utf8');
      const lines = content.split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(0);

      const violations: Array<{ line: number; length: number; text: string }> = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 110) {
          violations.push({
            line: i + 1,
            length: line.length,
            text: line,
          });
        }
      }

      expect(violations, `README.md lines exceeding 110 chars: ${JSON.stringify(violations)}`).toEqual([]);
    });

    it('docs/solar-model.md complies with line length <= 110 characters', () => {
      const content = fs.readFileSync(solarModelPath, 'utf8');
      const lines = content.split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(0);

      const violations: Array<{ line: number; length: number; text: string }> = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 110) {
          violations.push({
            line: i + 1,
            length: line.length,
            text: line,
          });
        }
      }

      expect(violations, `docs/solar-model.md lines exceeding 110 chars: ${JSON.stringify(violations)}`).toEqual([]);
    });
  });
});
