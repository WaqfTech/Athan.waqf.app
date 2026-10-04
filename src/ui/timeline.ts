// 24-Hour Global Adhan Continuity Timeline Ribbon and Interactive Scrubber

import { ContinuityStats } from '../simulation/continuity';
import { SimulationClock } from '../simulation/clock';

export interface TimelineUI {
  element: HTMLElement;
  updateStats: (stats: ContinuityStats) => void;
  updatePlayhead: (date: Date) => void;
  dispose: () => void;
}

export function createTimelineUI(
  clock: SimulationClock,
  onScrub?: (date: Date) => void,
): TimelineUI {
  const container = document.createElement('section');
  container.className = 'timeline-container hud-panel';
  container.setAttribute('aria-label', '24-hour global adhan timeline');

  const header = document.createElement('div');
  header.className = 'timeline-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'timeline-title-group';
  titleGroup.innerHTML = `
    <span class="timeline-title">Continuous Planetary Adhān</span>
    <span class="timeline-subtitle">24-Hour Solar Traversal</span>
  `;

  const statsStrip = document.createElement('div');
  statsStrip.className = 'timeline-stats-strip';
  statsStrip.innerHTML = `
    <div class="stat-chip">
      <span class="stat-chip-label">Coverage</span>
      <span class="stat-chip-val" id="stat-coverage">--</span>
    </div>
    <div class="stat-chip">
      <span class="stat-chip-label">Longest Gap</span>
      <span class="stat-chip-val" id="stat-gap">--</span>
    </div>
    <div class="stat-chip">
      <span class="stat-chip-label">Peak Front</span>
      <span class="stat-chip-val" id="stat-peak">--</span>
    </div>
  `;

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
  for (const h of hours) {
    const lbl = document.createElement('span');
    lbl.className = 'timeline-hour-label';
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
    const covEl = container.querySelector('#stat-coverage');
    if (covEl) covEl.textContent = `${stats.coveragePercent}%`;

    const gapEl = container.querySelector('#stat-gap');
    if (gapEl) gapEl.textContent = stats.longestGapSeconds > 0 ? `${stats.longestGapSeconds}s` : '0s (Unbroken)';

    const peakEl = container.querySelector('#stat-peak');
    if (peakEl) peakEl.textContent = `${stats.peakConcurrentAdhans} cities`;

    renderCanvas();
  };

  const updatePlayhead = (date: Date): void => {
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
    handleScrub(e.clientX);
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (isDragging) {
      handleScrub(e.clientX);
    }
  };

  const onMouseUp = (): void => {
    isDragging = false;
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
    dispose,
  };
}
