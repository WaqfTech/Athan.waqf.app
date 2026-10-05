// Astronomical settlement and coordinates prayer inspector panel

import { Settlement } from '../population/loader';
import { calculatePrayerTimes, PrayerTimesSchedule, PrayerEntry } from '../prayer/calculator';
import {
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
} from '../prayer/conventions';
import { getSolarAltitude } from '../astronomy/solar';
import { AppConfig, AppStore } from './state';
import { i18n } from '../i18n/manager';
import { Translations } from '../i18n/translations';

export interface InspectorPanel {
  element: HTMLElement;
  inspectSettlement: (settlement: Settlement, currentDate: Date) => void;
  inspectCoordinates: (lat: number, lon: number, currentDate: Date) => void;
  updateTime: (currentDate: Date) => void;
  updateConfig: (config: AppConfig) => void;
  hide: () => void;
  dispose: () => void;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    formatterCache.set(timezone, fmt);
  }
  return fmt;
}

export function resolveObserverCivilDate(
  date: Date,
  longitude: number,
  timezone?: string,
): Date {
  if (timezone) {
    try {
      const formatter = getDateTimeFormatter(timezone);
      const parts = formatter.formatToParts(date);
      const y = parseInt(parts.find((p) => p.type === 'year')?.value || '', 10);
      const m = parseInt(parts.find((p) => p.type === 'month')?.value || '', 10) - 1;
      const d = parseInt(parts.find((p) => p.type === 'day')?.value || '', 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(Date.UTC(y, m, d, 12, 0, 0));
      }
    } catch {
      // Fall through to solar longitude offset
    }
  }

  const offsetMs = Math.round((longitude / 15) * 3600000);
  const localTime = new Date(date.getTime() + offsetMs);
  return new Date(
    Date.UTC(
      localTime.getUTCFullYear(),
      localTime.getUTCMonth(),
      localTime.getUTCDate(),
      12,
      0,
      0,
    ),
  );
}

export function getInspectorSchedule(
  latitude: number,
  longitude: number,
  date: Date,
  options: {
    convention?: CalculationConventionName;
    madhab?: Madhab;
    highLatitudeRule?: HighLatitudeRule;
    timezone?: string;
  } = {},
): PrayerTimesSchedule {
  const localCivilDate = resolveObserverCivilDate(date, longitude, options.timezone);
  return calculatePrayerTimes(latitude, longitude, localCivilDate, {
    convention: options.convention,
    madhab: options.madhab,
    highLatitudeRule: options.highLatitudeRule,
    now: date,
  });
}

function formatTime(date: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 19);
  }
}

function formatPrayerTime(entry: PrayerEntry, timezone?: string): string {
  if (!entry.date) {
    return '--:--:--';
  }
  return formatTime(entry.date, timezone);
}

export function renderProvenanceBadge(
  entry: PrayerEntry,
  trans: Translations = i18n.getTranslations(),
): string {
  const prov = entry.provenance || 'astronomicalSign';
  let badgeVariant = 'astro';
  let badgeInfo = trans.inspector.provenance.astro;

  if (prov === 'fixedInterval') {
    badgeVariant = 'fixed';
    badgeInfo = trans.inspector.provenance.fixed;
  } else if (prov === 'highLatitudeAdjustment') {
    if (entry.ruleApplied === 'AngleBased') {
      badgeVariant = 'high-lat';
      badgeInfo = trans.inspector.provenance.angle;
    } else {
      badgeVariant = 'high-lat';
      badgeInfo = trans.inspector.provenance.highLat;
    }
  } else if (prov === 'unresolved') {
    badgeVariant = 'unresolved';
    badgeInfo = trans.inspector.provenance.unresolved;
  }

  const label = badgeInfo.label;
  const title = entry.note || badgeInfo.title || badgeInfo.desc;
  const provClass = `prayer-provenance-${prov}`;
  const badgeClass = `badge-${badgeVariant}`;

  return `<span class="prayer-provenance-badge ${provClass} ${badgeClass}" title="${title}" tabindex="0">${label}</span>`;
}

function formatCountdown(ms: number | null): string {
  if (ms === null || ms < 0) return '--:--:--';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calculateQibla(lat: number, lon: number): number {
  const mLat = (21.4225 * Math.PI) / 180;
  const mLon = (39.8262 * Math.PI) / 180;
  const pLat = (lat * Math.PI) / 180;
  const pLon = (lon * Math.PI) / 180;
  const y = Math.sin(mLon - pLon);
  const x = Math.cos(pLat) * Math.tan(mLat) - Math.sin(pLat) * Math.cos(mLon - pLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function createInspectorPanel(options: {
  convention?: CalculationConventionName;
  madhab?: Madhab;
  highLatitudeRule?: HighLatitudeRule;
  store?: AppStore;
  onOpen?: () => void;
  onClose?: () => void;
} = {}): InspectorPanel {
  const container = document.createElement('aside');
  container.className = 'inspector-panel hud-panel';
  container.style.display = 'none';

  let currentSettlement: Settlement | null = null;
  let currentCoords: { lat: number; lon: number } | null = null;
  let lastRenderDate: Date = new Date();

  let convention: CalculationConventionName = options.convention || 'UmmAlQura';
  let madhab: Madhab = options.madhab || 'Shafi';
  let highLatitudeRule: HighLatitudeRule = options.highLatitudeRule || 'MiddleOfTheNight';

  const updateConfig = (config: AppConfig): void => {
    convention = config.convention;
    madhab = config.madhab;
    highLatitudeRule = config.highLatitudeRule;
    if (container.style.display !== 'none') {
      render(lastRenderDate);
    }
  };

  let storeUnsub: (() => void) | null = null;
  if (options.store) {
    const initialConfig = options.store.getConfig();
    convention = initialConfig.convention;
    madhab = initialConfig.madhab;
    highLatitudeRule = initialConfig.highLatitudeRule;
    storeUnsub = options.store.subscribeConfig((config) => {
      updateConfig(config);
    });
  }

  const render = (date: Date): void => {
    lastRenderDate = date;
    const trans = i18n.getTranslations();

    let lat = 0;
    let lon = 0;
    let nameEn = trans.inspector.geographicPoint;
    let nameAr = '';
    let countryCode = '';
    let tz: string | undefined = undefined;

    if (currentSettlement) {
      lat = currentSettlement.latitude;
      lon = currentSettlement.longitude;
      nameEn = currentSettlement.name;
      nameAr = currentSettlement.nameAr || '';
      countryCode = currentSettlement.countryCode;
      tz = currentSettlement.timezone;
    } else if (currentCoords) {
      lat = currentCoords.lat;
      lon = currentCoords.lon;
      nameEn = `Lat ${lat.toFixed(2)}°, Lon ${lon.toFixed(2)}°`;
    } else {
      return;
    }

    const sched: PrayerTimesSchedule = getInspectorSchedule(lat, lon, date, {
      convention,
      madhab,
      highLatitudeRule,
      timezone: tz,
    });

    const localTime = formatTime(date, tz);
    const qiblaBearing = Math.round(calculateQibla(lat, lon));
    const atKaaba = Math.abs(lat - 21.4225) < 0.02 && Math.abs(lon - 39.8262) < 0.02;
    const qiblaText = atKaaba ? trans.inspector.atKaaba : `${qiblaBearing}° ${trans.inspector.fromNorth}`;
    const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${(-lat).toFixed(2)}°S`;
    const lonStr = lon >= 0 ? `${lon.toFixed(2)}°E` : `${(-lon).toFixed(2)}°W`;

    // Compute solar altitude
    const solarAlt = getSolarAltitude(lat, lon, date);
    const solarAltText = `${solarAlt >= 0 ? '+' : ''}${solarAlt.toFixed(1)}°`;

    // Progress bar estimation: 0% to 100%
    const countdownSec = (sched.countdownMs || 0) / 1000;
    const progressPercent = Math.max(5, Math.min(100, 100 - (countdownSec / (6 * 3600)) * 100));
    const nextPrayerLabel = sched.nextPrayer !== 'none'
      ? (trans.prayers[sched.nextPrayer as keyof typeof trans.prayers] || sched.nextPrayer)
      : '--';

    container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title-group">
          <div class="inspector-city-name">${nameEn}${countryCode ? `, ${countryCode}` : ''}</div>
          ${nameAr ? `<div class="inspector-city-ar" dir="rtl" lang="ar">${nameAr}</div>` : ''}
          <div class="inspector-coords-badge">${latStr}, ${lonStr}</div>
        </div>
        <button class="inspector-close-btn" aria-label="${trans.inspector.close}">✕</button>
      </div>

      <div class="inspector-telemetry-row">
        <div class="telemetry-cell">
          <span class="telemetry-label">${trans.inspector.localTime}</span>
          <span class="telemetry-value">${localTime}</span>
        </div>
        <div class="telemetry-cell">
          <span class="telemetry-label">${trans.inspector.qiblaBearing}</span>
          <span class="telemetry-value">${qiblaText}</span>
        </div>
        <div class="telemetry-cell">
          <span class="telemetry-label">${trans.inspector.solarAltitude}</span>
          <span class="telemetry-value">${solarAltText}</span>
        </div>
      </div>

      <div class="inspector-next-capsule">
        <div class="next-capsule-header">
          <span class="next-capsule-name">${trans.inspector.next}: ${nextPrayerLabel}</span>
          <span class="next-capsule-timer">${formatCountdown(sched.countdownMs)}</span>
        </div>
        <div class="next-progress-bar">
          <div class="next-progress-fill" style="width: ${progressPercent.toFixed(1)}%;"></div>
        </div>
      </div>

      <div class="inspector-schedule-list">
        <div class="inspector-prayer-row ${sched.currentPrayer === 'fajr' ? 'active' : ''}" style="--prayer-color: var(--color-fajr);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-fajr);"></span>
            <span>${trans.prayers.fajr}</span>
          </span>
          <span class="prayer-time-group" style="display: flex; align-items: center; gap: 6px;">
            ${renderProvenanceBadge(sched.fajr, trans)}
            <span>${formatPrayerTime(sched.fajr, tz)}</span>
          </span>
        </div>
        <div class="inspector-prayer-row" style="--prayer-color: var(--color-sunrise);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-sunrise);"></span>
            <span>${trans.prayers.sunrise}</span>
          </span>
          <span class="prayer-time-group" style="display: flex; align-items: center; gap: 6px;">
            ${renderProvenanceBadge(sched.sunrise, trans)}
            <span>${formatPrayerTime(sched.sunrise, tz)}</span>
          </span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'dhuhr' ? 'active' : ''}" style="--prayer-color: var(--color-dhuhr);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-dhuhr);"></span>
            <span>${trans.prayers.dhuhr}</span>
          </span>
          <span class="prayer-time-group" style="display: flex; align-items: center; gap: 6px;">
            ${renderProvenanceBadge(sched.dhuhr, trans)}
            <span>${formatPrayerTime(sched.dhuhr, tz)}</span>
          </span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'asr' ? 'active' : ''}" style="--prayer-color: var(--color-asr);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-asr);"></span>
            <span>${trans.prayers.asr}</span>
          </span>
          <span class="prayer-time-group" style="display: flex; align-items: center; gap: 6px;">
            ${renderProvenanceBadge(sched.asr, trans)}
            <span>${formatPrayerTime(sched.asr, tz)}</span>
          </span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'maghrib' ? 'active' : ''}" style="--prayer-color: var(--color-maghrib);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-maghrib);"></span>
            <span>${trans.prayers.maghrib}</span>
          </span>
          <span class="prayer-time-group" style="display: flex; align-items: center; gap: 6px;">
            ${renderProvenanceBadge(sched.maghrib, trans)}
            <span>${formatPrayerTime(sched.maghrib, tz)}</span>
          </span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'isha' ? 'active' : ''}" style="--prayer-color: var(--color-isha);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-isha);"></span>
            <span>${trans.prayers.isha}</span>
          </span>
          <span class="prayer-time-group" style="display: flex; align-items: center; gap: 6px;">
            ${renderProvenanceBadge(sched.isha, trans)}
            <span>${formatPrayerTime(sched.isha, tz)}</span>
          </span>
        </div>
      </div>
    `;

    const closeBtn = container.querySelector('.inspector-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hide();
      });
    }
  };

  const unsubscribe = i18n.onLocaleChange(() => {
    if (container.style.display !== 'none') {
      render(lastRenderDate);
    }
  });

  const inspectSettlement = (settlement: Settlement, currentDate: Date): void => {
    currentSettlement = settlement;
    currentCoords = null;
    container.style.display = 'flex';
    if (options.onOpen) options.onOpen();
    render(currentDate);
  };

  const inspectCoordinates = (lat: number, lon: number, currentDate: Date): void => {
    currentCoords = { lat, lon };
    currentSettlement = null;
    container.style.display = 'flex';
    if (options.onOpen) options.onOpen();
    render(currentDate);
  };

  const updateTime = (currentDate: Date): void => {
    if (container.style.display !== 'none') {
      render(currentDate);
    }
  };

  const hide = (): void => {
    container.style.display = 'none';
    currentSettlement = null;
    currentCoords = null;
    if (options.onClose) options.onClose();
  };

  const dispose = (): void => {
    if (storeUnsub) storeUnsub();
    unsubscribe();
    container.remove();
  };

  return {
    element: container,
    inspectSettlement,
    inspectCoordinates,
    updateTime,
    updateConfig,
    hide,
    dispose,
  };
}
