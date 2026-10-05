import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  detectLocale,
  DEFAULT_LOCALE,
} from './config';
import { DICTIONARIES, getTranslations } from './translations';
import { i18n } from './manager';
import {
  SEO_METADATA,
  getCanonicalUrl,
  getHreflangLinks,
  buildLinkHeader,
  transformIndexHtml,
  generateJsonLd,
} from './seo';

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

    function assertMatchingEntries(
      actual: Record<string, unknown>,
      expected: Record<string, unknown>,
      path: string,
    ): void {
      expect(Object.keys(actual).sort(), `${path} keys mismatch`).toEqual(
        Object.keys(expected).sort(),
      );

      for (const [k, val] of Object.entries(actual)) {
        const enVal = expected[k];
        const currentPath = `${path}.${k}`;
        if (typeof val === 'object' && val !== null) {
          expect(typeof enVal, `${currentPath} expected object in English`).toBe('object');
          assertMatchingEntries(
            val as Record<string, unknown>,
            enVal as Record<string, unknown>,
            currentPath,
          );
        } else {
          expect(typeof val, `${currentPath} should be string`).toBe('string');
          expect((val as string).length, `${currentPath} should not be empty`).toBeGreaterThan(0);
        }
      }
    }

    for (const loc of locales) {
      const trans = getTranslations(loc);
      const locSections = Object.keys(trans).sort();
      expect(locSections).toEqual(enSections);

      for (const sectionKey of enSections) {
        const section = (trans as unknown as Record<string, unknown>)[sectionKey] as Record<string, unknown>;
        const enSection = (DICTIONARIES.en as unknown as Record<string, unknown>)[sectionKey] as Record<string, unknown>;
        assertMatchingEntries(section, enSection, `${loc}.${sectionKey}`);
      }
    }
  });

  it('validates Milestone 4 disclosures, terminators, and provenance keys', () => {
    const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
    for (const loc of locales) {
      const trans = getTranslations(loc);
      // Timeline qualified disclosures
      expect(trans.timeline.modelDisclaimer.length).toBeGreaterThan(10);
      expect(trans.timeline.coverageTip.length).toBeGreaterThan(15);
      expect(trans.timeline.gapTip.length).toBeGreaterThan(15);
      expect(trans.timeline.peakTip.length).toBeGreaterThan(15);
      expect(trans.timeline.unbroken.length).toBeGreaterThan(0);

      // Distinct terminators
      expect(trans.prayers.apparentTerminator.length).toBeGreaterThan(0);
      expect(trans.prayers.geometricTerminator.length).toBeGreaterThan(0);

      // Inspector telemetry & provenance
      expect(trans.inspector.solarAltitude.length).toBeGreaterThan(0);
      expect(trans.inspector.geographicPoint.length).toBeGreaterThan(0);
      expect(trans.inspector.provenance.astro.label.length).toBeGreaterThan(0);
      expect(trans.inspector.provenance.fixed.label.length).toBeGreaterThan(0);
      expect(trans.inspector.provenance.angle.label.length).toBeGreaterThan(0);
      expect(trans.inspector.provenance.highLat.label.length).toBeGreaterThan(0);
      expect(trans.inspector.provenance.unresolved.label.length).toBeGreaterThan(0);

      // Fiqh & legend options
      expect(trans.controls.legendTitle.length).toBeGreaterThan(0);
      expect(trans.controls.legendModelNote.length).toBeGreaterThan(0);
      expect(trans.controls.convUmmAlQura.length).toBeGreaterThan(0);
      expect(trans.controls.madhabShafi.length).toBeGreaterThan(0);
      expect(trans.controls.ruleMiddleOfTheNight.length).toBeGreaterThan(0);
    }

    // Arabic linguistic integrity
    const ar = getTranslations('ar');
    expect(ar.prayers.terminator).toBe('فاصل الليل والنهار');
    expect(ar.controls.zenMode).toBe('العرض الكوكبي المجرّد');
    expect(ar.inspector.atKaaba).toBe('عند الكعبة المشرفة');
    expect(ar.timeline.unbroken).toContain('وفق النموذج');
  });

  it('detects locale from URL path prefix', () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: new URL('https://athan.waqf.app/ar'),
    } as unknown as Window & typeof globalThis;

    expect(detectLocale()).toBe('ar');

    globalThis.window = originalWindow;
  });

  it('prioritizes path prefix over query param', () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: new URL('https://athan.waqf.app/fr?lang=tr'),
    } as unknown as Window & typeof globalThis;

    expect(detectLocale()).toBe('fr');

    globalThis.window = originalWindow;
  });

  it('detects locale from URL search params when at root', () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: new URL('https://athan.waqf.app/?lang=tr'),
    } as unknown as Window & typeof globalThis;

    expect(detectLocale()).toBe('tr');

    globalThis.window = originalWindow;
  });

  it('falls back to default locale when unsupported code is provided in URL', () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: new URL('https://athan.waqf.app/?lang=xx'),
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

describe('SEO metadata, hreflang alternates, and SSR transformations', () => {
  it('provides complete SEO title, description, and noscript for all 10 locales', () => {
    const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
    for (const loc of locales) {
      const meta = SEO_METADATA[loc];
      expect(meta, `Missing SEO metadata for ${loc}`).toBeDefined();
      expect(meta.title.length, `Title too short for ${loc}`).toBeGreaterThan(15);
      expect(meta.description.length, `Description too short for ${loc}`).toBeGreaterThan(30);
      expect(meta.noscript.length, `Noscript too short for ${loc}`).toBeGreaterThan(30);
    }
  });

  it('generates canonical URLs correctly with root for en and path for others', () => {
    expect(getCanonicalUrl('en')).toBe('https://athan.waqf.app/');
    expect(getCanonicalUrl('ar')).toBe('https://athan.waqf.app/ar');
    expect(getCanonicalUrl('fr')).toBe('https://athan.waqf.app/fr');
  });

  it('generates all 11 hreflang alternates including x-default and all 10 locales', () => {
    const links = getHreflangLinks();
    expect(links).toHaveLength(11);

    const xDefault = links.find((l) => l.hreflang === 'x-default');
    expect(xDefault).toBeDefined();
    expect(xDefault?.href).toBe('https://athan.waqf.app/');

    const enLink = links.find((l) => l.hreflang === 'en');
    expect(enLink?.href).toBe('https://athan.waqf.app/');

    const arLink = links.find((l) => l.hreflang === 'ar');
    expect(arLink?.href).toBe('https://athan.waqf.app/ar');
  });

  it('builds RFC 5988/8288 compliant Link header', () => {
    const header = buildLinkHeader();
    expect(header).toContain('<https://athan.waqf.app/>; rel="alternate"; hreflang="x-default"');
    expect(header).toContain('<https://athan.waqf.app/>; rel="alternate"; hreflang="en"');
    expect(header).toContain('<https://athan.waqf.app/ar>; rel="alternate"; hreflang="ar"');
    expect(header).toContain('<https://athan.waqf.app/ru>; rel="alternate"; hreflang="ru"');
  });

  it('transforms HTML for non-English locales on the edge', () => {
    const sampleHtml = `<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <title>Adhan Earth | Live 3D Map of Prayer Times Worldwide</title>
    <meta name="description" content="Watch prayer times move around the Earth in real time." />
    <link rel="canonical" href="https://athan.waqf.app/" />
    <meta property="og:title" content="Adhan Earth | Live 3D Map of Prayer Times Worldwide" />
    <meta property="og:description" content="Watch prayer times move around the Earth in real time." />
    <meta property="og:url" content="https://athan.waqf.app/" />
    <meta name="twitter:title" content="Adhan Earth | Live 3D Map of Prayer Times Worldwide" />
    <meta name="twitter:description" content="Watch prayer times move around the Earth in real time." />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Adhan Earth",
        "url": "https://athan.waqf.app/",
        "description": "Watch prayer times move around the Earth in real time."
      }
    </script>
  </head>
  <body>
    <noscript>
      <h1>Adhan Earth</h1>
      <p>Original english noscript</p>
    </noscript>
  </body>
</html>`;

    const transformed = transformIndexHtml(sampleHtml, 'ar');
    expect(transformed).toContain('<html lang="ar" dir="rtl">');
    expect(transformed).toContain(`<title>${SEO_METADATA.ar.title}</title>`);
    expect(transformed).toContain(`<meta name="description" content="${SEO_METADATA.ar.description}" />`);
    expect(transformed).toContain('<link rel="canonical" href="https://athan.waqf.app/ar" />');
    expect(transformed).toContain(`<meta property="og:title" content="${SEO_METADATA.ar.title}" />`);
    expect(transformed).toContain(`<meta property="og:description" content="${SEO_METADATA.ar.description}" />`);
    expect(transformed).toContain('<meta property="og:url" content="https://athan.waqf.app/ar" />');
    expect(transformed).toContain(`<meta name="twitter:title" content="${SEO_METADATA.ar.title}" />`);
    expect(transformed).toContain(`<meta name="twitter:description" content="${SEO_METADATA.ar.description}" />`);
    expect(transformed).toContain(SEO_METADATA.ar.noscript);
    expect(transformed).toContain('"name": "أذان الأرض"');
    expect(transformed).toContain('"url": "https://athan.waqf.app/ar"');
  });

  it('generates localized structured JSON-LD data for all locales', () => {
    const enJson = generateJsonLd('en');
    expect(enJson.name).toBe('Adhan Earth');
    expect(enJson.url).toBe('https://athan.waqf.app/');
    expect(enJson.description).toBe(SEO_METADATA.en.description);

    const arJson = generateJsonLd('ar');
    expect(arJson.name).toBe('أذان الأرض');
    expect(arJson.url).toBe('https://athan.waqf.app/ar');
    expect(arJson.description).toBe(SEO_METADATA.ar.description);

    const trJson = generateJsonLd('tr');
    expect(trJson.name).toBe('Adhan Earth');
    expect(trJson.url).toBe('https://athan.waqf.app/tr');
    expect(trJson.description).toBe(SEO_METADATA.tr.description);
  });

  it('returns original HTML untouched when locale is English', () => {
    const sampleHtml = '<html><head><title>Original</title></head></html>';
    expect(transformIndexHtml(sampleHtml, 'en')).toBe(sampleHtml);
  });

  it('defines an engaging, localized share message for every supported language', () => {
    const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
    for (const loc of locales) {
      const trans = getTranslations(loc);
      expect(trans.controls.shareMessage).toBeDefined();
      expect(trans.controls.shareMessage.length).toBeGreaterThan(20);
    }
    expect(getTranslations('ar').controls.shareMessage).toContain('شاهد حركة مواقيت الصلاة');
    expect(getTranslations('en').controls.shareMessage).toContain('Watch prayer times');
  });

  it('defines complete and accurate credits across all 10 supported locales', () => {
    const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
    for (const loc of locales) {
      const trans = getTranslations(loc);
      expect(trans.controls.credits).toBeDefined();
      expect(trans.controls.credits.length).toBeGreaterThan(0);

      const c = trans.credits;
      expect(c.title).toBeDefined();
      expect(c.acknowledgments).toBeDefined();
      expect(c.contributorName).toBe('Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī');
      expect(c.contributorHandle).toBe('@theIslampill');
      expect(c.contributorArabicName).toBe('مدثر إسماعيل بن دانيال');
      expect(c.contributorRole.length).toBeGreaterThan(10);
      expect(c.projectBy).toContain('WaqfTech.org');
      expect(c.waqfDescription.length).toBeGreaterThan(15);
      expect(c.licenseTitle).toContain('Waqf-DPL 1.0');
      expect(c.stackTitle.length).toBeGreaterThan(0);
      expect(c.stack3d).toContain('Three.js');
      expect(c.stackAstronomy).toContain('NOAA');
      expect(c.stackEdge).toContain('Cloudflare Workers');
      expect(c.close.length).toBeGreaterThan(0);
    }
  });
});
