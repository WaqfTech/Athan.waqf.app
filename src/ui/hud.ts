// Geoscape HUD layout and interactive observatory controls overlay

import { SimulationClock, PlaybackSpeed } from '../simulation/clock';
import { CalculationConventionName, CALCULATION_CONVENTIONS } from '../prayer/conventions';
import { PrayerFrontKey, PRAYER_COLORS } from '../globe/fronts';
import { GlobeScene } from '../globe/scene';
import { createTimelineUI, TimelineUI } from './timeline';
import { createInspectorPanel, InspectorPanel } from './inspector';
import { createCreditsModal, CreditsModal } from './credits';
import { ContinuityStats } from '../simulation/continuity';
import { Settlement } from '../population/loader';
import { SettlementSpatialIndex } from '../population/spatialIndex';
import { fetchVisitorLocation, VisitorLocation } from '../population/visitorGeo';
import { i18n, SUPPORTED_LOCALES, SupportedLocale } from '../i18n';

export type ViewMode = 'visual' | 'astronomy' | 'prayer' | 'adhan';

export interface HudOverlay {
  element: HTMLElement;
  timeline: TimelineUI;
  inspector: InspectorPanel;
  creditsModal: CreditsModal;
  updateStats: (stats: ContinuityStats) => void;
  updateTime: (date: Date) => void;
  setSettlements: (settlements: Settlement[]) => void;
  /** Shows the Follow Adhan caption for the current target, or hides it when prayer is null. */
  setNowPlaying: (prayer: PrayerFrontKey | null, city?: string) => void;
  onFollowAdhanToggle?: (active: boolean) => void;
  dispose: () => void;
}

// Sacred Islamic sanctuaries always available in header
interface QuickCity {
  name: string;
  nameAr: string;
  lat: number;
  lon: number;
  countryCode: string;
  timezone: string;
}

const SACRED_CITIES: QuickCity[] = [
  { name: 'Makkah', nameAr: 'مكة المكرمة', lat: 21.4225, lon: 39.8262, countryCode: 'SA', timezone: 'Asia/Riyadh' },
  { name: 'Madinah', nameAr: 'المدينة المنورة', lat: 24.4672, lon: 39.6112, countryCode: 'SA', timezone: 'Asia/Riyadh' },
  { name: 'Al-Quds', nameAr: 'القدس', lat: 31.7767, lon: 35.2345, countryCode: 'PS', timezone: 'Asia/Hebron' },
];

const DEFAULT_NEARBY_FALLBACK: QuickCity[] = [
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

  // Single source of truth for prayer colours: the 3D palette drives the CSS variables
  for (const [key, value] of Object.entries(PRAYER_COLORS)) {
    document.documentElement.style.setProperty(`--color-${key}`, `#${value.toString(16).padStart(6, '0')}`);
  }

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
  clearBtn.setAttribute('aria-label', t.controls.clearSearch);
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
      globeScene.cameraRig.focusCoordinates(city.latitude, city.longitude, 14, true);
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
    const defaultList = [...SACRED_CITIES, ...DEFAULT_NEARBY_FALLBACK];
    searchResults = defaultList.map((q) => ({
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

  // Places: one trigger opening a popover with the three sanctuaries, then cities near the visitor
  const quickStrip = document.createElement('div');
  quickStrip.className = 'quick-cities-strip places-wrapper';

  const placesTrigger = document.createElement('button');
  placesTrigger.className = 'btn-places-trigger';
  placesTrigger.setAttribute('aria-haspopup', 'true');
  placesTrigger.setAttribute('aria-expanded', 'false');
  const placesTriggerLabel = document.createElement('span');
  placesTriggerLabel.textContent = t.controls.places;
  placesTrigger.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/>
      <circle cx="12" cy="10" r="2.5"/>
    </svg>
  `;
  placesTrigger.appendChild(placesTriggerLabel);
  const placesChevron = document.createElement('span');
  placesChevron.setAttribute('aria-hidden', 'true');
  placesChevron.style.fontSize = '10px';
  placesChevron.style.opacity = '0.7';
  placesChevron.textContent = '▾';
  placesTrigger.appendChild(placesChevron);

  const placesMenu = document.createElement('div');
  placesMenu.className = 'places-dropdown hud-panel';

  placesTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = placesMenu.classList.toggle('active');
    placesTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (!quickStrip.contains(e.target as Node)) {
      placesMenu.classList.remove('active');
      placesTrigger.setAttribute('aria-expanded', 'false');
    }
  });
  quickStrip.appendChild(placesTrigger);
  quickStrip.appendChild(placesMenu);

  let spatialIndex: SettlementSpatialIndex | null = null;
  let visitorLocation: VisitorLocation | null = null;

  interface DisplayQuickCity {
    name: string;
    nameAr?: string;
    lat: number;
    lon: number;
    countryCode?: string;
    timezone?: string;
    isNearby?: boolean;
    population?: number;
  }

  const appendPlaceRow = (c: DisplayQuickCity, sacred: boolean): void => {
    const row = document.createElement('button');
    row.className = `places-item${sacred ? ' is-sacred' : ''}${c.isNearby ? ' is-nearby' : ''}`;
    const name = document.createElement('span');
    name.className = 'places-item-name';
    name.textContent = c.name;
    row.appendChild(name);

    if (c.nameAr) {
      const ar = document.createElement('span');
      ar.className = 'places-item-ar';
      ar.setAttribute('dir', 'rtl');
      ar.setAttribute('lang', 'ar');
      ar.textContent = c.nameAr;
      row.appendChild(ar);
    }

    row.addEventListener('click', () => {
      placesMenu.classList.remove('active');
      placesTrigger.setAttribute('aria-expanded', 'false');
      selectCity({
        name: c.name,
        nameAr: c.nameAr || c.name,
        latitude: c.lat,
        longitude: c.lon,
        countryCode: c.countryCode || '',
        population: c.population || 100000,
        timezone: c.timezone || 'UTC',
      });
    });
    placesMenu.appendChild(row);
  };

  const renderQuickStrip = (nearbyCities: DisplayQuickCity[]): void => {
    placesMenu.innerHTML = '';

    for (const q of SACRED_CITIES) {
      appendPlaceRow({ ...q, population: 1500000 }, true);
    }

    if (nearbyCities.length > 0) {
      const divider = document.createElement('span');
      divider.className = 'places-divider';
      divider.setAttribute('aria-hidden', 'true');
      placesMenu.appendChild(divider);

      for (const c of nearbyCities) {
        appendPlaceRow(c, false);
      }
    }
  };

  const updateNearbyCities = (): void => {
    if (!spatialIndex || !visitorLocation) return;

    // Intelligent nearby selection:
    // - Pins visitor city first
    // - Eliminates suburb crowding via 40km cluster separation
    // - Caps home country to 2 distinct major cities
    // - Diversifies surrounding countries across geographic distance
    // - Excludes duplicates of the 3 sacred sanctuaries
    const intelligentNearby = spatialIndex.findIntelligentNearby({
      latitude: visitorLocation.latitude,
      longitude: visitorLocation.longitude,
      visitorCountryCode: visitorLocation.country,
      visitorCity: visitorLocation.city,
      targetCount: 10,
      maxHomeCountry: 2,
      maxOtherCountry: 1,
      minClusterDistanceKm: 40,
      excludeCoordinates: SACRED_CITIES.map((s) => ({ lat: s.lat, lon: s.lon, radiusKm: 30 })),
    });

    const list: DisplayQuickCity[] = intelligentNearby.map((n) => ({
      name: n.settlement.name,
      nameAr: n.settlement.nameAr,
      lat: n.settlement.latitude,
      lon: n.settlement.longitude,
      countryCode: n.settlement.countryCode,
      timezone: n.settlement.timezone,
      isNearby: true,
      population: n.settlement.population,
    }));

    renderQuickStrip(list);
  };

  // Initial render with default regional fallback
  renderQuickStrip(DEFAULT_NEARBY_FALLBACK.map((c) => ({ ...c, isNearby: false })));

  // Query Cloudflare edge geolocation asynchronously
  fetchVisitorLocation()
    .then((loc) => {
      if (loc) {
        visitorLocation = loc;
        updateNearbyCities();
      }
    })
    .catch(() => {
      // Non-blocking fallback
    });

  topBar.appendChild(quickStrip);

  // Language Switcher Dropdown
  const langWrapper = document.createElement('div');
  langWrapper.className = 'lang-menu-wrapper';

  const langTrigger = document.createElement('button');
  langTrigger.className = 'btn-lang-trigger';
  langTrigger.setAttribute('aria-label', t.controls.language);
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

  // Native full screen button (hidden where the Fullscreen API is unavailable, e.g. iPhone Safari)
  const fsEnterIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 9 4 4 9 4"/>
      <polyline points="20 9 20 4 15 4"/>
      <polyline points="4 15 4 20 9 20"/>
      <polyline points="20 15 20 20 15 20"/>
    </svg>
  `;
  const fsExitIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 4 9 9 4 9"/>
      <polyline points="15 4 15 9 20 9"/>
      <polyline points="9 20 9 15 4 15"/>
      <polyline points="15 20 15 15 20 15"/>
    </svg>
  `;
  const fsBtn = document.createElement('button');
  fsBtn.className = 'btn-icon-toggle';
  fsBtn.setAttribute('aria-label', t.controls.fullscreen);
  fsBtn.title = `${t.controls.fullscreen} (F)`;
  fsBtn.innerHTML = fsEnterIcon;

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Browser refused (no user gesture or policy); nothing to recover.
      });
    }
  };
  const onFullscreenChange = (): void => {
    const on = Boolean(document.fullscreenElement);
    fsBtn.innerHTML = on ? fsExitIcon : fsEnterIcon;
    fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  if (document.fullscreenEnabled) {
    fsBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    topBar.appendChild(fsBtn);
  }

  // Share: native share sheet where available, otherwise copy the link
  const toast = document.createElement('div');
  toast.className = 'hud-toast hud-panel';
  toast.setAttribute('role', 'status');
  let toastTimer: number | undefined;
  const showToast = (text: string): void => {
    toast.textContent = text;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
  };

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-icon-toggle';
  shareBtn.setAttribute('aria-label', t.controls.share);
  shareBtn.title = t.controls.share;
  shareBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>
    </svg>
  `;
  shareBtn.addEventListener('click', () => {
    const url = new URL(window.location.href);
    // A live view should stay live for whoever opens the link
    if (clock.isLive()) url.searchParams.delete('t');
    const shareTitle = t.brand.title;
    const shareText = t.controls.shareMessage;
    const fullText = `${shareText}\n${url.toString()}`;

    if (typeof navigator.share === 'function') {
      navigator.share({
        title: shareTitle,
        text: shareText,
        url: url.toString(),
      }).catch(() => {
        // User dismissed the share sheet; nothing to do.
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).then(
        () => showToast(t.controls.linkCopied),
        () => {
          // Clipboard blocked by the browser; leave the URL bar as the fallback.
        },
      );
    }
  });
  if (typeof navigator.share === 'function' || navigator.clipboard) {
    topBar.appendChild(shareBtn);
  }

  // Focus mode: hides every HUD element, leaving only a small restore button that fades when idle
  const focusBtn = document.createElement('button');
  focusBtn.className = 'btn-icon-toggle';
  focusBtn.setAttribute('aria-label', t.controls.zenMode);
  focusBtn.title = `${t.controls.zenMode} (H)`;
  focusBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <line x1="3" y1="21" x2="21" y2="3"/>
    </svg>
  `;
  const creditsModal = createCreditsModal({});

  const creditsBtn = document.createElement('button');
  creditsBtn.className = 'btn-icon-toggle btn-credits-trigger';
  creditsBtn.setAttribute('aria-label', t.controls.credits);
  creditsBtn.title = `${t.controls.credits} (C)`;
  creditsBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  `;
  creditsBtn.addEventListener('click', () => creditsModal.toggle());
  topBar.appendChild(creditsBtn);

  const helpBtn = document.createElement('button');
  helpBtn.className = 'btn-icon-toggle btn-help';
  helpBtn.setAttribute('aria-label', t.controls.shortcuts);
  helpBtn.setAttribute('aria-expanded', 'false');
  helpBtn.title = `${t.controls.shortcuts} (?)`;
  helpBtn.textContent = '?';
  topBar.appendChild(helpBtn);
  topBar.appendChild(focusBtn);

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn-icon-toggle focus-restore';
  restoreBtn.setAttribute('aria-label', t.controls.zenMode);
  restoreBtn.title = `${t.controls.zenMode} (H)`;
  restoreBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;

  let isFocusMode = false;
  let restoreFadeTimer: number | undefined;
  const wakeRestoreBtn = (): void => {
    restoreBtn.classList.remove('is-idle');
    window.clearTimeout(restoreFadeTimer);
    restoreFadeTimer = window.setTimeout(() => restoreBtn.classList.add('is-idle'), 3000);
  };
  const setFocusMode = (on: boolean): void => {
    isFocusMode = on;
    root.classList.toggle('is-focus-mode', on);
    if (on) {
      searchDropdown.classList.remove('active');
      placesMenu.classList.remove('active');
      wakeRestoreBtn();
    } else {
      window.clearTimeout(restoreFadeTimer);
    }
  };
  focusBtn.addEventListener('click', () => setFocusMode(true));
  restoreBtn.addEventListener('click', () => setFocusMode(false));
  const onPointerActivity = (): void => {
    if (isFocusMode) wakeRestoreBtn();
  };
  document.addEventListener('pointermove', onPointerActivity);

  const onHotkey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (key === 'h') {
      setFocusMode(!isFocusMode);
    } else if (key === 'f' && document.fullscreenEnabled) {
      toggleFullscreen();
    } else if (key === '/') {
      e.preventDefault();
      searchInput.focus();
    } else if (key === 'c') {
      creditsModal.toggle();
    } else if (key === '?') {
      setShortcutsOpen(!shortcutsPanel.classList.contains('active'));
    } else if (key === 'escape') {
      if (creditsModal.isOpen()) creditsModal.close();
      else if (shortcutsPanel.classList.contains('active')) setShortcutsOpen(false);
      else if (isFocusMode) setFocusMode(false);
    }
  };
  document.addEventListener('keydown', onHotkey);

  root.appendChild(topBar);
  root.appendChild(restoreBtn);
  root.appendChild(creditsModal.element);

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
  speedSegment.setAttribute('role', 'group');
  speedSegment.setAttribute('aria-label', t.controls.time);

  for (const s of speeds) {
    const btn = document.createElement('button');
    btn.className = `btn-dock-pill ${s.isLive ? 'active' : ''}`;
    btn.textContent = s.label;
    btn.dataset.speedKey = s.isLive ? 'live' : String(s.speed);
    btn.setAttribute('aria-pressed', s.isLive ? 'true' : 'false');
    if (s.speed === 0) btn.setAttribute('aria-label', t.controls.pause);
    btn.addEventListener('click', () => {
      if (s.isLive) {
        clock.setLive(true);
      } else {
        clock.setSpeed(s.speed);
        clock.setLive(false);
      }
    });
    speedSegment.appendChild(btn);
    speedButtons.push(btn);
  }
  controlsDock.appendChild(speedSegment);

  // Keep the speed buttons truthful when time changes elsewhere (timeline scrub, Follow Adhan, URL time)
  let lastSpeedKey = '';
  const unsubscribeClock = clock.subscribe((_date, speed, isLive) => {
    const key = isLive ? 'live' : String(speed);
    if (key === lastSpeedKey) return;
    lastSpeedKey = key;
    for (const b of speedButtons) {
      const on = b.dataset.speedKey === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  });

  // Map layer style segment
  const mapSegment = document.createElement('div');
  mapSegment.className = 'dock-segment';

  const mapBtn = document.createElement('button');
  mapBtn.className = `btn-dock-pill ${globeScene.getMapStyle() === 'roadmap' ? 'active' : ''}`;
  mapBtn.textContent = t.controls.map;

  const satBtn = document.createElement('button');
  satBtn.className = `btn-dock-pill ${globeScene.getMapStyle() === 'satellite' ? 'active' : ''}`;
  satBtn.textContent = t.controls.satellite;

  mapBtn.setAttribute('aria-pressed', globeScene.getMapStyle() === 'roadmap' ? 'true' : 'false');
  satBtn.setAttribute('aria-pressed', globeScene.getMapStyle() === 'satellite' ? 'true' : 'false');

  mapBtn.addEventListener('click', () => {
    mapBtn.classList.add('active');
    satBtn.classList.remove('active');
    mapBtn.setAttribute('aria-pressed', 'true');
    satBtn.setAttribute('aria-pressed', 'false');
    globeScene.setMapStyle('roadmap');
    if (callbacks.onStyleChange) callbacks.onStyleChange('roadmap');
  });

  satBtn.addEventListener('click', () => {
    satBtn.classList.add('active');
    mapBtn.classList.remove('active');
    satBtn.setAttribute('aria-pressed', 'true');
    mapBtn.setAttribute('aria-pressed', 'false');
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
  const prayerKeys: PrayerFrontKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'terminator'];
  for (const k of prayerKeys) {
    const hexColor = `#${PRAYER_COLORS[k].toString(16).padStart(6, '0')}`;
    const btn = document.createElement('button');
    btn.className = 'btn-prayer-pill active';
    btn.setAttribute('data-prayer', k);
    btn.setAttribute('aria-label', t.prayers[k] || k);
    btn.setAttribute('aria-pressed', 'true');
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
      btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      globeScene.prayerFronts.setVisibility(k, visible);
    });
    prayerSegment.appendChild(btn);
  }
  // Layers: prayer line toggles, convention and legend live in a popover above the dock
  const layersPanel = document.createElement('div');
  layersPanel.className = 'layers-panel hud-panel';

  const layersTrigger = document.createElement('button');
  layersTrigger.className = 'btn-layers-trigger';
  layersTrigger.setAttribute('aria-haspopup', 'true');
  layersTrigger.setAttribute('aria-expanded', 'false');
  const layersTriggerLabel = document.createElement('span');
  layersTriggerLabel.textContent = t.controls.layers;
  const layersDots = document.createElement('span');
  layersDots.className = 'layers-dots';
  layersDots.setAttribute('aria-hidden', 'true');
  for (const k of prayerKeys) {
    const d = document.createElement('i');
    d.style.setProperty('--prayer-color', `#${PRAYER_COLORS[k].toString(16).padStart(6, '0')}`);
    layersDots.appendChild(d);
  }
  layersTrigger.appendChild(layersDots);
  layersTrigger.appendChild(layersTriggerLabel);

  const setLayersOpen = (open: boolean): void => {
    layersPanel.classList.toggle('active', open);
    layersTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  layersTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setLayersOpen(!layersPanel.classList.contains('active'));
  });
  const onLayersOutsideClick = (e: MouseEvent): void => {
    const target = e.target as Node;
    if (!layersPanel.contains(target) && !layersTrigger.contains(target)) setLayersOpen(false);
  };
  const onLayersEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setLayersOpen(false);
  };
  document.addEventListener('click', onLayersOutsideClick);
  document.addEventListener('keydown', onLayersEscape);

  layersPanel.appendChild(prayerSegment);
  controlsDock.appendChild(layersTrigger);

  // Custom Convention Selector Dropdown
  const convWrapper = document.createElement('div');
  convWrapper.className = 'convention-menu-wrapper';

  const convTrigger = document.createElement('button');
  convTrigger.className = 'btn-convention-trigger';
  convTrigger.setAttribute('aria-label', t.controls.convention);
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
  layersPanel.appendChild(convWrapper);

  const legend = document.createElement('ul');
  legend.className = 'layers-legend';
  const legendLines = document.createElement('li');
  const legendRings = document.createElement('li');
  const legendArcs = document.createElement('li');
  legendLines.textContent = t.controls.legendLines;
  legendRings.textContent = t.controls.legendRings;
  legendArcs.textContent = t.controls.legendArcs;
  legend.appendChild(legendLines);
  legend.appendChild(legendRings);
  legend.appendChild(legendArcs);
  layersPanel.appendChild(legend);

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
      // Slide the globe clear of the panel: sideways on desktop, upward above the bottom sheet on phones
      if (window.innerWidth > 640) {
        const dir = document.documentElement.dir === 'rtl' ? -1 : 1;
        globeScene.cameraRig.setViewShift(dir * 150, 0);
      } else {
        globeScene.cameraRig.setViewShift(0, -window.innerHeight * 0.25);
      }
      globeScene.cameraRig.setAutoRotateAllowed(false);
    },
    onClose: () => {
      root.classList.remove('has-inspector-open');
      globeScene.cameraRig.setViewShift(0, 0);
      globeScene.cameraRig.setAutoRotateAllowed(true);
      globeScene.qiblaArcs.clearInspectedCity();
    },
  });
  root.appendChild(inspector.element);

  // 4. Bottom 24-Hour Continuity Ribbon
  const timeline = createTimelineUI(clock, (date) => {
    globeScene.setTime(date);
  });

  // Group controls dock and timeline ribbon into bottom stack
  bottomStack.appendChild(layersPanel);
  bottomStack.appendChild(controlsDock);
  bottomStack.appendChild(timeline.element);
  root.appendChild(bottomStack);

  root.appendChild(toast);

  // Follow Adhan caption: what the tour is looking at right now
  const nowPlayingEl = document.createElement('div');
  nowPlayingEl.className = 'now-playing hud-panel';
  nowPlayingEl.setAttribute('role', 'status');
  let nowPlaying: { prayer: PrayerFrontKey; city: string } | null = null;
  const renderNowPlaying = (): void => {
    nowPlayingEl.innerHTML = '';
    if (!nowPlaying) {
      nowPlayingEl.classList.remove('active');
      return;
    }
    const dot = document.createElement('span');
    dot.className = 'prayer-indicator-dot';
    dot.style.setProperty('--prayer-color', `#${PRAYER_COLORS[nowPlaying.prayer].toString(16).padStart(6, '0')}`);
    const text = document.createElement('span');
    text.textContent = `${t.prayers[nowPlaying.prayer] || nowPlaying.prayer} · ${nowPlaying.city}`;
    nowPlayingEl.appendChild(dot);
    nowPlayingEl.appendChild(text);
    nowPlayingEl.classList.add('active');
  };
  const setNowPlaying = (prayer: PrayerFrontKey | null, city = ''): void => {
    nowPlaying = prayer ? { prayer, city } : null;
    renderNowPlaying();
  };
  bottomStack.insertBefore(nowPlayingEl, bottomStack.firstChild);

  // Keyboard shortcuts panel
  const shortcutsPanel = document.createElement('div');
  shortcutsPanel.className = 'shortcuts-panel hud-panel';
  shortcutsPanel.setAttribute('role', 'dialog');
  shortcutsPanel.setAttribute('aria-label', t.controls.shortcuts);
  const shortcutsTitle = document.createElement('div');
  shortcutsTitle.className = 'shortcuts-title';
  shortcutsTitle.textContent = t.controls.shortcuts;
  shortcutsPanel.appendChild(shortcutsTitle);
  const shortcutRows: { key: string; label: () => string; el: HTMLElement }[] = [];
  const shortcutDefs: { key: string; label: () => string }[] = [
    { key: 'H', label: () => t.controls.zenMode },
    { key: 'F', label: () => t.controls.fullscreen },
    { key: '/', label: () => t.controls.search },
    { key: 'C', label: () => t.controls.credits },
    { key: '?', label: () => t.controls.shortcuts },
  ];
  for (const def of shortcutDefs) {
    const row = document.createElement('div');
    row.className = 'shortcut-row';
    const kbd = document.createElement('kbd');
    kbd.textContent = def.key;
    const desc = document.createElement('span');
    desc.textContent = def.label();
    row.appendChild(kbd);
    row.appendChild(desc);
    shortcutsPanel.appendChild(row);
    shortcutRows.push({ ...def, el: desc });
  }
  const setShortcutsOpen = (open: boolean): void => {
    shortcutsPanel.classList.toggle('active', open);
    helpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  root.appendChild(shortcutsPanel);
  const onShortcutsOutsideClick = (e: MouseEvent): void => {
    const target = e.target as Node;
    if (!shortcutsPanel.contains(target) && !helpBtn.contains(target)) setShortcutsOpen(false);
  };
  document.addEventListener('click', onShortcutsOutsideClick);
  helpBtn.addEventListener('click', () => setShortcutsOpen(!shortcutsPanel.classList.contains('active')));

  // First-visit hint: shown once, fades on its own or on first interaction
  const HINT_KEY = 'adhan-earth-hint-seen';
  let hintSeen = false;
  try {
    hintSeen = window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    hintSeen = true; // storage blocked: skip the hint rather than show it every visit
  }
  const hintEl = document.createElement('div');
  hintEl.className = 'first-visit-hint hud-panel';
  hintEl.setAttribute('role', 'status');
  hintEl.textContent = t.controls.hint;
  let hintTimer: number | undefined;
  const dismissHint = (): void => {
    window.clearTimeout(hintTimer);
    hintEl.classList.remove('visible');
    document.removeEventListener('pointerdown', dismissHint);
  };
  if (!hintSeen) {
    root.appendChild(hintEl);
    requestAnimationFrame(() => hintEl.classList.add('visible'));
    hintTimer = window.setTimeout(dismissHint, 9000);
    document.addEventListener('pointerdown', dismissHint);
    try {
      window.localStorage.setItem(HINT_KEY, '1');
    } catch {
      // ignore: hint just shows again next visit
    }
  }

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
    placesTriggerLabel.textContent = t.controls.places;
    layersTriggerLabel.textContent = t.controls.layers;
    clearBtn.setAttribute('aria-label', t.controls.clearSearch);
    speedSegment.setAttribute('aria-label', t.controls.time);
    speedButtons.find((b) => b.dataset.speedKey === '0')?.setAttribute('aria-label', t.controls.pause);
    langTrigger.setAttribute('aria-label', t.controls.language);
    convTrigger.setAttribute('aria-label', t.controls.convention);
    shareBtn.setAttribute('aria-label', t.controls.share);
    shareBtn.title = t.controls.share;
    creditsBtn.setAttribute('aria-label', t.controls.credits);
    creditsBtn.title = `${t.controls.credits} (C)`;
    creditsModal.updateTranslations(t);
    helpBtn.setAttribute('aria-label', t.controls.shortcuts);
    helpBtn.title = `${t.controls.shortcuts} (?)`;
    shortcutsPanel.setAttribute('aria-label', t.controls.shortcuts);
    shortcutsTitle.textContent = t.controls.shortcuts;
    for (const row of shortcutRows) row.el.textContent = row.label();
    renderNowPlaying();
    legendLines.textContent = t.controls.legendLines;
    legendRings.textContent = t.controls.legendRings;
    legendArcs.textContent = t.controls.legendArcs;
    hintEl.textContent = t.controls.hint;
    fsBtn.setAttribute('aria-label', t.controls.fullscreen);
    fsBtn.title = `${t.controls.fullscreen} (F)`;
    focusBtn.setAttribute('aria-label', t.controls.zenMode);
    focusBtn.title = `${t.controls.zenMode} (H)`;
    restoreBtn.setAttribute('aria-label', t.controls.zenMode);
    restoreBtn.title = `${t.controls.zenMode} (H)`;
    if (mapBtn) mapBtn.textContent = t.controls.map;
    if (satBtn) satBtn.textContent = t.controls.satellite;

    for (const [k, lbl] of prayerLabels.entries()) {
      lbl.textContent = t.prayers[k] || k;
      lbl.parentElement?.setAttribute('aria-label', t.prayers[k] || k);
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
    spatialIndex = new SettlementSpatialIndex(settlements);
    updateNearbyCities();
  };

  const dispose = (): void => {
    unsubscribeLocale();
    unsubscribeClock();
    creditsModal.dispose();
    document.removeEventListener('keydown', onHotkey);
    document.removeEventListener('click', onShortcutsOutsideClick);
    window.clearTimeout(toastTimer);
    document.removeEventListener('click', onLayersOutsideClick);
    document.removeEventListener('keydown', onLayersEscape);
    dismissHint();
    document.removeEventListener('pointermove', onPointerActivity);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.clearTimeout(restoreFadeTimer);
    timeline.dispose();
    inspector.dispose();
    root.innerHTML = '';
  };

  return {
    element: root,
    timeline,
    inspector,
    creditsModal,
    updateStats,
    updateTime,
    setSettlements,
    setNowPlaying,
    dispose,
  };
}
