// Geoscape HUD layout and interactive observatory controls overlay

import { SimulationClock, PlaybackSpeed } from '../simulation/clock';
import { CalculationConventionName, CALCULATION_CONVENTIONS } from '../prayer/conventions';
import { PrayerFrontKey, PRAYER_COLORS } from '../globe/fronts';
import { GlobeScene } from '../globe/scene';
import { createTimelineUI, TimelineUI } from './timeline';
import { createInspectorPanel, InspectorPanel } from './inspector';
import { ContinuityStats } from '../simulation/continuity';
import { Settlement } from '../population/loader';
import { i18n, SUPPORTED_LOCALES, SupportedLocale } from '../i18n';

export type ViewMode = 'visual' | 'astronomy' | 'prayer' | 'adhan';

export interface HudOverlay {
  element: HTMLElement;
  timeline: TimelineUI;
  inspector: InspectorPanel;
  updateStats: (stats: ContinuityStats) => void;
  updateTime: (date: Date) => void;
  setSettlements: (settlements: Settlement[]) => void;
  onFollowAdhanToggle?: (active: boolean) => void;
  dispose: () => void;
}

// Quick jump iconic and sacred Islamic cities
interface QuickCity {
  name: string;
  nameAr: string;
  lat: number;
  lon: number;
  countryCode: string;
  timezone: string;
}

const QUICK_CITIES: QuickCity[] = [
  { name: 'Makkah', nameAr: 'مكة المكرمة', lat: 21.4225, lon: 39.8262, countryCode: 'SA', timezone: 'Asia/Riyadh' },
  { name: 'Madinah', nameAr: 'المدينة المنورة', lat: 24.4672, lon: 39.6112, countryCode: 'SA', timezone: 'Asia/Riyadh' },
  { name: 'Al-Quds', nameAr: 'القدس', lat: 31.7767, lon: 35.2345, countryCode: 'PS', timezone: 'Asia/Jerusalem' },
  { name: 'Cairo', nameAr: 'القاهرة', lat: 30.0444, lon: 31.2357, countryCode: 'EG', timezone: 'Africa/Cairo' },
  { name: 'Amman', nameAr: 'عَمّان', lat: 31.9539, lon: 35.9106, countryCode: 'JO', timezone: 'Asia/Amman' },
  { name: 'Istanbul', nameAr: 'إسطنبول', lat: 41.0082, lon: 28.9784, countryCode: 'TR', timezone: 'Europe/Istanbul' },
];

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
    .toLowerCase();
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function createHudOverlay(
  clock: SimulationClock,
  globeScene: GlobeScene,
  callbacks: {
    onConventionChange?: (conv: CalculationConventionName) => void;
    onFollowAdhan?: () => void;
    onStyleChange?: (style: 'roadmap' | 'satellite') => void;
    onSelectCity?: (settlement: Settlement) => void;
  } = {},
): HudOverlay {
  const root = document.getElementById('hud-overlay') || document.createElement('div');
  root.id = 'hud-overlay';
  root.innerHTML = '';

  let allSettlements: Settlement[] = [];
  const bottomStack = document.createElement('div');
  bottomStack.className = 'hud-bottom-stack';

  let currentLocale = i18n.getLocale();
  let t = i18n.getTranslations();

  // 1. Top Navigation Bar
  const topBar = document.createElement('header');
  topBar.className = 'hud-top-bar';

  // Brand Badge
  const brand = document.createElement('div');
  brand.className = 'brand-section hud-panel';
  brand.innerHTML = `
    <div class="brand-emblem" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="9" stroke-opacity="0.6"/>
        <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9c-4.97 0-9-4.03-9-9 0-3.3 1.8-6.18 4.5-7.66" />
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
      </svg>
    </div>
    <div class="brand-info">
      <div class="brand-title">${t.brand.title}</div>
      <div class="brand-subtitle">${t.brand.subtitle}</div>
    </div>
    <div class="live-clock-pill">
      <span class="live-beacon-dot" aria-hidden="true"></span>
      <span id="live-utc-ticker">00:00:00 UTC</span>
    </div>
  `;
  const brandTitleEl = brand.querySelector('.brand-title') as HTMLElement;
  const brandSubtitleEl = brand.querySelector('.brand-subtitle') as HTMLElement;
  topBar.appendChild(brand);

  // City Search Bar
  const searchBox = document.createElement('div');
  searchBox.className = 'city-search-box';

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'city-search-input-wrapper';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'search-icon-badge';
  searchIcon.setAttribute('aria-hidden', 'true');
  searchIcon.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  `;

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'city-search-input';
  searchInput.placeholder = t.search.placeholder;
  searchInput.setAttribute('aria-label', t.search.placeholder);
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('spellcheck', 'false');

  const clearBtn = document.createElement('button');
  clearBtn.className = 'city-search-clear';
  clearBtn.setAttribute('aria-label', 'Clear search input');
  clearBtn.textContent = '✕';
  clearBtn.style.display = 'none';

  inputWrapper.appendChild(searchIcon);
  inputWrapper.appendChild(searchInput);
  inputWrapper.appendChild(clearBtn);
  searchBox.appendChild(inputWrapper);

  const searchDropdown = document.createElement('div');
  searchDropdown.className = 'city-search-dropdown hud-panel';
  searchDropdown.setAttribute('role', 'listbox');
  searchBox.appendChild(searchDropdown);

  let searchResults: Settlement[] = [];
  let highlightedIndex = -1;

  const renderSearchResults = (): void => {
    searchDropdown.innerHTML = '';
    if (searchResults.length === 0) {
      searchDropdown.classList.remove('active');
      return;
    }

    searchDropdown.classList.add('active');
    searchResults.forEach((item, idx) => {
      const row = document.createElement('button');
      row.className = `search-result-item ${idx === highlightedIndex ? 'highlighted' : ''}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', idx === highlightedIndex ? 'true' : 'false');

      const infoDiv = document.createElement('div');
      infoDiv.className = 'search-item-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'search-item-name';
      nameSpan.textContent = `${item.name}, ${item.countryCode}`;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'search-item-meta';
      const latStr = item.latitude >= 0 ? `${item.latitude.toFixed(1)}°N` : `${(-item.latitude).toFixed(1)}°S`;
      const lonStr = item.longitude >= 0 ? `${item.longitude.toFixed(1)}°E` : `${(-item.longitude).toFixed(1)}°W`;
      metaSpan.textContent = `${latStr}, ${lonStr} • ${item.timezone.split('/')[1] || item.timezone}`;

      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(metaSpan);

      const arSpan = document.createElement('span');
      arSpan.className = 'search-item-ar';
      arSpan.setAttribute('dir', 'rtl');
      arSpan.setAttribute('lang', 'ar');
      arSpan.textContent = item.nameAr || '';

      row.appendChild(infoDiv);
      row.appendChild(arSpan);

      row.addEventListener('click', () => {
        selectCity(item);
      });

      searchDropdown.appendChild(row);
    });
  };

  const selectCity = (city: Settlement): void => {
    searchInput.value = `${city.name}, ${city.countryCode}`;
    searchDropdown.classList.remove('active');
    clearBtn.style.display = 'flex';

    if (callbacks.onSelectCity) {
      callbacks.onSelectCity(city);
    } else {
      globeScene.cameraRig.focusCoordinates(city.latitude, city.longitude, 10, true);
      inspector.inspectSettlement(city, clock.getTime());
    }
  };

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (!query) {
      clearBtn.style.display = 'none';
      searchResults = [];
      highlightedIndex = -1;
      renderSearchResults();
      return;
    }

    clearBtn.style.display = 'flex';
    const normEn = normalizeSearchText(query);
    const normAr = normalizeArabic(query);

    const matches: { city: Settlement; score: number }[] = [];

    for (const city of allSettlements) {
      const cityEn = normalizeSearchText(city.name);
      const cityAr = normalizeArabic(city.nameAr || '');

      let score = 0;
      if (cityEn === normEn || cityAr === normAr) {
        score = 100;
      } else if (cityEn.startsWith(normEn) || cityAr.startsWith(normAr)) {
        score = 80;
      } else if (cityEn.includes(normEn) || cityAr.includes(normAr)) {
        score = 50;
      }

      if (score > 0) {
        // Tie-break with population
        matches.push({ city, score: score + Math.log10(city.population || 1) });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    searchResults = matches.slice(0, 8).map((m) => m.city);
    highlightedIndex = -1;
    renderSearchResults();
  });

  searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % searchResults.length;
      renderSearchResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + searchResults.length) % searchResults.length;
      renderSearchResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        selectCity(searchResults[highlightedIndex]);
      } else if (searchResults.length > 0) {
        selectCity(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      searchDropdown.classList.remove('active');
    }
  });

  const showQuickSuggestions = (): void => {
    if (searchInput.value.trim()) return;
    searchResults = QUICK_CITIES.map((q) => ({
      name: q.name,
      nameAr: q.nameAr,
      latitude: q.lat,
      longitude: q.lon,
      countryCode: q.countryCode,
      population: 1500000,
      timezone: q.timezone,
    }));
    highlightedIndex = -1;
    renderSearchResults();
  };

  searchInput.addEventListener('focus', () => {
    if (!searchInput.value.trim()) {
      showQuickSuggestions();
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchResults = [];
    highlightedIndex = -1;
    renderSearchResults();
    searchInput.focus();
  });

  document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target as Node)) {
      searchDropdown.classList.remove('active');
    }
  });

  topBar.appendChild(searchBox);

  // Quick Jump Sacred Cities Strip
  const quickStrip = document.createElement('div');
  quickStrip.className = 'quick-cities-strip';

  for (const q of QUICK_CITIES) {
    const btn = document.createElement('button');
    btn.className = 'btn-quick-city';
    btn.setAttribute('aria-label', `Jump to ${q.name}`);
    btn.innerHTML = `<span>${q.name}</span><span class="quick-ar" dir="rtl">${q.nameAr.split(' ')[0]}</span>`;
    btn.addEventListener('click', () => {
      const settlement: Settlement = {
        name: q.name,
        nameAr: q.nameAr,
        latitude: q.lat,
        longitude: q.lon,
        countryCode: q.countryCode,
        population: 1500000,
        timezone: q.timezone,
      };
      selectCity(settlement);
    });
    quickStrip.appendChild(btn);
  }
  topBar.appendChild(quickStrip);

  // Language Switcher Dropdown
  const langWrapper = document.createElement('div');
  langWrapper.className = 'lang-menu-wrapper';

  const langTrigger = document.createElement('button');
  langTrigger.className = 'btn-lang-trigger';
  langTrigger.setAttribute('aria-label', 'Select interface language');
  langTrigger.setAttribute('aria-expanded', 'false');
  langTrigger.setAttribute('aria-haspopup', 'listbox');

  const langTriggerIcon = document.createElement('span');
  langTriggerIcon.setAttribute('aria-hidden', 'true');
  langTriggerIcon.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  `;

  const activeLangName = document.createElement('span');
  activeLangName.id = 'active-lang-name';
  activeLangName.textContent = SUPPORTED_LOCALES[currentLocale]?.nativeName || 'English';

  const langChevron = document.createElement('span');
  langChevron.setAttribute('aria-hidden', 'true');
  langChevron.style.fontSize = '10px';
  langChevron.style.opacity = '0.7';
  langChevron.textContent = '▾';

  langTrigger.appendChild(langTriggerIcon);
  langTrigger.appendChild(activeLangName);
  langTrigger.appendChild(langChevron);

  const langMenu = document.createElement('div');
  langMenu.className = 'lang-dropdown-menu hud-panel';
  langMenu.setAttribute('role', 'listbox');

  const localeKeys = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
  for (const loc of localeKeys) {
    const meta = SUPPORTED_LOCALES[loc];
    const item = document.createElement('button');
    item.className = `lang-menu-item ${loc === currentLocale ? 'active' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('data-lang', loc);
    item.setAttribute('aria-selected', loc === currentLocale ? 'true' : 'false');
    item.innerHTML = `
      <span>${meta.nativeName}</span>
      <span style="font-size: 10px; opacity: 0.6; text-transform: uppercase;">${meta.code}</span>
    `;

    item.addEventListener('click', () => {
      langMenu.querySelectorAll('.lang-menu-item').forEach((el) => {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
      });
      item.classList.add('active');
      item.setAttribute('aria-selected', 'true');
      activeLangName.textContent = meta.nativeName;
      langMenu.classList.remove('active');
      langTrigger.setAttribute('aria-expanded', 'false');

      i18n.setLocale(loc);
    });

    langMenu.appendChild(item);
  }

  langTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = langMenu.classList.toggle('active');
    langTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!langWrapper.contains(e.target as Node)) {
      langMenu.classList.remove('active');
      langTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  langWrapper.appendChild(langTrigger);
  langWrapper.appendChild(langMenu);
  topBar.appendChild(langWrapper);

  // Zen View / Minimizer Button
  const zenBtn = document.createElement('button');
  zenBtn.className = 'btn-icon-toggle';
  zenBtn.setAttribute('aria-label', 'Toggle HUD minimal mode');
  zenBtn.title = 'Toggle clean planetary view';
  zenBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 14 10 14 10 20"/>
      <polyline points="20 10 14 10 14 4"/>
      <line x1="14" y1="10" x2="21" y2="3"/>
      <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  `;
  let isZenMode = false;
  zenBtn.addEventListener('click', () => {
    isZenMode = !isZenMode;
    bottomStack.style.display = isZenMode ? 'none' : 'flex';
    quickStrip.style.display = isZenMode ? 'none' : 'flex';
  });
  topBar.appendChild(zenBtn);

  root.appendChild(topBar);

  // 2. Floating Controls Dock
  const controlsDock = document.createElement('div');
  controlsDock.className = 'hud-dock hud-panel';

  // Playback speeds segment
  const speedSegment = document.createElement('div');
  speedSegment.className = 'dock-segment';
  const speedLabel = document.createElement('span');
  speedLabel.className = 'dock-label';
  speedLabel.textContent = t.controls.time;
  speedSegment.appendChild(speedLabel);

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
    btn.className = `btn-dock-pill ${s.isLive ? 'active' : ''}`;
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
    speedSegment.appendChild(btn);
    speedButtons.push(btn);
  }
  controlsDock.appendChild(speedSegment);

  // Map layer style segment
  const mapSegment = document.createElement('div');
  mapSegment.className = 'dock-segment';

  const mapBtn = document.createElement('button');
  mapBtn.className = `btn-dock-pill ${globeScene.getMapStyle() === 'roadmap' ? 'active' : ''}`;
  mapBtn.textContent = t.controls.map;

  const satBtn = document.createElement('button');
  satBtn.className = `btn-dock-pill ${globeScene.getMapStyle() === 'satellite' ? 'active' : ''}`;
  satBtn.textContent = t.controls.satellite;

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

  mapSegment.appendChild(mapBtn);
  mapSegment.appendChild(satBtn);
  controlsDock.appendChild(mapSegment);

  // Prayer Front Layer Toggles
  const prayerSegment = document.createElement('div');
  prayerSegment.className = 'dock-segment';

  const prayerLabels: Map<PrayerFrontKey, HTMLSpanElement> = new Map();
  const prayerKeys: PrayerFrontKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'terminator'];
  for (const k of prayerKeys) {
    const hexColor = `#${PRAYER_COLORS[k].toString(16).padStart(6, '0')}`;
    const btn = document.createElement('button');
    btn.className = 'btn-prayer-pill active';
    btn.setAttribute('data-prayer', k);
    btn.setAttribute('aria-label', `Toggle ${k} prayer front`);
    btn.style.setProperty('--prayer-color', hexColor);

    const dot = document.createElement('span');
    dot.className = 'prayer-indicator-dot';

    const label = document.createElement('span');
    label.textContent = t.prayers[k] || k;
    prayerLabels.set(k, label);

    btn.appendChild(dot);
    btn.appendChild(label);

    let visible = true;
    btn.addEventListener('click', () => {
      visible = !visible;
      btn.classList.toggle('active', visible);
      globeScene.prayerFronts.setVisibility(k, visible);
    });
    prayerSegment.appendChild(btn);
  }
  controlsDock.appendChild(prayerSegment);

  // Custom Convention Selector Dropdown
  const convWrapper = document.createElement('div');
  convWrapper.className = 'convention-menu-wrapper';

  const convTrigger = document.createElement('button');
  convTrigger.className = 'btn-convention-trigger';
  convTrigger.setAttribute('aria-label', 'Prayer calculation convention');
  convTrigger.innerHTML = `
    <span id="active-conv-name">Umm al-Qura</span>
    <span aria-hidden="true" style="font-size: 10px; opacity: 0.7;">▾</span>
  `;

  const convMenu = document.createElement('div');
  convMenu.className = 'convention-dropdown-menu hud-panel';

  const conventionEntries = Object.keys(CALCULATION_CONVENTIONS) as CalculationConventionName[];
  for (const c of conventionEntries) {
    const item = document.createElement('button');
    item.className = `convention-menu-item ${c === 'UmmAlQura' ? 'active' : ''}`;
    const displayName = c.replace(/([A-Z])/g, ' $1').trim();
    item.innerHTML = `<span>${displayName}</span>`;

    item.addEventListener('click', () => {
      convMenu.querySelectorAll('.convention-menu-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      const activeSpan = convTrigger.querySelector('#active-conv-name');
      if (activeSpan) activeSpan.textContent = displayName;
      convMenu.classList.remove('active');

      globeScene.setConvention(CALCULATION_CONVENTIONS[c]);
      if (callbacks.onConventionChange) callbacks.onConventionChange(c);
    });

    convMenu.appendChild(item);
  }

  convTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    convMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!convWrapper.contains(e.target as Node)) {
      convMenu.classList.remove('active');
    }
  });

  convWrapper.appendChild(convTrigger);
  convWrapper.appendChild(convMenu);
  controlsDock.appendChild(convWrapper);

  // Follow Adhan Tour Button
  const followBtn = document.createElement('button');
  followBtn.className = 'btn-follow-tour';
  const followBtnSpan = document.createElement('span');
  followBtnSpan.textContent = t.controls.followAdhan;
  const followBtnArrow = document.createElement('span');
  followBtnArrow.setAttribute('aria-hidden', 'true');
  followBtnArrow.textContent = '➜';
  followBtn.appendChild(followBtnSpan);
  followBtn.appendChild(followBtnArrow);

  let isFollowing = false;
  followBtn.addEventListener('click', () => {
    isFollowing = !isFollowing;
    followBtn.classList.toggle('active', isFollowing);
    if (callbacks.onFollowAdhan) callbacks.onFollowAdhan();
  });
  controlsDock.appendChild(followBtn);

  // 3. Floating Astronomical Inspector Panel
  const inspector = createInspectorPanel({
    onOpen: () => {
      root.classList.add('has-inspector-open');
    },
    onClose: () => {
      root.classList.remove('has-inspector-open');
    },
  });
  root.appendChild(inspector.element);

  // 4. Bottom 24-Hour Continuity Ribbon
  const timeline = createTimelineUI(clock, (date) => {
    globeScene.setTime(date);
  });

  // Group controls dock and timeline ribbon into bottom stack
  bottomStack.appendChild(controlsDock);
  bottomStack.appendChild(timeline.element);
  root.appendChild(bottomStack);

  const unsubscribeLocale = i18n.onLocaleChange((locale, newTrans) => {
    currentLocale = locale;
    t = newTrans;

    if (brandTitleEl) brandTitleEl.textContent = t.brand.title;
    if (brandSubtitleEl) brandSubtitleEl.textContent = t.brand.subtitle;

    searchInput.placeholder = t.search.placeholder;
    searchInput.setAttribute('aria-label', t.search.placeholder);

    if (activeLangName) {
      activeLangName.textContent = SUPPORTED_LOCALES[locale]?.nativeName || 'English';
    }

    if (speedLabel) speedLabel.textContent = t.controls.time;
    if (mapBtn) mapBtn.textContent = t.controls.map;
    if (satBtn) satBtn.textContent = t.controls.satellite;

    for (const [k, lbl] of prayerLabels.entries()) {
      lbl.textContent = t.prayers[k] || k;
    }

    if (followBtnSpan) {
      followBtnSpan.textContent = t.controls.followAdhan;
    }

    langMenu.querySelectorAll('.lang-menu-item').forEach((item) => {
      const code = item.getAttribute('data-lang');
      const isCurrent = code === locale;
      item.classList.toggle('active', isCurrent);
      item.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });
  });

  const updateStats = (stats: ContinuityStats): void => {
    timeline.updateStats(stats);
  };

  const updateTime = (date: Date): void => {
    timeline.updatePlayhead(date);
    inspector.updateTime(date);

    const utcEl = root.querySelector('#live-utc-ticker');
    if (utcEl) {
      const hh = String(date.getUTCHours()).padStart(2, '0');
      const mm = String(date.getUTCMinutes()).padStart(2, '0');
      const ss = String(date.getUTCSeconds()).padStart(2, '0');
      utcEl.textContent = `${hh}:${mm}:${ss} UTC`;
    }
  };

  const setSettlements = (settlements: Settlement[]): void => {
    allSettlements = settlements;
  };

  const dispose = (): void => {
    unsubscribeLocale();
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
    setSettlements,
    dispose,
  };
}
