// Geoscape HUD layout and interactive controls overlay

import { SimulationClock, PlaybackSpeed } from '../simulation/clock';
import { CalculationConventionName, CALCULATION_CONVENTIONS } from '../prayer/conventions';
import { PrayerFrontKey, PRAYER_COLORS } from '../globe/fronts';
import { GlobeScene } from '../globe/scene';
import { createTimelineUI, TimelineUI } from './timeline';
import { createInspectorPanel, InspectorPanel } from './inspector';
import { ContinuityStats } from '../simulation/continuity';

export type ViewMode = 'visual' | 'astronomy' | 'prayer' | 'adhan';

export interface HudOverlay {
  element: HTMLElement;
  timeline: TimelineUI;
  inspector: InspectorPanel;
  updateStats: (stats: ContinuityStats) => void;
  updateTime: (date: Date) => void;
  onFollowAdhanToggle?: (active: boolean) => void;
  dispose: () => void;
}

export function createHudOverlay(
  clock: SimulationClock,
  globeScene: GlobeScene,
  callbacks: {
    onConventionChange?: (conv: CalculationConventionName) => void;
    onFollowAdhan?: () => void;
    onStyleChange?: (style: 'roadmap' | 'satellite') => void;
  } = {},
): HudOverlay {
  const root = document.getElementById('hud-overlay') || document.createElement('div');
  root.id = 'hud-overlay';

  // 1. Top Bar
  const topBar = document.createElement('header');
  topBar.className = 'hud-top-bar';

  const brand = document.createElement('div');
  brand.className = 'brand-badge hud-panel';
  brand.innerHTML = `
    <div class="brand-title">ADHAN EARTH</div>
    <div class="brand-subtitle">3D Planetary Observatory • athan.waqf.app</div>
  `;

  // Top Right Controls Box
  const controlsBox = document.createElement('div');
  controlsBox.className = 'hud-controls-box hud-panel';

  // Playback speeds
  const speedTitle = document.createElement('div');
  speedTitle.className = 'control-group-title';
  speedTitle.textContent = 'Time Playback';
  controlsBox.appendChild(speedTitle);

  const speedRow = document.createElement('div');
  speedRow.className = 'control-btn-row';

  const speeds: { label: string; speed: PlaybackSpeed; isLive?: boolean }[] = [
    { label: 'LIVE', speed: 1, isLive: true },
    { label: '❚❚', speed: 0 },
    { label: '1×', speed: 1 },
    { label: '60×', speed: 60 },
    { label: '300×', speed: 300 },
  ];

  const speedButtons: HTMLButtonElement[] = [];

  for (const s of speeds) {
    const btn = document.createElement('button');
    btn.className = `btn-ctrl ${s.isLive ? 'active' : ''}`;
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      speedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (s.isLive) {
        clock.setLive(true);
      } else {
        clock.setSpeed(s.speed);
      }
    });
    speedRow.appendChild(btn);
    speedButtons.push(btn);
  }
  controlsBox.appendChild(speedRow);

  // Prayer Front Layer Toggles
  const layersTitle = document.createElement('div');
  layersTitle.className = 'control-group-title';
  layersTitle.textContent = 'Prayer Fronts';
  controlsBox.appendChild(layersTitle);

  const layersRow = document.createElement('div');
  layersRow.className = 'control-btn-row';

  const prayerKeys: PrayerFrontKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'terminator'];
  for (const k of prayerKeys) {
    const btn = document.createElement('button');
    btn.className = 'btn-ctrl active';
    btn.style.borderColor = `#${PRAYER_COLORS[k].toString(16).padStart(6, '0')}`;
    btn.textContent = k.charAt(0).toUpperCase() + k.slice(1);
    let visible = true;
    btn.addEventListener('click', () => {
      visible = !visible;
      btn.classList.toggle('active', visible);
      globeScene.prayerFronts.setVisibility(k, visible);
    });
    layersRow.appendChild(btn);
  }
  controlsBox.appendChild(layersRow);

  // Map Layer Style (Google Maps Roadmap vs Satellite)
  const styleTitle = document.createElement('div');
  styleTitle.className = 'control-group-title';
  styleTitle.textContent = 'Map Layer';
  controlsBox.appendChild(styleTitle);

  const styleRow = document.createElement('div');
  styleRow.className = 'control-btn-row';

  const mapBtn = document.createElement('button');
  mapBtn.className = `btn-ctrl ${globeScene.getMapStyle() === 'roadmap' ? 'active' : ''}`;
  mapBtn.textContent = 'Map';

  const satBtn = document.createElement('button');
  satBtn.className = `btn-ctrl ${globeScene.getMapStyle() === 'satellite' ? 'active' : ''}`;
  satBtn.textContent = 'Satellite';

  mapBtn.addEventListener('click', () => {
    mapBtn.classList.add('active');
    satBtn.classList.remove('active');
    globeScene.setMapStyle('roadmap');
    if (callbacks.onStyleChange) callbacks.onStyleChange('roadmap');
  });

  satBtn.addEventListener('click', () => {
    satBtn.classList.add('active');
    mapBtn.classList.remove('active');
    globeScene.setMapStyle('satellite');
    if (callbacks.onStyleChange) callbacks.onStyleChange('satellite');
  });

  styleRow.appendChild(mapBtn);
  styleRow.appendChild(satBtn);
  controlsBox.appendChild(styleRow);

  // Convention Selector & Narrative Mode
  const actionsRow = document.createElement('div');
  actionsRow.className = 'control-btn-row';
  actionsRow.style.marginBlockStart = '0.25rem';

  const convSelect = document.createElement('select');
  convSelect.id = 'calc-convention-select';
  convSelect.name = 'convention';
  convSelect.setAttribute('aria-label', 'Prayer calculation convention');
  convSelect.className = 'btn-ctrl';
  convSelect.style.cursor = 'pointer';
  for (const c of Object.keys(CALCULATION_CONVENTIONS)) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c.replace(/([A-Z])/g, ' $1').trim();
    if (c === 'UmmAlQura') opt.selected = true;
    convSelect.appendChild(opt);
  }
  convSelect.addEventListener('change', () => {
    const convName = convSelect.value as CalculationConventionName;
    globeScene.setConvention(CALCULATION_CONVENTIONS[convName]);
    if (callbacks.onConventionChange) callbacks.onConventionChange(convName);
  });
  actionsRow.appendChild(convSelect);

  const followBtn = document.createElement('button');
  followBtn.className = 'btn-ctrl';
  followBtn.textContent = 'Follow Adhān ➜';
  let isFollowing = false;
  followBtn.addEventListener('click', () => {
    isFollowing = !isFollowing;
    followBtn.classList.toggle('active', isFollowing);
    if (callbacks.onFollowAdhan) callbacks.onFollowAdhan();
  });
  actionsRow.appendChild(followBtn);

  controlsBox.appendChild(actionsRow);

  topBar.appendChild(brand);
  topBar.appendChild(controlsBox);
  root.appendChild(topBar);

  // 2. Floating Inspector Panel
  const inspector = createInspectorPanel();
  root.appendChild(inspector.element);

  // 3. Bottom Timeline Ribbon
  const timeline = createTimelineUI(clock, (date) => {
    globeScene.setTime(date);
  });
  root.appendChild(timeline.element);

  const updateStats = (stats: ContinuityStats): void => {
    timeline.updateStats(stats);
  };

  const updateTime = (date: Date): void => {
    timeline.updatePlayhead(date);
    inspector.updateTime(date);
  };

  const dispose = (): void => {
    timeline.dispose();
    inspector.dispose();
    root.innerHTML = '';
  };

  return {
    element: root,
    timeline,
    inspector,
    updateStats,
    updateTime,
    dispose,
  };
}
