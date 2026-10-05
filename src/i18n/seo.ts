// SEO metadata, hreflang alternates, and Open Graph definitions for all supported locales

import { SupportedLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';
import { getTranslations } from './translations';

export interface LocaleSeoMeta {
  title: string;
  description: string;
  noscript: string;
}

export const BASE_URL = 'https://athan.waqf.dev';

export const SEO_METADATA: Record<SupportedLocale, LocaleSeoMeta> = {
  en: {
    title: 'Adhan Earth | Live 3D Map of Prayer Times Worldwide',
    description:
      'Watch prayer times move around the Earth in real time. A 3D globe of Fajr, Dhuhr, Asr, Maghrib and Isha fronts and the adhan sounding in cities worldwide.',
    noscript:
      'A live 3D map of prayer times around the world. It shows Fajr, Dhuhr, Asr, Maghrib and Isha moving across the Earth, and the adhan sounding in cities as the sun passes over them. It needs JavaScript and WebGL to run.',
  },
  ar: {
    title: 'أذان الأرض | خريطة حية ثلاثية الأبعاد لمواقيت الصلاة حول العالم',
    description:
      'شاهد حركة مواقيت الصلاة حول الأرض في بث حي ومباشر. كرة أرضية ثلاثية الأبعاد تعرض خطوط الفجر والظهر والعصر والمغرب والعشاء ونداء الأذان في مدن العالم.',
    noscript:
      'خريطة حية ثلاثية الأبعاد لمواقيت الصلاة حول العالم. تعرض حركة أوقات الفجر والظهر والعصر والمغرب والعشاء ورفع الأذان في مدن العالم. يتطلب تشغيل الموقع تفعيل JavaScript وWebGL.',
  },
  tr: {
    title: 'Adhan Earth | Dünya Çapında Canlı 3 Boyutlu Namaz Vakitleri Haritası',
    description:
      'Namaz vakitlerinin dünya üzerindeki hareketini canlı izleyin. İmsak, Öğle, İkindi, Akşam ve Yatsı hatlarını ve şehirlerde yükselen ezanları gösteren 3D küre.',
    noscript:
      'Dünya çapında namaz vakitlerinin canlı 3D haritası. İmsak, Öğle, İkindi, Akşam ve Yatsı vakitlerinin Dünya üzerindeki hareketini ve ezanları gösterir. Çalışmak için JavaScript ve WebGL gerektirir.',
  },
  id: {
    title: 'Adhan Earth | Peta 3D Langsung Waktu Salat Seluruh Dunia',
    description:
      'Saksikan pergerakan waktu salat di seluruh Bumi secara langsung. Bola dunia 3D interaktif yang menampilkan garis Subuh, Zuhur, Asar, Magrib, Isya, dan kumandang azan.',
    noscript:
      'Peta 3D langsung waktu salat di seluruh dunia. Menampilkan pergerakan Subuh, Zuhur, Asar, Magrib, dan Isya serta kumandang azan di kota-kota dunia. Membutuhkan JavaScript dan WebGL.',
  },
  ms: {
    title: 'Adhan Earth | Peta 3D Langsung Waktu Solat Seluruh Dunia',
    description:
      'Saksikan pergerakan waktu solat di seluruh Bumi secara langsung. Glob 3D interaktif yang memaparkan garis Subuh, Zohor, Asar, Maghrib, Isya dan laungan azan di seluruh dunia.',
    noscript:
      'Peta 3D langsung waktu solat di seluruh dunia. Memaparkan pergerakan Subuh, Zohor, Asar, Maghrib dan Isya serta laungan azan di bandar-bandar dunia. Memerlukan JavaScript dan WebGL.',
  },
  ur: {
    title: 'اذان ارتھ | دنیا بھر میں نماز کے اوقات کا براہ راست تھری ڈی نقشہ',
    description:
      'دنیا بھر میں نماز کے اوقات کی حرکت براہ راست دیکھیں۔ فجر، ظہر، عصر، مغرب اور عشاء کی لکیریں اور دنیا کے شہروں میں گونجتی اذان کا تھری ڈی کرہ ارض۔',
    noscript:
      'دنیا بھر میں نماز کے اوقات کا براہ راست تھری ڈی نقشہ۔ یہ دنیا بھر میں فجر، ظہر، عصر، مغرب اور عشاء کی حرکت اور اذانوں کو دکھاتا ہے۔ اسے چلانے کے لیے جاوا اسکرپٹ اور ویب جی ایل درکار ہے۔',
  },
  fa: {
    title: 'اذان ارث | نقشه زنده سه‌بعدی اوقات شرعی در سراسر جهان',
    description:
      'حرکت اوقات شرعی نماز را به صورت زنده در سراسر کره زمین مشاهده کنید. کره سه‌بعدی با خطوط صبح، ظهر، عصر، مغرب و عشا و طنین بانگ اذان در شهرهای جهان.',
    noscript:
      'نقشه زنده سه‌بعدی اوقات شرعی در سراسر جهان. نمایش حرکت صبح، ظهر، عصر، مغرب و عشا و طنین اذان در شهرهای جهان. نیازمند جاوااسکریپت و WebGL.',
  },
  bn: {
    title: 'আযান আর্থ | বিশ্বব্যাপী নামাজের সময়ের লাইভ ৩ডি মানচিত্র',
    description:
      'সরাসরি পৃথিবীজুড়ে নামাজের সময়ের গতিবিধি দেখুন। ফজর, যোহর, আসর, মাগরিব ও এশার রেখা এবং বিশ্বজুড়ে শহরগুলোতে আজানের ধ্বনির ৩ডি গ্লোব।',
    noscript:
      'বিশ্বব্যাপী নামাজের সময়ের লাইভ ৩ডি মানচিত্র। এটি পৃথিবীজুড়ে ফজর, যোহর, আসর, মাগরিব ও এশার সময়ের গতিবিধি ও আজানের ধ্বনি প্রদর্শন করে। এটি চালাতে JavaScript এবং WebGL প্রয়োজন।',
  },
  fr: {
    title: 'Adhan Earth | Carte 3D en direct des heures de prière dans le monde',
    description:
      "Observez le mouvement des heures de prière autour de la Terre en direct. Un globe 3D des lignes de Fajr, Dhuhr, Asr, Maghrib et Isha et de l'appel à la prière dans le monde.",
    noscript:
      "Carte 3D en direct des heures de prière dans le monde. Elle montre le déplacement du Fajr, Dhuhr, Asr, Maghrib et Isha et l'appel à la prière dans les villes. Nécessite JavaScript et WebGL.",
  },
  ru: {
    title: 'Adhan Earth | 3D-карта времени намаза по всему миру в реальном времени',
    description:
      'Наблюдайте за движением времени намаза по всей Земле в реальном времени. Интерактивный 3D-глобус с линиями фаджра, зухра, асра, магриба, иша и звучанием азана в городах.',
    noscript:
      '3D-карта времени намаза в реальном времени. Показывает движение фаджра, зухра, асра, магриба и иша по Земле и звучание азана в городах. Для работы требуются JavaScript и WebGL.',
  },
};

export function getCanonicalUrl(locale: SupportedLocale, baseUrl = BASE_URL): string {
  if (locale === DEFAULT_LOCALE) {
    return `${baseUrl}/`;
  }
  return `${baseUrl}/${locale}`;
}

export interface HreflangLink {
  hreflang: string;
  href: string;
}

export function getHreflangLinks(baseUrl = BASE_URL): HreflangLink[] {
  const links: HreflangLink[] = [
    { hreflang: 'x-default', href: `${baseUrl}/` },
    { hreflang: 'en', href: `${baseUrl}/` },
  ];

  const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
  for (const loc of locales) {
    if (loc === 'en') continue;
    links.push({ hreflang: loc, href: `${baseUrl}/${loc}` });
  }

  return links;
}

export function generateHreflangHtml(baseUrl = BASE_URL): string {
  const links = getHreflangLinks(baseUrl);
  return links
    .map((l) => `    <link rel="alternate" hreflang="${l.hreflang}" href="${l.href}" />`)
    .join('\n');
}

export function buildLinkHeader(baseUrl = BASE_URL): string {
  const links = getHreflangLinks(baseUrl);
  return links
    .map((l) => `<${l.href}>; rel="alternate"; hreflang="${l.hreflang}"`)
    .join(', ');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function transformIndexHtml(html: string, locale: SupportedLocale): string {
  if (locale === DEFAULT_LOCALE) {
    return html;
  }

  const meta = SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES[DEFAULT_LOCALE];
  const seo = SEO_METADATA[locale] || SEO_METADATA[DEFAULT_LOCALE];
  const trans = getTranslations(locale);
  const pageUrl = getCanonicalUrl(locale);

  let output = html;

  output = output.replace(
    /<html\b[^>]*>/i,
    `<html lang="${meta.code}" dir="${meta.dir}">`
  );

  output = output.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(seo.title)}</title>`
  );

  output = output.replace(
    /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`
  );

  output = output.replace(
    /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i,
    `<link rel="canonical" href="${pageUrl}" />`
  );

  output = output.replace(
    /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`
  );

  output = output.replace(
    /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`
  );

  output = output.replace(
    /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:url" content="${pageUrl}" />`
  );

  output = output.replace(
    /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`
  );

  output = output.replace(
    /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`
  );

  output = output.replace(
    /<noscript>[\s\S]*?<\/noscript>/i,
    `<noscript>\n      <h1>${escapeHtml(trans.brand.title)}</h1>\n      <p>\n        ${escapeHtml(seo.noscript)}\n      </p>\n    </noscript>`
  );

  return output;
}
