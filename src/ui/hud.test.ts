import { describe, it, expect } from 'vitest';
import { PRAYER_COLORS } from '../globe/fronts';
import { DICTIONARIES } from '../i18n/translations';

describe('HUD Layer Controls, Terminators and Disclosures (Milestone 4)', () => {
  describe('Criterion A15: Distinct Apparent and Geometric Terminators', () => {
    it('defines distinct color constants for apparent and geometric terminators', () => {
      expect(PRAYER_COLORS.apparentTerminator).toBeDefined();
      expect(PRAYER_COLORS.geometricTerminator).toBeDefined();
      expect(PRAYER_COLORS.apparentTerminator).not.toBe(PRAYER_COLORS.geometricTerminator);

      // Apparent is silver-white (0xe2e8f0), Geometric is slate (0x94a3b8)
      expect(PRAYER_COLORS.apparentTerminator).toBe(0xe2e8f0);
      expect(PRAYER_COLORS.geometricTerminator).toBe(0x94a3b8);
    });

    it('provides localized labels with angles for both terminators across all locales', () => {
      const locales = Object.keys(DICTIONARIES) as (keyof typeof DICTIONARIES)[];
      for (const loc of locales) {
        const trans = DICTIONARIES[loc];
        expect(trans.prayers.apparentTerminator).toBeDefined();
        expect(trans.prayers.geometricTerminator).toBeDefined();
        expect(trans.prayers.apparentTerminator).toContain('-0.833°');
        expect(trans.prayers.geometricTerminator).toContain('0.0°');
      }
    });

    it('Arabic translations for terminators use dignified Fusha terminology', () => {
      const ar = DICTIONARIES.ar;
      expect(ar.prayers.terminator).toBe('فاصل الليل والنهار');
      expect(ar.prayers.apparentTerminator).toBe('فاصل الشروق والغروب الظاهري (-0.833°)');
      expect(ar.prayers.geometricTerminator).toBe('الفاصل الهندسي (0.0°)');
    });
  });

  describe('Layers Legend and Model Disclosures', () => {
    it('defines all required legend keys across all 10 locales', () => {
      const locales = Object.keys(DICTIONARIES) as (keyof typeof DICTIONARIES)[];
      for (const loc of locales) {
        const c = DICTIONARIES[loc].controls;
        expect(c.legendTitle).toBeTruthy();
        expect(c.legendFajr).toBeTruthy();
        expect(c.legendSunrise).toBeTruthy();
        expect(c.legendDhuhr).toBeTruthy();
        expect(c.legendAsr).toBeTruthy();
        expect(c.legendMaghrib).toBeTruthy();
        expect(c.legendIsha).toBeTruthy();
        expect(c.legendApparentTerminator).toBeTruthy();
        expect(c.legendGeometricTerminator).toBeTruthy();
        expect(c.legendRings).toBeTruthy();
        expect(c.legendArcs).toBeTruthy();
        expect(c.legendModelNote).toBeTruthy();
      }
    });

    it('Arabic model note discloses 15,000 settlements and 4-minute window under Criterion A26', () => {
      const ar = DICTIONARIES.ar.controls;
      expect(ar.legendModelNote).toContain('15,000');
      expect(ar.legendModelNote).toContain('4');
      // Must not contain Eastern Arabic numerals
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(ar.legendModelNote)).toBe(false);
    });
  });
});
