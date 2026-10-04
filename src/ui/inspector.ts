// Astronomical settlement and coordinates prayer inspector panel

import { Settlement } from '../population/loader';
import { calculatePrayerTimes, PrayerTimesSchedule } from '../prayer/calculator';
import { CalculationConventionName, Madhab } from '../prayer/conventions';
import { i18n } from '../i18n/manager';

export interface InspectorPanel {
  element: HTMLElement;
  inspectSettlement: (settlement: Settlement, currentDate: Date) => void;
  inspectCoordinates: (lat: number, lon: number, currentDate: Date) => void;
  updateTime: (currentDate: Date) => void;
  hide: () => void;
  dispose: () => void;
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
  onClose?: () => void;
} = {}): InspectorPanel {
  const container = document.createElement('aside');
  container.className = 'inspector-panel hud-panel';
  container.style.display = 'none';

  let currentSettlement: Settlement | null = null;
  let currentCoords: { lat: number; lon: number } | null = null;
  let lastRenderDate: Date = new Date();
  const convention = options.convention || 'UmmAlQura';
  const madhab = options.madhab || 'Shafi';

  const render = (date: Date): void => {
    lastRenderDate = date;
    const trans = i18n.getTranslations();

    let lat = 0;
    let lon = 0;
    let nameEn = 'Geographic Point';
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

    const sched: PrayerTimesSchedule = calculatePrayerTimes(lat, lon, date, {
      convention,
      madhab,
    });

    const localTime = formatTime(date, tz);
    const qiblaBearing = Math.round(calculateQibla(lat, lon));
    const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${(-lat).toFixed(2)}°S`;
    const lonStr = lon >= 0 ? `${lon.toFixed(2)}°E` : `${(-lon).toFixed(2)}°W`;

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
          <span class="telemetry-value">${qiblaBearing}° ${trans.inspector.fromNorth}</span>
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
          <span>${formatTime(sched.fajr, tz)}</span>
        </div>
        <div class="inspector-prayer-row" style="--prayer-color: var(--color-sunrise);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-sunrise);"></span>
            <span>${trans.prayers.sunrise}</span>
          </span>
          <span>${formatTime(sched.sunrise, tz)}</span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'dhuhr' ? 'active' : ''}" style="--prayer-color: var(--color-dhuhr);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-dhuhr);"></span>
            <span>${trans.prayers.dhuhr}</span>
          </span>
          <span>${formatTime(sched.dhuhr, tz)}</span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'asr' ? 'active' : ''}" style="--prayer-color: var(--color-asr);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-asr);"></span>
            <span>${trans.prayers.asr}</span>
          </span>
          <span>${formatTime(sched.asr, tz)}</span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'maghrib' ? 'active' : ''}" style="--prayer-color: var(--color-maghrib);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-maghrib);"></span>
            <span>${trans.prayers.maghrib}</span>
          </span>
          <span>${formatTime(sched.maghrib, tz)}</span>
        </div>
        <div class="inspector-prayer-row ${sched.currentPrayer === 'isha' ? 'active' : ''}" style="--prayer-color: var(--color-isha);">
          <span class="prayer-name-tag">
            <span class="prayer-indicator-dot" style="background-color: var(--color-isha);"></span>
            <span>${trans.prayers.isha}</span>
          </span>
          <span>${formatTime(sched.isha, tz)}</span>
        </div>
      </div>
    `;

    const closeBtn = container.querySelector('.inspector-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hide();
        if (options.onClose) options.onClose();
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
    render(currentDate);
  };

  const inspectCoordinates = (lat: number, lon: number, currentDate: Date): void => {
    currentCoords = { lat, lon };
    currentSettlement = null;
    container.style.display = 'flex';
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
  };

  const dispose = (): void => {
    unsubscribe();
    container.remove();
  };

  return {
    element: container,
    inspectSettlement,
    inspectCoordinates,
    updateTime,
    hide,
    dispose,
  };
}
