// 24-Hour Global Adhan Continuity Timeline Ribbon and Interactive Scrubber

import { ContinuityStats } from '../simulation/continuity';
import { SimulationClock } from '../simulation/clock';
import { i18n } from '../i18n/manager';

export interface TimelineCallbacks {
  onScrub?: (date: Date) => void;
  onDayBoundary?: (date: Date) => void;
}

export interface TimelineUI {
  element: HTMLElement;
  updateStats: (stats: ContinuityStats) => void;
  updatePlayhead: (date: Date) => void;
  updateLastThirdCount: (count: number) => void;
  setDate?: (date: Date) => void;
  dispose: () => void;
}

export function createTimelineUI(
  clock: SimulationClock,
  onScrubOrCallbacks?: ((date: Date) => void) | TimelineCallbacks,
  optionalDayBoundary?: (date: Date) => void,
): TimelineUI {
  const onScrub = typeof onScrubOrCallbacks === 'function' ? onScrubOrCallbacks : onScrubOrCallbacks?.onScrub;
  const onDayBoundary =
    typeof onScrubOrCallbacks === 'object' && onScrubOrCallbacks !== null
      ? onScrubOrCallbacks.onDayBoundary
      : optionalDayBoundary;

  let lastDateString = clock.getTime().toISOString().slice(0, 10);

  const container = document.createElement('section');
  container.className = 'timeline-container hud-panel';
  container.setAttribute('aria-label', '24-hour global adhan timeline');

  let trans = i18n.getTranslations();

  const header = document.createElement('div');
  header.className = 'timeline-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'timeline-title-group';
  titleGroup.innerHTML = `
    <span class="timeline-title" id="timeline-title">${trans.timeline.title}</span>
    <span class="timeline-subtitle" id="timeline-subtitle" title="${trans.timeline.modelDisclaimer}">${trans.timeline.subtitle}</span>
  `;

  const statsStrip = document.createElement('div');
  statsStrip.className = 'timeline-stats-strip';
  statsStrip.innerHTML = `
    <div class="stat-chip">
      <span class="stat-chip-label" id="stat-cov-label">${trans.timeline.coverage}</span>
      <span class="stat-chip-val" id="stat-coverage">--</span>
    </div>
    <div class="stat-chip">
      <span class="stat-chip-label" id="stat-gap-label">${trans.timeline.longestGap}</span>
      <span class="stat-chip-val" id="stat-gap">--</span>
    </div>
    <div class="stat-chip">
      <span class="stat-chip-label" id="stat-peak-label">${trans.timeline.peakFront}</span>
      <span class="stat-chip-val" id="stat-peak">--</span>
    </div>
    <div class="stat-chip stat-chip-last-third" id="stat-chip-last-third">
      <span class="stat-chip-dot" aria-hidden="true"></span>
      <span class="stat-chip-label" id="stat-last-third-label">${trans.timeline.lastThirdCities}</span>
      <span class="stat-chip-val" id="stat-last-third">--</span>
    </div>
  `;

  const applyChipTips = (): void => {
    const tips = [
      trans.timeline.coverageTip,
      trans.timeline.gapTip,
      trans.timeline.peakTip,
      trans.timeline.lastThirdTip,
    ];
    statsStrip.querySelectorAll('.stat-chip').forEach((chip, i) => {
      chip.setAttribute('title', tips[i] ?? '');
      chip.setAttribute('tabindex', '0');
    });
  };
  applyChipTips();

  header.appendChild(titleGroup);
  header.appendChild(statsStrip);
  container.appendChild(header);

  // Precision scrubber canvas track
  const trackWrapper = document.createElement('div');
  trackWrapper.className = 'timeline-track-wrapper';
  trackWrapper.setAttribute('role', 'slider');
  trackWrapper.setAttribute('aria-label', 'Timeline scrubber');
  trackWrapper.setAttribute('aria-valuemin', '0');
  trackWrapper.setAttribute('aria-valuemax', '86400');
  trackWrapper.tabIndex = 0;

  const canvas = document.createElement('canvas');
  canvas.className = 'timeline-canvas';
  canvas.height = 32;
  trackWrapper.appendChild(canvas);

  // Scrubber playhead marker
  const playhead = document.createElement('div');
  playhead.className = 'timeline-playhead';
  const playheadLabel = document.createElement('div');
  playheadLabel.className = 'timeline-playhead-label';
  playhead.appendChild(playheadLabel);
  trackWrapper.appendChild(playhead);

  // Time labels across the 24-hour cycle
  const labelRow = document.createElement('div');
  labelRow.className = 'timeline-label-row';
  const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00'];
  const minorHours = new Set(['03:00', '09:00', '15:00', '21:00']);
  for (const h of hours) {
    const lbl = document.createElement('span');
    lbl.className = `timeline-hour-label ${minorHours.has(h) ? 'hour-minor' : ''}`;
    lbl.textContent = h;
    labelRow.appendChild(lbl);
  }
  trackWrapper.appendChild(labelRow);

  container.appendChild(trackWrapper);

  let currentStats: ContinuityStats | null = null;

  const renderCanvas = (): void => {
    const width = trackWrapper.clientWidth || 600;
    canvas.width = width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, canvas.height);

    if (!currentStats || currentStats.timelineBins.length === 0) {
      // Subtle baseline grid fill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.fillRect(0, 0, width, canvas.height);
      return;
    }

    const bins = currentStats.timelineBins;
    const maxVal = Math.max(...bins, 1);
    const binWidth = width / bins.length;

    // Create a smooth gradient fill for the density waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
    gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');

    ctx.fillStyle = gradient;

    for (let i = 0; i < bins.length; i++) {
      const val = bins[i];
      const h = (val / maxVal) * (canvas.height - 4);
      const x = i * binWidth;
      const y = canvas.height - h;

      if (val > 0) {
        ctx.fillRect(x, y, Math.max(1, binWidth), h);
      } else {
        // Red indicator for potential coverage gap
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.fillRect(x, canvas.height - 2, Math.max(1, binWidth), 2);
        ctx.fillStyle = gradient;
      }
    }

    // Top hairline accent stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < bins.length; i++) {
      const val = bins[i];
      const h = (val / maxVal) * (canvas.height - 4);
      const x = i * binWidth;
      const y = canvas.height - h;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  };

  const updateStats = (stats: ContinuityStats): void => {
    currentStats = stats;
    const subtitleEl = container.querySelector('#timeline-subtitle');
    if (subtitleEl) {
      const countFormatted = stats.settlementCount.toLocaleString('en-US');
      subtitleEl.textContent = `${trans.timeline.subtitle} (${countFormatted} ${trans.timeline.cities} · ${stats.adhanDurationMinutes}m)`;
      subtitleEl.setAttribute('title', trans.timeline.modelDisclaimer);
    }

    const covEl = container.querySelector('#stat-coverage');
    if (covEl) covEl.textContent = `${stats.coveragePercent}%`;

    const gapEl = container.querySelector('#stat-gap');
    if (gapEl) gapEl.textContent = stats.longestGapSeconds > 0 ? `${stats.longestGapSeconds}s` : trans.timeline.unbroken;

    const peakEl = container.querySelector('#stat-peak');
    if (peakEl) peakEl.textContent = `${stats.peakConcurrentAdhans} ${trans.timeline.cities}`;

    renderCanvas();
  };

  let lastRenderedCount = -1;

  const updateLastThirdCount = (count: number): void => {
    const safeCount = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
    if (safeCount === lastRenderedCount) return;
    lastRenderedCount = safeCount;

    const valEl = container.querySelector('#stat-last-third');
    if (valEl) {
      valEl.textContent = safeCount.toLocaleString('en-US');
    }

    const chipEl = container.querySelector('#stat-chip-last-third');
    if (chipEl) {
      chipEl.classList.toggle('is-active', safeCount > 0);
    }
  };

  const unsubscribe = i18n.onLocaleChange((_locale, newTrans) => {
    trans = newTrans;
    const titleEl = container.querySelector('#timeline-title');
    if (titleEl) titleEl.textContent = trans.timeline.title;
    const subtitleEl = container.querySelector('#timeline-subtitle');
    if (subtitleEl) {
      if (currentStats) {
        const countFormatted = currentStats.settlementCount.toLocaleString('en-US');
        subtitleEl.textContent = `${trans.timeline.subtitle} (${countFormatted} ${trans.timeline.cities} · ${currentStats.adhanDurationMinutes}m)`;
      } else {
        subtitleEl.textContent = trans.timeline.subtitle;
      }
      subtitleEl.setAttribute('title', trans.timeline.modelDisclaimer);
    }

    const covLabel = container.querySelector('#stat-cov-label');
    if (covLabel) covLabel.textContent = trans.timeline.coverage;
    const gapLabel = container.querySelector('#stat-gap-label');
    if (gapLabel) gapLabel.textContent = trans.timeline.longestGap;
    const peakLabel = container.querySelector('#stat-peak-label');
    if (peakLabel) peakLabel.textContent = trans.timeline.peakFront;
    const lastThirdLabel = container.querySelector('#stat-last-third-label');
    if (lastThirdLabel) lastThirdLabel.textContent = trans.timeline.lastThirdCities;
    applyChipTips();

    if (currentStats) {
      updateStats(currentStats);
    }
  });

  const updatePlayhead = (date: Date): void => {
    const curDateString = date.toISOString().slice(0, 10);
    if (curDateString !== lastDateString) {
      lastDateString = curDateString;
      if (onDayBoundary) {
        onDayBoundary(date);
      }
    }

    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const fraction = totalSeconds / 86400;

    const percent = (fraction * 100).toFixed(2);
    playhead.style.insetInlineStart = `${percent}%`;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    playheadLabel.textContent = `${hh}:${mm}:${ss} UTC`;
    trackWrapper.setAttribute('aria-valuenow', String(totalSeconds));
  };

  // Interactive scrubbing
  let isDragging = false;

  const handleScrub = (clientX: number): void => {
    const rect = trackWrapper.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const fraction = x / rect.width;
    const totalSeconds = fraction * 86400;

    const current = clock.getTime();
    const newDate = new Date(
      Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate(),
        0,
        0,
        Math.floor(totalSeconds),
      ),
    );

    clock.setTime(newDate);
    updatePlayhead(newDate);
    if (onScrub) onScrub(newDate);
  };

  const onMouseDown = (e: MouseEvent): void => {
    isDragging = true;
    if (typeof document !== 'undefined') {
      document.body.classList.add('is-timeline-scrubbing');
    }
    handleScrub(e.clientX);
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (isDragging) {
      handleScrub(e.clientX);
    }
  };

  const onMouseUp = (): void => {
    if (isDragging) {
      isDragging = false;
      if (typeof document !== 'undefined') {
        document.body.classList.remove('is-timeline-scrubbing');
      }
    }
  };

  trackWrapper.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // Keyboard navigation for accessibility
  trackWrapper.addEventListener('keydown', (e: KeyboardEvent) => {
    const current = clock.getTime();
    let stepSeconds = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      stepSeconds = e.shiftKey ? 3600 : 300;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      stepSeconds = e.shiftKey ? -3600 : -300;
    }
    if (stepSeconds !== 0) {
      e.preventDefault();
      const newDate = new Date(current.getTime() + stepSeconds * 1000);
      clock.setTime(newDate);
      updatePlayhead(newDate);
      if (onScrub) onScrub(newDate);
    }
  });

  // Resize handler for canvas
  const resizeObserver = new ResizeObserver(() => {
    renderCanvas();
  });
  resizeObserver.observe(trackWrapper);

  const dispose = (): void => {
    unsubscribe();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('is-timeline-scrubbing');
    }
    trackWrapper.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    resizeObserver.disconnect();
    container.remove();
  };

  return {
    element: container,
    updateStats,
    updatePlayhead,
    updateLastThirdCount,
    setDate: updatePlayhead,
    dispose,
  };
}
