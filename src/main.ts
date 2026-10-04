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
import { CALCULATION_CONVENTIONS, CalculationConventionName } from './prayer/conventions';
import { i18n } from './i18n';

export interface AppInstance {
  initialized: boolean;
  clock?: SimulationClock;
  scene?: GlobeScene;
  hud?: HudOverlay;
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
  const initialStyle = urlState.style || 'satellite';

  const clock = new SimulationClock(initialTime);

  let eventEngine: AdhanEventEngine | null = null;
  let settlementsList: Settlement[] = [];
  let isNarrativeActive = false;

  const globeScene = createGlobeScene(canvas, {
    initialStyle,
    onSelectSettlement: (settlement) => {
      hud.inspector.inspectSettlement(settlement, clock.getTime());
      updateUrlState({
        lat: settlement.latitude,
        lon: settlement.longitude,
        time: clock.getTime(),
      });
    },
    onSelectCoordinates: (lat, lon) => {
      hud.inspector.inspectCoordinates(lat, lon, clock.getTime());
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
    onConventionChange: (convName) => {
      if (eventEngine) {
        eventEngine.setConvention(convName);
        const stats = computeGlobalAdhanContinuity(settlementsList, clock.getTime(), {
          convention: convName,
        });
        hud.updateStats(stats);
      }
      updateUrlState({ convention: convName });
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
      updateUrlState({
        lat: settlement.latitude,
        lon: settlement.longitude,
        time: clock.getTime(),
      });
    },
    onStyleChange: (style) => {
      updateUrlState({ style });
    },
  });

  i18n.onLocaleChange((locale) => {
    updateUrlState({ lang: locale });
  });

  globeScene.setConvention(CALCULATION_CONVENTIONS[initialConvention]);
  globeScene.setTime(initialTime);

  // Load settlements dataset asynchronously
  loadSettlements()
    .then((settlements) => {
      settlementsList = settlements;
      globeScene.setSettlements(settlements);
      hud.setSettlements(settlements);

      eventEngine = new AdhanEventEngine(settlements, {
        convention: initialConvention,
        adhanDurationMinutes: 4,
      });

      // Calculate initial 24h continuity metrics
      const stats = computeGlobalAdhanContinuity(settlements, clock.getTime(), {
        convention: initialConvention,
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
  };

  return {
    initialized: true,
    clock,
    scene: globeScene,
    hud,
    narrativeDirector,
    dispose,
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
}
