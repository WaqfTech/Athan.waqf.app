// Floating settlement and coordinates prayer inspector panel

import { Settlement } from '../population/loader';
import { calculatePrayerTimes, PrayerTimesSchedule } from '../prayer/calculator';
import { CalculationConventionName, Madhab } from '../prayer/conventions';

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

export function createInspectorPanel(options: {
  convention?: CalculationConventionName;
  madhab?: Madhab;
  onClose?: () => void;
} = {}): InspectorPanel {
  const container = document.createElement('div');
  container.className = 'inspector-panel hud-panel';
  container.style.display = 'none';

  let currentSettlement: Settlement | null = null;
  let currentCoords: { lat: number; lon: number } | null = null;
  let convention = options.convention || 'UmmAlQura';
  let madhab = options.madhab || 'Shafi';

  const render = (date: Date): void => {
    let lat = 0;
    let lon = 0;
    let nameEn = 'Geographic Point';
    let nameAr = '';
    let tz: string | undefined = undefined;

    if (currentSettlement) {
      lat = currentSettlement.latitude;
      lon = currentSettlement.longitude;
      nameEn = `${currentSettlement.name}, ${currentSettlement.countryCode}`;
      nameAr = currentSettlement.nameAr || '';
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

    container.innerHTML = `
      <div class="inspector-header">
        <div>
          <div class="inspector-city-name">${nameEn}</div>
          ${nameAr ? `<div class="inspector-city-ar">${nameAr}</div>` : ''}
          <div class="inspector-coords">${lat >= 0 ? `${lat.toFixed(2)}°N` : `${(-lat).toFixed(2)}°S`}, ${lon >= 0 ? `${lon.toFixed(2)}°E` : `${(-lon).toFixed(2)}°W`} • ${localTime}</div>
        </div>
        <button class="inspector-close-btn" aria-label="Close inspector">✕</button>
      </div>

      <div class="inspector-prayer-list">
        <div class="inspector-prayer-item ${sched.currentPrayer === 'fajr' ? 'active' : ''}" style="--prayer-color: #38bdf8;">
          <span class="inspector-prayer-label"><span class="legend-color-dot" style="background-color: #38bdf8;"></span>Fajr</span>
          <span>${formatTime(sched.fajr, tz)}</span>
        </div>
        <div class="inspector-prayer-item" style="--prayer-color: #fef08a;">
          <span class="inspector-prayer-label"><span class="legend-color-dot" style="background-color: #fef08a;"></span>Sunrise</span>
          <span>${formatTime(sched.sunrise, tz)}</span>
        </div>
        <div class="inspector-prayer-item ${sched.currentPrayer === 'dhuhr' ? 'active' : ''}" style="--prayer-color: #facc15;">
          <span class="inspector-prayer-label"><span class="legend-color-dot" style="background-color: #facc15;"></span>Dhuhr</span>
          <span>${formatTime(sched.dhuhr, tz)}</span>
        </div>
        <div class="inspector-prayer-item ${sched.currentPrayer === 'asr' ? 'active' : ''}" style="--prayer-color: #fb923c;">
          <span class="inspector-prayer-label"><span class="legend-color-dot" style="background-color: #fb923c;"></span>ʿAsr</span>
          <span>${formatTime(sched.asr, tz)}</span>
        </div>
        <div class="inspector-prayer-item ${sched.currentPrayer === 'maghrib' ? 'active' : ''}" style="--prayer-color: #f43f5e;">
          <span class="inspector-prayer-label"><span class="legend-color-dot" style="background-color: #f43f5e;"></span>Maghrib</span>
          <span>${formatTime(sched.maghrib, tz)}</span>
        </div>
        <div class="inspector-prayer-item ${sched.currentPrayer === 'isha' ? 'active' : ''}" style="--prayer-color: #a855f7;">
          <span class="inspector-prayer-label"><span class="legend-color-dot" style="background-color: #a855f7;"></span>ʿIshaʾ</span>
          <span>${formatTime(sched.isha, tz)}</span>
        </div>
      </div>

      <div class="inspector-next-bar" style="font-size: 0.72rem; color: var(--color-accent); font-family: var(--font-mono); border-block-start: 1px solid rgba(255,255,255,0.1); padding-block-start: 0.35rem;">
        Next: ${sched.nextPrayer.toUpperCase()} in ${formatCountdown(sched.countdownMs)}
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
