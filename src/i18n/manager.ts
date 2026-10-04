// Internationalization manager and event bus for Adhan Earth

import { SupportedLocale, SUPPORTED_LOCALES, detectLocale } from './config';
import { Translations, getTranslations } from './translations';

export type LocaleChangeListener = (locale: SupportedLocale, translations: Translations) => void;

class I18nManager {
  private currentLocale: SupportedLocale;
  private listeners: Set<LocaleChangeListener> = new Set();

  constructor() {
    this.currentLocale = detectLocale();
    this.applyDomAttributes(this.currentLocale);
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public getTranslations(): Translations {
    return getTranslations(this.currentLocale);
  }

  public setLocale(locale: SupportedLocale): void {
    if (this.currentLocale === locale && !this.listeners.size) return;
    this.currentLocale = locale;

    this.applyDomAttributes(locale);

    try {
      localStorage.setItem('adhan_locale', locale);
    } catch {
      // Ignore localStorage write failures
    }

    const trans = this.getTranslations();
    for (const listener of this.listeners) {
      try {
        listener(locale, trans);
      } catch (err) {
        console.error('Error in i18n listener:', err);
      }
    }
  }

  public onLocaleChange(listener: LocaleChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyDomAttributes(locale: SupportedLocale): void {
    if (typeof document === 'undefined') return;

    const meta = SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES.en;
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
  }
}

export const i18n = new I18nManager();
