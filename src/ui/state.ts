// Reactive application state store and unified configuration manager

import {
  CalculationConventionName,
  CALCULATION_CONVENTIONS,
  Madhab,
  HighLatitudeRule,
} from '../prayer/conventions';
import { Settlement } from '../population/loader';

export interface AppConfig {
  convention: CalculationConventionName;
  madhab: Madhab;
  highLatitudeRule: HighLatitudeRule;
  adhanDurationMinutes: number;
  mapStyle: 'roadmap' | 'satellite';
}

export interface SelectedLocation {
  type: 'settlement' | 'coordinates';
  settlement?: Settlement;
  latitude: number;
  longitude: number;
  nameEn: string;
  nameAr?: string;
  countryCode?: string;
  timezone?: string;
}

export interface AppState {
  config: AppConfig;
  revision: number;
  currentDate: Date;
  selectedLocation: SelectedLocation | null;
}

export type StateListener = (state: Readonly<AppState>, previousState: Readonly<AppState>) => void;
export type ConfigListener = (config: Readonly<AppConfig>, revision: number) => void;

const VALID_CONVENTIONS = new Set(Object.keys(CALCULATION_CONVENTIONS));
const VALID_MADHABS = new Set<Madhab>(['Shafi', 'Hanafi']);
const VALID_RULES = new Set<HighLatitudeRule>([
  'MiddleOfTheNight',
  'SeventhOfTheNight',
  'AngleBased',
]);

export class AppStore {
  private state: AppState;
  private listeners: Set<StateListener> = new Set();
  private configListeners: Set<ConfigListener> = new Set();

  constructor(initialConfig?: Partial<AppConfig>, initialDate = new Date()) {
    const convention =
      initialConfig?.convention && VALID_CONVENTIONS.has(initialConfig.convention)
        ? initialConfig.convention
        : 'UmmAlQura';
    const madhab =
      initialConfig?.madhab && VALID_MADHABS.has(initialConfig.madhab)
        ? initialConfig.madhab
        : 'Shafi';
    const highLatitudeRule =
      initialConfig?.highLatitudeRule && VALID_RULES.has(initialConfig.highLatitudeRule)
        ? initialConfig.highLatitudeRule
        : 'MiddleOfTheNight';
    const adhanDurationMinutes =
      typeof initialConfig?.adhanDurationMinutes === 'number' && initialConfig.adhanDurationMinutes > 0
        ? initialConfig.adhanDurationMinutes
        : 4;
    const mapStyle =
      initialConfig?.mapStyle === 'roadmap' || initialConfig?.mapStyle === 'satellite'
        ? initialConfig.mapStyle
        : 'satellite';

    this.state = {
      config: {
        convention,
        madhab,
        highLatitudeRule,
        adhanDurationMinutes,
        mapStyle,
      },
      revision: 1,
      currentDate: initialDate,
      selectedLocation: null,
    };
  }

  public getState(): Readonly<AppState> {
    return this.state;
  }

  public getConfig(): Readonly<AppConfig> {
    return this.state.config;
  }

  public getRevision(): number {
    return this.state.revision;
  }

  public getDate(): Date {
    return this.state.currentDate;
  }

  public getLocation(): SelectedLocation | null {
    return this.state.selectedLocation;
  }

  public updateConfig(partial: Partial<AppConfig>): boolean {
    // Validate inputs strictly (Criterion A08)
    if (partial.convention !== undefined && !VALID_CONVENTIONS.has(partial.convention)) {
      console.warn(`[AppStore] Rejected invalid convention: ${partial.convention}`);
      return false;
    }
    if (partial.madhab !== undefined && !VALID_MADHABS.has(partial.madhab)) {
      console.warn(`[AppStore] Rejected invalid madhab: ${partial.madhab}`);
      return false;
    }
    if (
      partial.highLatitudeRule !== undefined &&
      !VALID_RULES.has(partial.highLatitudeRule)
    ) {
      console.warn(`[AppStore] Rejected invalid highLatitudeRule: ${partial.highLatitudeRule}`);
      return false;
    }
    if (
      partial.adhanDurationMinutes !== undefined &&
      (typeof partial.adhanDurationMinutes !== 'number' ||
        isNaN(partial.adhanDurationMinutes) ||
        partial.adhanDurationMinutes < 1)
    ) {
      console.warn(
        `[AppStore] Rejected invalid adhanDurationMinutes: ${partial.adhanDurationMinutes}`,
      );
      return false;
    }
    if (
      partial.mapStyle !== undefined &&
      partial.mapStyle !== 'roadmap' &&
      partial.mapStyle !== 'satellite'
    ) {
      console.warn(`[AppStore] Rejected invalid mapStyle: ${partial.mapStyle}`);
      return false;
    }

    const currentConfig = this.state.config;
    let hasChanges = false;
    const keys = Object.keys(partial) as (keyof AppConfig)[];
    for (const key of keys) {
      if (partial[key] !== undefined && partial[key] !== currentConfig[key]) {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) {
      return true;
    }

    const previousState = this.state;
    this.state = {
      ...this.state,
      config: {
        ...this.state.config,
        ...partial,
      },
      revision: this.state.revision + 1,
    };

    this.notify(previousState);
    return true;
  }

  public setDate(date: Date): void {
    if (!(date instanceof Date) || isNaN(date.getTime())) return;
    const previousState = this.state;
    this.state = {
      ...this.state,
      currentDate: date,
    };
    this.notify(previousState);
  }

  public setLocation(location: SelectedLocation | null): void {
    const previousState = this.state;
    this.state = {
      ...this.state,
      selectedLocation: location,
    };
    this.notify(previousState);
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeConfig(listener: ConfigListener): () => void {
    this.configListeners.add(listener);
    return () => {
      this.configListeners.delete(listener);
    };
  }

  private notify(previousState: AppState): void {
    const isConfigChanged = previousState.revision !== this.state.revision;
    for (const listener of this.listeners) {
      try {
        listener(this.state, previousState);
      } catch (err) {
        console.error('[AppStore] Error in state listener:', err);
      }
    }
    if (isConfigChanged) {
      for (const listener of this.configListeners) {
        try {
          listener(this.state.config, this.state.revision);
        } catch (err) {
          console.error('[AppStore] Error in config listener:', err);
        }
      }
    }
  }
}

export function createAppStore(
  initialConfig?: Partial<AppConfig>,
  initialDate?: Date,
): AppStore {
  return new AppStore(initialConfig, initialDate);
}
