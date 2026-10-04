// Automated cinematic camera director for "Follow the Adhān" narrative tour

import { CameraRig } from '../globe/camera';
import { ActiveAdhanEvent } from '../globe/cities';
import { Settlement } from '../population/loader';

export interface NarrativeDirector {
  isActive: () => boolean;
  setActive: (active: boolean) => void;
  update: (activeEvents: ActiveAdhanEvent[], settlements: Settlement[]) => void;
}

export function createNarrativeDirector(cameraRig: CameraRig): NarrativeDirector {
  let active = false;
  let currentTargetIndex: number | null = null;
  let targetLat = 0;
  let targetLon = 0;

  const setActive = (flag: boolean): void => {
    active = flag;
    if (!flag) {
      currentTargetIndex = null;
    }
  };

  const isActive = (): boolean => active;

  const update = (activeEvents: ActiveAdhanEvent[], settlements: Settlement[]): void => {
    if (!active || activeEvents.length === 0) return;

    // Find the most populated active settlement to focus on
    let bestEvent = activeEvents[0];
    let maxPop = settlements[bestEvent.settlementIndex]?.population || 0;

    for (let i = 1; i < activeEvents.length; i++) {
      const s = settlements[activeEvents[i].settlementIndex];
      if (s && s.population > maxPop) {
        maxPop = s.population;
        bestEvent = activeEvents[i];
      }
    }

    const s = settlements[bestEvent.settlementIndex];
    if (s && bestEvent.settlementIndex !== currentTargetIndex) {
      currentTargetIndex = bestEvent.settlementIndex;
      targetLat = s.latitude;
      targetLon = s.longitude;
      cameraRig.focusCoordinates(targetLat, targetLon, 12);
    }
  };

  return {
    isActive,
    setActive,
    update,
  };
}
