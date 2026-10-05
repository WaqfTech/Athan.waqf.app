import { describe, it, expect, vi } from 'vitest';
import { createAppStore } from './state';
import { CalculationConventionName, Madhab, HighLatitudeRule } from '../prayer/conventions';

describe('AppStore - Reactive Configuration Store', () => {
  it('S01: initializes with default configuration and revision 1', () => {
    const store = createAppStore();
    const state = store.getState();
    const config = store.getConfig();

    expect(store.getRevision()).toBe(1);
    expect(config.convention).toBe('UmmAlQura');
    expect(config.madhab).toBe('Shafi');
    expect(config.highLatitudeRule).toBe('MiddleOfTheNight');
    expect(config.adhanDurationMinutes).toBe(4);
    expect(config.mapStyle).toBe('satellite');
    expect(state.selectedLocation).toBeNull();
  });

  it('S02: updateConfig increments revision counter monotonically and notifies listeners', () => {
    const store = createAppStore();
    const stateListener = vi.fn();
    const configListener = vi.fn();

    store.subscribe(stateListener);
    store.subscribeConfig(configListener);

    const success = store.updateConfig({ madhab: 'Hanafi' });
    expect(success).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(store.getConfig().madhab).toBe('Hanafi');

    expect(stateListener).toHaveBeenCalledTimes(1);
    expect(configListener).toHaveBeenCalledTimes(1);
    expect(configListener).toHaveBeenCalledWith(store.getConfig(), 2);
  });

  it('S03: rejects invalid convention names without mutating state or incrementing revision (Criterion A08)', () => {
    const store = createAppStore();
    const initialRevision = store.getRevision();
    const listener = vi.fn();
    store.subscribeConfig(listener);

    const success = store.updateConfig({ convention: 'InvalidConvention' as CalculationConventionName });
    expect(success).toBe(false);
    expect(store.getRevision()).toBe(initialRevision);
    expect(store.getConfig().convention).toBe('UmmAlQura');
    expect(listener).not.toHaveBeenCalled();
  });

  it('S04: rejects invalid madhab names without mutating state (Criterion A08)', () => {
    const store = createAppStore();
    const initialRevision = store.getRevision();

    const success = store.updateConfig({ madhab: 'Maliki' as Madhab });
    expect(success).toBe(false);
    expect(store.getRevision()).toBe(initialRevision);
    expect(store.getConfig().madhab).toBe('Shafi');
  });

  it('S05: rejects invalid high-latitude rules without mutating state (Criterion A08)', () => {
    const store = createAppStore();
    const initialRevision = store.getRevision();

    const success = store.updateConfig({ highLatitudeRule: 'InvalidRule' as HighLatitudeRule });
    expect(success).toBe(false);
    expect(store.getRevision()).toBe(initialRevision);
    expect(store.getConfig().highLatitudeRule).toBe('MiddleOfTheNight');
  });

  it('S06: unsubscribing a listener removes it cleanly from dispatch notifications', () => {
    const store = createAppStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.updateConfig({ madhab: 'Hanafi' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.updateConfig({ madhab: 'Shafi' });
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('S07: setLocation updates coordinates and notifies subscribers synchronously', () => {
    const store = createAppStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const loc = {
      type: 'coordinates' as const,
      latitude: 21.42,
      longitude: 39.83,
      nameEn: 'Mecca',
    };
    store.setLocation(loc);

    expect(store.getLocation()).toEqual(loc);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getRevision()).toBe(1); // revision only increments on config change
  });

  it('S08: setDate updates simulation date and notifies subscribers synchronously', () => {
    const store = createAppStore();
    const stateListener = vi.fn();
    const configListener = vi.fn();

    store.subscribe(stateListener);
    store.subscribeConfig(configListener);

    const newDate = new Date('2026-10-05T00:00:00Z');
    store.setDate(newDate);

    expect(store.getDate().getTime()).toBe(newDate.getTime());
    expect(stateListener).toHaveBeenCalledTimes(1);
    expect(configListener).not.toHaveBeenCalled(); // config did not change
  });

  it('S09: updateConfig is idempotent when passing identical scalar values', () => {
    const store = createAppStore({ convention: 'UmmAlQura', madhab: 'Shafi' });
    const initialRev = store.getRevision();
    const stateListener = vi.fn();
    const configListener = vi.fn();

    store.subscribe(stateListener);
    store.subscribeConfig(configListener);

    const result = store.updateConfig({ convention: 'UmmAlQura', madhab: 'Shafi' });
    expect(result).toBe(true);
    expect(store.getRevision()).toBe(initialRev);
    expect(stateListener).not.toHaveBeenCalled();
    expect(configListener).not.toHaveBeenCalled();
  });

  it('S10: updateConfig returns true and does not notify for empty partial config', () => {
    const store = createAppStore();
    const initialRev = store.getRevision();
    const stateListener = vi.fn();
    const configListener = vi.fn();

    store.subscribe(stateListener);
    store.subscribeConfig(configListener);

    const result = store.updateConfig({});
    expect(result).toBe(true);
    expect(store.getRevision()).toBe(initialRev);
    expect(stateListener).not.toHaveBeenCalled();
    expect(configListener).not.toHaveBeenCalled();
  });

  it('S11: updateConfig mutates and notifies exactly once when at least one field differs', () => {
    const store = createAppStore({ convention: 'UmmAlQura', madhab: 'Shafi' });
    const configListener = vi.fn();
    store.subscribeConfig(configListener);

    const result = store.updateConfig({ convention: 'UmmAlQura', madhab: 'Hanafi' });
    expect(result).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(configListener).toHaveBeenCalledTimes(1);
    expect(store.getConfig().madhab).toBe('Hanafi');
    expect(store.getConfig().convention).toBe('UmmAlQura');

    // Second call with identical values is idempotent
    const secondResult = store.updateConfig({ madhab: 'Hanafi' });
    expect(secondResult).toBe(true);
    expect(store.getRevision()).toBe(2);
    expect(configListener).toHaveBeenCalledTimes(1);
  });
});
