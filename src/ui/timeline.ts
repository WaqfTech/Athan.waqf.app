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
  const container = document.createElement('div');
  container.className = 'timeline-container hud-panel';

  const header = document.createElement('div');
  header.className = 'timeline-header';

  const title = document.createElement('span');
  title.className = 'timeline-title';
  title.textContent = '24-Hour Global Adhan Activity';

  const statsBadge = document.createElement('div');
  statsBadge.className = 'timeline-stats';
  statsBadge.innerHTML = `
    <span class="stat-item"><span class="stat-label">Coverage:</span> <span class="stat-val" id="stat-coverage">--</span></span>
    <span class="stat-item"><span class="stat-label">Longest Gap:</span> <span class="stat-val" id="stat-gap">--</span></span>
    <span class="stat-item"><span class="stat-label">Peak Concurrent:</span> <span class="stat-val" id="stat-peak">--</span></span>
  `;

  header.appendChild(title);
  header.appendChild(statsBadge);
  container.appendChild(header);

  // Canvas for rendering density histogram
  const trackWrapper = document.createElement('div');
  trackWrapper.className = 'timeline-track-wrapper';

  const canvas = document.createElement('canvas');
  canvas.className = 'timeline-canvas';
  canvas.height = 36;
  trackWrapper.appendChild(canvas);

  // Scrubber playhead marker
  const playhead = document.createElement('div');
  playhead.className = 'timeline-playhead';
  const playheadLabel = document.createElement('div');
  playheadLabel.className = 'timeline-playhead-label';
  playhead.appendChild(playheadLabel);
  trackWrapper.appendChild(playhead);

  // Time labels
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
      // Draw baseline background
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(0, 0, width, canvas.height);
      return;
    }

    const bins = currentStats.timelineBins;
    const maxVal = Math.max(...bins, 1);
    const binWidth = width / bins.length;

    for (let i = 0; i < bins.length; i++) {
      const val = bins[i];
      const h = (val / maxVal) * (canvas.height - 4);
      const x = i * binWidth;
      const y = canvas.height - h;

      // Color intensity based on density
      const intensity = Math.min(1, val / (maxVal * 0.7));
      ctx.fillStyle = val > 0 ? `rgba(56, 189, 248, ${0.35 + intensity * 0.65})` : 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(x, y, Math.max(1, binWidth), h);
    }
  };

  const updateStats = (stats: ContinuityStats): void => {
    currentStats = stats;
    const covEl = container.querySelector('#stat-coverage');
    if (covEl) covEl.textContent = `${stats.coveragePercent}%`;

    const gapEl = container.querySelector('#stat-gap');
    if (gapEl) gapEl.textContent = stats.longestGapSeconds > 0 ? `${stats.longestGapSeconds}s` : '0s (None)';

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
        totalSeconds,
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
