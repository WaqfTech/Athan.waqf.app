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
 * Detects preferred locale based on:
 * 1. URL search parameter (?lang=)
 * 2. LocalStorage preference (adhan_locale)
 * 3. Browser navigator language (navigator.languages / navigator.language)
 * 4. Fallback to DEFAULT_LOCALE
 */
export function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  // 1. Query parameter override
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang')?.toLowerCase();
  if (langParam && langParam in SUPPORTED_LOCALES) {
    return langParam as SupportedLocale;
  }

  // 2. Saved user preference
  try {
    const saved = localStorage.getItem('adhan_locale')?.toLowerCase();
    if (saved && saved in SUPPORTED_LOCALES) {
      return saved as SupportedLocale;
    }
  } catch {
    // Ignore localStorage access issues
  }

  // 3. Browser navigator languages
  const navLangs = navigator.languages || [navigator.language || ''];
  for (const raw of navLangs) {
    if (!raw) continue;
    const code = raw.toLowerCase().split('-')[0] as SupportedLocale;
    if (code in SUPPORTED_LOCALES) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}
