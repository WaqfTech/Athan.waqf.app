import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  detectLocale,
  DEFAULT_LOCALE,
} from './config';
import { DICTIONARIES, getTranslations } from './translations';
import { i18n } from './manager';

describe('i18n configuration and locale detection', () => {
  it('defines 10 major Muslim-world and international languages', () => {
    const keys = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
    expect(keys).toHaveLength(10);
    expect(keys).toEqual(
      expect.arrayContaining(['ar', 'tr', 'id', 'ms', 'ur', 'fa', 'bn', 'fr', 'ru', 'en']),
    );
  });

  it('correctly maps RTL and LTR text directions', () => {
    expect(SUPPORTED_LOCALES.ar.dir).toBe('rtl');
    expect(SUPPORTED_LOCALES.ur.dir).toBe('rtl');
    expect(SUPPORTED_LOCALES.fa.dir).toBe('rtl');

    expect(SUPPORTED_LOCALES.en.dir).toBe('ltr');
    expect(SUPPORTED_LOCALES.tr.dir).toBe('ltr');
    expect(SUPPORTED_LOCALES.id.dir).toBe('ltr');
    expect(SUPPORTED_LOCALES.ms.dir).toBe('ltr');
    expect(SUPPORTED_LOCALES.bn.dir).toBe('ltr');
    expect(SUPPORTED_LOCALES.fr.dir).toBe('ltr');
    expect(SUPPORTED_LOCALES.ru.dir).toBe('ltr');
  });

  it('provides complete translations dictionaries for all locales', () => {
    const enSections = Object.keys(DICTIONARIES.en).sort();
    const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];

    for (const loc of locales) {
      const trans = getTranslations(loc);
      const locSections = Object.keys(trans).sort();
      expect(locSections).toEqual(enSections);

      // Verify every section has string entries
      for (const sectionKey of enSections) {
        const section = (trans as unknown as Record<string, Record<string, string>>)[sectionKey];
        const enSection = (DICTIONARIES.en as unknown as Record<string, Record<string, string>>)[sectionKey];
        expect(Object.keys(section).sort()).toEqual(Object.keys(enSection).sort());

        for (const [k, val] of Object.entries(section)) {
          expect(typeof val, `${loc}.${sectionKey}.${k} should be string`).toBe('string');
          expect(val.length, `${loc}.${sectionKey}.${k} should not be empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('detects locale from URL search params', () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: new URL('https://athan.waqf.dev/?lang=tr'),
    } as unknown as Window & typeof globalThis;

    expect(detectLocale()).toBe('tr');

    globalThis.window = originalWindow;
  });

  it('falls back to default locale when unsupported code is provided in URL', () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: new URL('https://athan.waqf.dev/?lang=xx'),
    } as unknown as Window & typeof globalThis;

    expect(detectLocale()).toBe(DEFAULT_LOCALE);

    globalThis.window = originalWindow;
  });
});

describe('I18nManager reactivity and DOM sync', () => {
  const originalDoc = globalThis.document;

  beforeEach(() => {
    globalThis.document = {
      documentElement: {
        lang: 'en',
        dir: 'ltr',
      },
    } as unknown as Document;
    i18n.setLocale('en');
  });

  afterEach(() => {
    globalThis.document = originalDoc;
  });

  it('updates documentElement attributes on locale change', () => {
    i18n.setLocale('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');

    i18n.setLocale('id');
    expect(document.documentElement.lang).toBe('id');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('notifies listeners on locale change', () => {
    let notifiedLocale = '';
    let notifiedBrand = '';

    const unsub = i18n.onLocaleChange((locale, trans) => {
      notifiedLocale = locale;
      notifiedBrand = trans.brand.title;
    });

    i18n.setLocale('tr');
    expect(notifiedLocale).toBe('tr');
    expect(notifiedBrand).toBe('EZAN DÜNYASI');

    unsub();
  });
});
