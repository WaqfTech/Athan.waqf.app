// Main Application Orchestrator for Adhan Earth 3D Observatory

import { SimulationClock } from './simulation/clock';
import { createGlobeScene, GlobeScene } from './globe/scene';
import { createHudOverlay, HudOverlay } from './ui/hud';
import { loadSettlements, Settlement } from './population/loader';
import { AdhanEventEngine } from './simulation/eventEngine';
import { computeGlobalAdhanContinuity } from './simulation/continuity';
import { createNarrativeDirector, NarrativeDirector } from './simulation/narrative';
import type { PrayerFrontKey } from './globe/fronts';
import { parseUrlState, updateUrlState } from './ui/urlState';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  Madhab,
  HighLatitudeRule,
} from './prayer/conventions';
import { createAppStore, AppStore } from './ui/state';
import { i18n, detectLocale } from './i18n';

export interface AppInstance {
  initialized: boolean;
  clock?: SimulationClock;
  scene?: GlobeScene;
  hud?: HudOverlay;
  store?: AppStore;
  narrativeDirector?: NarrativeDirector;
  dispose?: () => void;
}

export function initializeApp(): AppInstance {
  if (typeof document === 'undefined') {
    return { initialized: false };
  }

  const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.warn('Canvas element #globe-canvas not found.');
    return { initialized: false };
  }

  // Parse initial state from URL query parameters
  const urlState = parseUrlState();
  const initialTime = urlState.time || new Date();
  const initialConvention = (urlState.convention as CalculationConventionName) || 'UmmAlQura';
  const initialMadhab: Madhab = urlState.madhab || 'Shafi';
  const initialRule: HighLatitudeRule =
    urlState.highLatitudeRule || urlState.rule || 'MiddleOfTheNight';
  const initialStyle = urlState.style || 'satellite';

  // Central reactive state store
  const store = createAppStore(
    {
      convention: initialConvention,
      madhab: initialMadhab,
      highLatitudeRule: initialRule,
      mapStyle: initialStyle,
      adhanDurationMinutes: 4,
    },
    initialTime,
  );

  const clock = new SimulationClock(initialTime);

  let eventEngine: AdhanEventEngine | null = null;
  let settlementsList: Settlement[] = [];
  let isNarrativeActive = false;
  let lastDateDayString = initialTime.toISOString().slice(0, 10);

  const recomputeStatsForDate = (date: Date): void => {
    if (settlementsList.length > 0) {
      const cfg = store.getConfig();
      const stats = computeGlobalAdhanContinuity(settlementsList, date, {
        convention: cfg.convention,
        madhab: cfg.madhab,
        highLatitudeRule: cfg.highLatitudeRule,
      });
      hud.updateStats(stats);
    }
  };

  const globeScene = createGlobeScene(canvas, {
    initialStyle,
    onSelectSettlement: (settlement) => {
      hud.inspector.inspectSettlement(settlement, clock.getTime());
      store.setLocation({
        type: 'settlement',
        settlement,
        latitude: settlement.latitude,
        longitude: settlement.longitude,
        nameEn: settlement.name,
        nameAr: settlement.nameAr,
        countryCode: settlement.countryCode,
        timezone: settlement.timezone,
      });
      updateUrlState({
        lat: settlement.latitude,
        lon: settlement.longitude,
        time: clock.getTime(),
      });
    },
    onSelectCoordinates: (lat, lon) => {
      hud.inspector.inspectCoordinates(lat, lon, clock.getTime());
      store.setLocation({
        type: 'coordinates',
        latitude: lat,
        longitude: lon,
        nameEn: `Lat ${lat.toFixed(2)}°, Lon ${lon.toFixed(2)}°`,
      });
      updateUrlState({
        lat,
        lon,
        time: clock.getTime(),
      });
    },
  });

  if (urlState.lat !== undefined && urlState.lon !== undefined) {
    globeScene.cameraRig.focusCoordinates(urlState.lat, urlState.lon, 12);
  }

  const narrativeDirector = createNarrativeDirector(globeScene.cameraRig, (settlement, prayer) => {
    hud.setNowPlaying(prayer as PrayerFrontKey, settlement.name);
  });

  const hud = createHudOverlay(clock, globeScene, {
    store,
    onConventionChange: (convName) => {
      store.updateConfig({ convention: convName });
    },
    onMadhabChange: (madhab) => {
      store.updateConfig({ madhab });
    },
    onHighLatitudeRuleChange: (rule) => {
      store.updateConfig({ highLatitudeRule: rule });
    },
    onDayBoundary: (date) => {
      recomputeStatsForDate(date);
    },
    onFollowAdhan: () => {
      isNarrativeActive = !isNarrativeActive;
      narrativeDirector.setActive(isNarrativeActive);
      if (!isNarrativeActive) hud.setNowPlaying(null);
    },
    onSelectCity: (settlement) => {
      globeScene.cameraRig.focusCoordinates(settlement.latitude, settlement.longitude, 14, true);
      hud.inspector.inspectSettlement(settlement, clock.getTime());
      globeScene.qiblaArcs.setInspectedCity(settlement.latitude, settlement.longitude);
      store.setLocation({
        type: 'settlement',
        settlement,
        latitude: settlement.latitude,
        longitude: settlement.longitude,
        nameEn: settlement.name,
        nameAr: settlement.nameAr,
        countryCode: settlement.countryCode,
        timezone: settlement.timezone,
      });
      updateUrlState({
        lat: settlement.latitude,
        lon: settlement.longitude,
        time: clock.getTime(),
      });
    },
    onStyleChange: (style) => {
      store.updateConfig({ mapStyle: style });
    },
  });

  let lastPrayerConfig = {
    convention: store.getConfig().convention,
    madhab: store.getConfig().madhab,
    highLatitudeRule: store.getConfig().highLatitudeRule,
  };

  // Store configuration changes propagate immediately to all components
  store.subscribeConfig((cfg) => {
    const prayerConfigChanged =
      cfg.convention !== lastPrayerConfig.convention ||
      cfg.madhab !== lastPrayerConfig.madhab ||
      cfg.highLatitudeRule !== lastPrayerConfig.highLatitudeRule;

    if (prayerConfigChanged) {
      lastPrayerConfig = {
        convention: cfg.convention,
        madhab: cfg.madhab,
        highLatitudeRule: cfg.highLatitudeRule,
      };
      if (eventEngine) {
        eventEngine.setConvention(cfg.convention);
        eventEngine.setMadhab(cfg.madhab);
        eventEngine.setHighLatitudeRule(cfg.highLatitudeRule);
        recomputeStatsForDate(clock.getTime());
      }
      globeScene.setConvention(CALCULATION_CONVENTIONS[cfg.convention]);
      globeScene.setMadhab(cfg.madhab);
    }

    if (cfg.mapStyle !== globeScene.getMapStyle()) {
      globeScene.setMapStyle(cfg.mapStyle);
    }

    updateUrlState({
      convention: cfg.convention,
      madhab: cfg.madhab,
      highLatitudeRule: cfg.highLatitudeRule,
      style: cfg.mapStyle,
    });
  });

  i18n.onLocaleChange((locale) => {
    updateUrlState({ lang: locale });
  });

  const handlePopstate = (): void => {
    const loc = detectLocale();
    if (loc !== i18n.getLocale()) {
      i18n.setLocale(loc);
    }
  };

  if (typeof window !== 'undefined') {
    const currentLoc = i18n.getLocale();
    const isCredits = window.location.pathname === '/credits' || window.location.pathname.endsWith('/credits');
    const expectedPath = currentLoc === 'en'
      ? (isCredits ? '/credits' : '/')
      : (isCredits ? `/${currentLoc}/credits` : `/${currentLoc}`);
    const params = new URLSearchParams(window.location.search);
    if (
      params.has('lang') ||
      (window.location.pathname !== expectedPath &&
        (currentLoc !== 'en' || window.location.pathname === '/en'))
    ) {
      updateUrlState({ lang: currentLoc });
    }

    if (isCredits) {
      hud.creditsModal.open();
    }

    window.addEventListener('popstate', handlePopstate);
  }

  globeScene.setConvention(CALCULATION_CONVENTIONS[initialConvention]);
  globeScene.setMadhab(initialMadhab);
  globeScene.setTime(initialTime);

  // Load settlements dataset asynchronously
  loadSettlements()
    .then((settlements) => {
      settlementsList = settlements;
      globeScene.setSettlements(settlements);
      hud.setSettlements(settlements);

      const cfg = store.getConfig();
      eventEngine = new AdhanEventEngine(settlements, {
        convention: cfg.convention,
        madhab: cfg.madhab,
        highLatitudeRule: cfg.highLatitudeRule,
        adhanDurationMinutes: cfg.adhanDurationMinutes,
        maxCacheSize: 60000,
      });

      // Calculate initial 24h continuity metrics
      const stats = computeGlobalAdhanContinuity(settlements, clock.getTime(), {
        convention: cfg.convention,
        madhab: cfg.madhab,
        highLatitudeRule: cfg.highLatitudeRule,
      });
      hud.updateStats(stats);
    })
    .catch((err) => {
      console.error('Failed to load settlements:', err);
    });

  globeScene.start();

  // Simulation tick loop
  let lastTickTime = performance.now();
  let animationId: number;

  const tick = (): void => {
    const now = performance.now();
    const deltaSeconds = Math.min(0.1, (now - lastTickTime) / 1000);
    lastTickTime = now;

    const currentTime = clock.tick(deltaSeconds);
    globeScene.setTime(currentTime);
    hud.updateTime(currentTime);

    // Date boundary detection during simulation playback
    const curDayString = currentTime.toISOString().slice(0, 10);
    if (curDayString !== lastDateDayString) {
      lastDateDayString = curDayString;
      recomputeStatsForDate(currentTime);
    }

    if (eventEngine && settlementsList.length > 0) {
      const activeEvents = eventEngine.getActiveEvents(currentTime);
      globeScene.updateActiveEvents(activeEvents);

      if (isNarrativeActive) {
        narrativeDirector.update(activeEvents, settlementsList);
      }
    }

    animationId = requestAnimationFrame(tick);
  };

  animationId = requestAnimationFrame(tick);

  const dispose = (): void => {
    cancelAnimationFrame(animationId);
    globeScene.dispose();
    hud.dispose();
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', handlePopstate);
    }
  };

  return {
    initialized: true,
    clock,
    scene: globeScene,
    hud,
    store,
    narrativeDirector,
    dispose,
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
}
