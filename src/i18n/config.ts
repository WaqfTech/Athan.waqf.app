// Supported locales and auto-detection configuration for Adhan Earth

export type SupportedLocale =
  | 'en'
  | 'ar'
  | 'tr'
  | 'id'
  | 'ms'
  | 'ur'
  | 'fa'
  | 'fr'
  | 'ru'
  | 'bn';

export interface LocaleMeta {
  code: SupportedLocale;
  label: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleMeta> = {
  ar: { code: 'ar', label: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  tr: { code: 'tr', label: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' },
  id: { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr' },
  ms: { code: 'ms', label: 'Malay', nativeName: 'Bahasa Melayu', dir: 'ltr' },
  ur: { code: 'ur', label: 'Urdu', nativeName: 'اردو', dir: 'rtl' },
  fa: { code: 'fa', label: 'Persian', nativeName: 'فارسی', dir: 'rtl' },
  bn: { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', dir: 'ltr' },
  fr: { code: 'fr', label: 'French', nativeName: 'Français', dir: 'ltr' },
  ru: { code: 'ru', label: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  en: { code: 'en', label: 'English', nativeName: 'English', dir: 'ltr' },
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Validates whether a candidate value is a recognized SupportedLocale,
 * guarding against inherited Object.prototype properties.
 */
export function isSupportedLocale(candidate: unknown): candidate is SupportedLocale {
  return (
    typeof candidate === 'string' &&
    Object.prototype.hasOwnProperty.call(SUPPORTED_LOCALES, candidate)
  );
}

/**
 * Detects preferred locale based on:
 * 1. Path-based locale prefix (e.g. /ar, /tr, /ur)
 * 2. URL search parameter (?lang=)
 * 3. LocalStorage preference (adhan_locale)
 * 4. Browser navigator language (navigator.languages / navigator.language)
 * 5. Fallback to DEFAULT_LOCALE
 */
export function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  // 1. Path-based locale
  const pathSegment = window.location.pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0]
    ?.toLowerCase();
  if (pathSegment && isSupportedLocale(pathSegment)) {
    return pathSegment;
  }

  // 2. Query parameter override
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang')?.toLowerCase();
  if (langParam && isSupportedLocale(langParam)) {
    return langParam;
  }

  // 3. Saved user preference
  try {
    const saved = localStorage.getItem('adhan_locale')?.toLowerCase();
    if (saved && isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // Ignore localStorage access issues
  }

  // 4. Browser navigator languages
  const navLangs = navigator.languages || [navigator.language || ''];
  for (const raw of navLangs) {
    if (!raw) continue;
    const code = raw.toLowerCase().split('-')[0];
    if (isSupportedLocale(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}
