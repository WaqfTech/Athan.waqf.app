import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateIslamicNight,
  calculatePrayerTimes,
} from '../src/prayer/calculator';
import {
  CalculationConventionName,
  HighLatitudeRule,
} from '../src/prayer/conventions';
import { AdhanEventEngine } from '../src/simulation/eventEngine';
import { parseSettlements, CompactSettlementRow, Settlement } from '../src/population/loader';
import { SimulationClock } from '../src/simulation/clock';
import { createTimelineUI } from '../src/ui/timeline';
import { createHudOverlay } from '../src/ui/hud';
import { GlobeScene } from '../src/globe/scene';
import { createAppStore } from '../src/ui/state';
import { i18n } from '../src/i18n/manager';

// High-Fidelity Mock DOM harness matching challenger-m6-final-regression.test.ts
class MockClassList {
  public _set: Set<string> = new Set();
  constructor(private el: MockElement) {}
  add(...classes: string[]): void {
    for (const c of classes) if (c) this._set.add(c);
    this.sync();
  }
  remove(...classes: string[]): void {
    for (const c of classes) if (c) this._set.delete(c);
    this.sync();
  }
  toggle(c: string, force?: boolean): boolean {
    if (force === true) { this._set.add(c); this.sync(); return true; }
    if (force === false) { this._set.delete(c); this.sync(); return false; }
    const has = this._set.has(c);
    if (has) this._set.delete(c); else this._set.add(c);
    this.sync();
    return !has;
  }
  contains(c: string): boolean { return this._set.has(c); }
  private sync(): void { this.el._className = Array.from(this._set).join(' '); }
  _initFrom(cls: string): void {
    this._set.clear();
    for (const c of cls.split(/\s+/)) if (c) this._set.add(c);
  }
}

class MockElement {
  public tagName: string;
  public id = '';
  public _className = '';
  public attributes: Map<string, string> = new Map();
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public classList: MockClassList;
  public listeners: Map<string, Function[]> = new Map();
  public tabIndex = 0;
  public width = 600;
  public height = 32;
  public clientWidth = 600;
  public clientHeight = 32;
  public _rawText = '';
  public value = '';
  public dataset: Record<string, string> = {};
  public style = {
    setProperty: vi.fn(),
    getPropertyValue: vi.fn(() => ''),
    insetInlineStart: '',
    display: '',
    fontSize: '',
    opacity: '',
  };

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList(this);
  }

  get className(): string { return this._className; }
  set className(val: string) {
    this._className = val;
    this.classList._initFrom(val);
  }

  get textContent(): string {
    if (this._rawText) return this._rawText;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(val: string) {
    this.children = [];
    this._rawText = val;
  }

  setAttribute(k: string, v: string | number): void {
    const str = String(v);
    this.attributes.set(k, str);
    if (k === 'id') this.id = str;
    if (k === 'class') this.className = str;
    if (k === 'tabindex') this.tabIndex = parseInt(str, 10) || 0;
  }
  getAttribute(k: string): string | null { return this.attributes.get(k) ?? null; }
  hasAttribute(k: string): boolean { return this.attributes.has(k); }

  get firstChild(): MockElement | null {
    return this.children[0] ?? null;
  }

  insertBefore(newChild: MockElement, refChild: MockElement | null): MockElement {
    newChild.parentNode = this;
    if (!refChild) {
      this.children.push(newChild);
      return newChild;
    }
    const idx = this.children.indexOf(refChild);
    if (idx === -1) {
      this.children.push(newChild);
    } else {
      this.children.splice(idx, 0, newChild);
    }
    return newChild;
  }

  appendChild(c: MockElement): MockElement {
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  removeChild(c: MockElement): MockElement {
    const idx = this.children.indexOf(c);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      c.parentNode = null;
    }
    return c;
  }
  replaceChildren(...newChildren: MockElement[]): void {
    this.children = [];
    for (const c of newChildren) this.appendChild(c);
  }
  remove(): void {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  addEventListener(ev: string, fn: Function): void {
    const l = this.listeners.get(ev) || [];
    l.push(fn);
    this.listeners.set(ev, l);
  }
  removeEventListener(ev: string, fn: Function): void {
    const l = this.listeners.get(ev) || [];
    const idx = l.indexOf(fn);
    if (idx !== -1) l.splice(idx, 1);
  }

  dispatchEvent(ev: { type: string; [k: string]: unknown }): boolean {
    const list = this.listeners.get(ev.type) || [];
    for (const fn of list) {
      fn(ev);
    }
    return true;
  }

  private _rawHtml = '';
  get innerHTML(): string {
    if (this._rawHtml) return this._rawHtml;
    return this.children.map((c) => `<${c.tagName.toLowerCase()}>${c.innerHTML}</${c.tagName.toLowerCase()}>`).join('');
  }
  set innerHTML(html: string) {
    this._rawHtml = html;
    this.children = [];
    this._rawText = '';
    parseHtmlFragment(html, this);
  }

  querySelector(sel: string): MockElement | null {
    for (const ch of this.children) {
      if (sel.startsWith('#') && ch.id === sel.slice(1)) return ch;
      if (sel.startsWith('.') && ch.classList.contains(sel.slice(1))) return ch;
      if (ch.tagName.toLowerCase() === sel.toLowerCase()) return ch;
      const found = ch.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const res: MockElement[] = [];
    for (const ch of this.children) {
      if (sel.startsWith('#') && ch.id === sel.slice(1)) res.push(ch);
      else if (sel.startsWith('.') && ch.classList.contains(sel.slice(1))) res.push(ch);
      else if (ch.tagName.toLowerCase() === sel.toLowerCase()) res.push(ch);
      res.push(...ch.querySelectorAll(sel));
    }
    return res;
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }

  getContext(type: string): unknown {
    if (type === '2d') {
      return {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
    }
    return null;
  }
}

function parseHtmlFragment(html: string, parent: MockElement): void {
  const tagRegex = /<\/?([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  const stack: MockElement[] = [parent];

  while ((match = tagRegex.exec(html)) !== null) {
    const full = match[0];
    const tag = match[1];
    const rawAttrs = match[2];
    const text = match[3];

    if (text) {
      const trimmed = text.trim();
      if (trimmed) {
        const top = stack[stack.length - 1];
        if (top) {
          top._rawText = (top._rawText ? top._rawText + ' ' : '') + trimmed;
        }
      }
    } else if (tag) {
      const isClosing = full.startsWith('</');
      const isSelfClosing = full.endsWith('/>') || ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tag.toLowerCase());

      if (isClosing) {
        if (stack.length > 1) {
          stack.pop();
        }
      } else {
        const el = new MockElement(tag);
        const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
        let am: RegExpExecArray | null;
        while ((am = attrRegex.exec(rawAttrs)) !== null) {
          const k = am[1];
          if (k === '/') continue;
          const v = am[2] ?? am[3] ?? am[4] ?? '';
          el.setAttribute(k, v);
        }
        const currentTop = stack[stack.length - 1];
        if (currentTop) {
          currentTop.appendChild(el);
        }
        if (!isSelfClosing) {
          stack.push(el);
        }
      }
    }
  }
}

function loadSettlements(): Settlement[] {
  const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
  return parseSettlements(raw);
}

describe('Challenger Stress Harness: Milestone 6 Cross-Milestone Invariants', () => {
  let originalDoc: unknown;
  let originalWin: unknown;
  let originalResizeObserver: unknown;

  beforeEach(() => {
    i18n.setLocale('en');

    originalDoc = (globalThis as unknown as { document: unknown }).document;
    originalWin = (globalThis as unknown as { window: unknown }).window;
    originalResizeObserver = (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver;

    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;

    const docEl = new MockElement('html');
    const bodyEl = new MockElement('body');
    docEl.appendChild(bodyEl);

    (globalThis as unknown as { document: unknown }).document = {
      documentElement: docEl,
      body: bodyEl,
      createElement: (tag: string) => new MockElement(tag),
      getElementById: (id: string) => docEl.querySelector(`#${id}`),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      fullscreenEnabled: true,
    };

    (globalThis as unknown as { window: unknown }).window = {
      location: { href: 'http://localhost/' },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 1),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    i18n.setLocale('en');
    (globalThis as unknown as { document: unknown }).document = originalDoc;
    (globalThis as unknown as { window: unknown }).window = originalWin;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = originalResizeObserver;
  });

  // -------------------------------------------------------------------------
  // Objective 1: 365 Days Astronomical Invariants across Polar Extremes
  // -------------------------------------------------------------------------
  describe('Objective 1: 365 Days Astronomical Invariants across Polar Extremes', () => {
    const locations = [
      { name: 'Tromsø, Norway', lat: 69.6492, lon: 18.9553 },
      { name: 'Alert, Nunavut (Northernmost)', lat: 82.5018, lon: -62.3481 },
      { name: 'Longyearbyen, Svalbard', lat: 78.2232, lon: 15.6267 },
      { name: 'Makkah, Saudi Arabia', lat: 21.4225, lon: 39.8262 },
      { name: 'Singapore (Equatorial)', lat: 1.3521, lon: 103.8198 },
      { name: 'Ushuaia, Argentina (Far South)', lat: -54.8019, lon: -68.3030 },
    ];

    const conventions: CalculationConventionName[] = ['MuslimWorldLeague', 'UmmAlQura'];
    const highLatRules: HighLatitudeRule[] = ['AngleBased', 'MiddleOfTheNight', 'SeventhOfTheNight'];

    it('empirically evaluates all 365 days of 2026 for polar extremes and verifies mathematical invariants', () => {
      let totalScheduleEvaluations = 0;
      let totalNightCalculations = 0;

      for (const loc of locations) {
        for (const convention of conventions) {
          for (const highLat of highLatRules) {
            // Test all 365 days of 2026
            for (let dayOfYear = 0; dayOfYear < 365; dayOfYear++) {
              const testDate = new Date(Date.UTC(2026, 0, 1 + dayOfYear, 12, 0, 0));
              totalScheduleEvaluations++;

              const sched = calculatePrayerTimes(loc.lat, loc.lon, testDate, {
                convention,
                madhab: 'Shafi',
                highLatitudeRule: highLat,
              });

              expect(sched).toBeDefined();

              if (sched.islamicNight) {
                totalNightCalculations++;
                const night = sched.islamicNight;

                // Duration must be strictly positive and <= 24 hours
                expect(night.durationMs).toBeGreaterThan(0);
                expect(night.durationMs).toBeLessThanOrEqual(24 * 3600000);
                expect(Number.isFinite(night.durationMs)).toBe(true);

                // Midnight invariant: exactly halfway between start and end
                const maghribMs = night.lastThirdStart.getTime() - Math.round((night.durationMs * 2) / 3);
                const fajrMs = night.lastThirdEnd.getTime();
                const expectedDuration = fajrMs - maghribMs;
                expect(night.durationMs).toBe(expectedDuration);

                const expectedMidnight = Math.round(maghribMs + night.durationMs / 2);
                expect(night.midnight.getTime()).toBe(expectedMidnight);

                // Last third start invariant: Maghrib + 2/3 * duration === Fajr - 1/3 * duration (within 1ms rounding)
                const expectedLastThirdStart = Math.round(maghribMs + (night.durationMs * 2) / 3);
                expect(night.lastThirdStart.getTime()).toBe(expectedLastThirdStart);

                const dualStart = fajrMs - Math.round(night.durationMs / 3);
                expect(Math.abs(night.lastThirdStart.getTime() - dualStart)).toBeLessThanOrEqual(1);

                // Active state probe tests
                const probeInside = new Date(night.lastThirdStart.getTime() + 1000);
                const nightInside = calculateIslamicNight(new Date(maghribMs), night.lastThirdEnd, probeInside);
                expect(nightInside?.isCurrentlyLastThird).toBe(true);

                const probeBefore = new Date(night.lastThirdStart.getTime() - 1000);
                const nightBefore = calculateIslamicNight(new Date(maghribMs), night.lastThirdEnd, probeBefore);
                expect(nightBefore?.isCurrentlyLastThird).toBe(false);

                const probeAfter = new Date(night.lastThirdEnd.getTime() + 1000);
                const nightAfter = calculateIslamicNight(new Date(maghribMs), night.lastThirdEnd, probeAfter);
                expect(nightAfter?.isCurrentlyLastThird).toBe(false);
              }
            }
          }
        }
      }

      expect(totalScheduleEvaluations).toBe(locations.length * conventions.length * highLatRules.length * 365);
      expect(totalNightCalculations).toBeGreaterThan(10000);
    });
  });

  // -------------------------------------------------------------------------
  // Objective 2: Settlement Counter Latency and Allocations Across 4 Seasons
  // -------------------------------------------------------------------------
  describe('Objective 2: Settlement Counter Latency and Allocations Across 4 Seasons', () => {
    const settlements = loadSettlements();
    const seasons = [
      { name: 'Vernal Equinox', date: new Date('2026-03-20T12:00:00Z') },
      { name: 'Summer Solstice', date: new Date('2026-06-21T12:00:00Z') },
      { name: 'Autumnal Equinox', date: new Date('2026-09-22T12:00:00Z') },
      { name: 'Winter Solstice', date: new Date('2026-12-21T12:00:00Z') },
    ];

    it('evaluates all 15,000 settlements in < 2.0ms median latency across all 4 astronomical seasons', () => {
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      // Warm up
      for (let w = 0; w < 20; w++) {
        engine.countSettlementsInLastThird(new Date(Date.UTC(2026, 0, 1, 0, w, 0)));
      }

      for (const season of seasons) {
        const timings: number[] = [];
        const iterations = 60; // 60 frames = 1 full simulated second at 60fps

        const startMem = process.memoryUsage().heapUsed;

        for (let i = 0; i < iterations; i++) {
          const tickTime = new Date(season.date.getTime() + i * 16.666);
          const t0 = performance.now();
          const count = engine.countSettlementsInLastThird(tickTime);
          const elapsed = performance.now() - t0;
          timings.push(elapsed);

          expect(count).toBeGreaterThan(0);
          expect(count).toBeLessThan(15000);
        }

        const endMem = process.memoryUsage().heapUsed;
        const memDelta = endMem - startMem;

        timings.sort((a, b) => a - b);
        const min = timings[0];
        const median = timings[Math.floor(timings.length / 2)];
        const p95 = timings[Math.floor(timings.length * 0.95)];
        const max = timings[timings.length - 1];
        const mean = timings.reduce((a, b) => a + b, 0) / timings.length;

        // Sub-2.0ms requirement verification
        expect(median).toBeLessThan(2.0);
        expect(mean).toBeLessThan(2.0);

        // Verification of heap stability: bounded memory delta
        expect(memDelta).toBeLessThan(5 * 1024 * 1024);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Objective 3: Live Telemetry Updates between Event Engine, HUD, Timeline
  // -------------------------------------------------------------------------
  describe('Objective 3: Live Telemetry Updates and Timeline Scrubbing', () => {
    const settlements = loadSettlements();

    it('propagates count from eventEngine to timeline chip on time advances and store changes', () => {
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const clock = new SimulationClock(new Date('2026-10-06T00:00:00Z'));
      const store = createAppStore({ convention: 'UmmAlQura', madhab: 'Shafi' });

      const mockGlobe = {
        cameraRig: { focusCoordinates: vi.fn(), setViewShift: vi.fn(), setAutoRotateAllowed: vi.fn() },
        qiblaArcs: { clearInspectedCity: vi.fn(), setInspectedCity: vi.fn() },
        setTime: vi.fn(),
        setConvention: vi.fn(),
        setMadhab: vi.fn(),
        setMapStyle: vi.fn(),
        getMapStyle: vi.fn(() => 'roadmap'),
      } as unknown as GlobeScene;

      const hud = createHudOverlay(clock, mockGlobe, { store });
      hud.setEventEngine(engine);

      const statVal = hud.element.querySelector('#stat-last-third');
      const statChip = hud.element.querySelector('#stat-chip-last-third');
      expect(statVal).not.toBeNull();
      expect(statChip).not.toBeNull();

      // Test time step 1
      const t1 = new Date('2026-10-06T03:00:00Z');
      hud.updateTime(t1);
      const count1 = engine.countSettlementsInLastThird(t1);
      expect(statVal!.textContent).toBe(count1.toLocaleString('en-US'));
      expect(statChip!.classList.contains('is-active')).toBe(true);

      // Test time step 2
      const t2 = new Date('2026-10-06T15:00:00Z');
      hud.updateTime(t2);
      const count2 = engine.countSettlementsInLastThird(t2);
      expect(statVal!.textContent).toBe(count2.toLocaleString('en-US'));

      // Test store configuration change
      store.updateConfig({ convention: 'MuslimWorldLeague' });
      engine.setConvention('MuslimWorldLeague');
      const countUpdated = engine.countSettlementsInLastThird(t2);
      hud.updateLastThirdCount(countUpdated);
      expect(statVal!.textContent).toBe(countUpdated.toLocaleString('en-US'));

      hud.dispose();
    });

    it('synchronously recalculates and updates chip during interactive timeline scrubbing via keyboard and mouse', () => {
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const initialDate = new Date('2026-10-06T12:00:00Z');
      const clock = new SimulationClock(initialDate);

      let scrubbedDate: Date | null = null;
      let scrubbedCount: number | null = null;

      const timeline = createTimelineUI(clock, {
        onScrub: (date) => {
          scrubbedDate = date;
          const count = engine.countSettlementsInLastThird(date);
          scrubbedCount = count;
          timeline.updateLastThirdCount(count);
        },
      });

      const trackWrapper = timeline.element.querySelector('.timeline-track-wrapper');
      expect(trackWrapper).not.toBeNull();

      const statVal = timeline.element.querySelector('#stat-last-third');
      expect(statVal).not.toBeNull();

      // 1. Test keyboard scrub interaction (ArrowRight advances time)
      trackWrapper!.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: vi.fn() });
      expect(scrubbedDate).not.toBeNull();
      expect(scrubbedDate!.getTime()).toBe(initialDate.getTime() + 300 * 1000); // 300 seconds step
      expect(statVal!.textContent).toBe(scrubbedCount!.toLocaleString('en-US'));

      // 2. Test mouse scrub interaction
      trackWrapper!.dispatchEvent({ type: 'mousedown', clientX: 300 });
      expect(scrubbedDate).not.toBeNull();
      expect(typeof scrubbedCount).toBe('number');
      expect(statVal!.textContent).toBe(scrubbedCount!.toLocaleString('en-US'));

      timeline.dispose();
    });
  });
});
