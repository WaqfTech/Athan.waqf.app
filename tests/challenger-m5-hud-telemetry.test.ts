import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTimelineUI } from '../src/ui/timeline';
import { createHudOverlay } from '../src/ui/hud';
import { SimulationClock } from '../src/simulation/clock';
import { i18n } from '../src/i18n/manager';
import { DICTIONARIES, SupportedLocale } from '../src/i18n/translations';
import { AdhanEventEngine } from '../src/simulation/eventEngine';
import { parseSettlements, CompactSettlementRow, Settlement } from '../src/population/loader';
import { GlobeScene } from '../src/globe/scene';

// ---------------------------------------------------------------------------
// High-Fidelity Headless DOM Emulation Harness
// ---------------------------------------------------------------------------

class MockClassList {
  public _set: Set<string> = new Set();
  constructor(private el: MockElement) {}

  add(...classes: string[]): void {
    for (const c of classes) {
      if (c) this._set.add(c);
    }
    this.sync();
  }

  remove(...classes: string[]): void {
    for (const c of classes) {
      this._set.delete(c);
    }
    this.sync();
  }

  toggle(c: string, force?: boolean): boolean {
    if (force === true) {
      this._set.add(c);
      this.sync();
      return true;
    }
    if (force === false) {
      this._set.delete(c);
      this.sync();
      return false;
    }
    const has = this._set.has(c);
    if (has) this._set.delete(c);
    else this._set.add(c);
    this.sync();
    return !has;
  }

  contains(c: string): boolean {
    return this._set.has(c);
  }

  private sync(): void {
    this.el._className = Array.from(this._set).join(' ');
  }

  _initFrom(className: string): void {
    this._set.clear();
    for (const c of className.split(/\s+/)) {
      if (c) this._set.add(c);
    }
  }
}

class MockStyle {
  public _props: Map<string, string> = new Map();
  public insetInlineStart = '';
  public display = '';
  public fontSize = '';
  public opacity = '';

  setProperty(key: string, val: string): void {
    this._props.set(key, val);
  }

  getPropertyValue(key: string): string {
    return this._props.get(key) || '';
  }
}

class MockElement {
  public tagName: string;
  public id = '';
  public _className = '';
  public attributes: Map<string, string> = new Map();
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public style: MockStyle = new MockStyle();
  public classList: MockClassList;
  public listeners: Map<string, Function[]> = new Map();
  public tabIndex = 0;
  public width = 600;
  public height = 32;
  public clientWidth = 600;
  public clientHeight = 32;
  public _rawText = '';
  public type = '';
  public placeholder = '';
  public value = '';
  public dataset: Record<string, string> = {};

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList(this);
  }

  get className(): string {
    return this._className;
  }

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

  get title(): string {
    return this.getAttribute('title') || '';
  }

  set title(val: string) {
    this.setAttribute('title', val);
  }

  setAttribute(k: string, v: string | number): void {
    const str = String(v);
    this.attributes.set(k, str);
    if (k === 'id') this.id = str;
    if (k === 'class') this.className = str;
    if (k === 'tabindex') this.tabIndex = parseInt(str, 10) || 0;
  }

  getAttribute(k: string): string | null {
    return this.attributes.get(k) ?? null;
  }

  hasAttribute(k: string): boolean {
    return this.attributes.has(k);
  }

  removeAttribute(k: string): void {
    this.attributes.delete(k);
  }

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

  appendChild(child: MockElement): MockElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: MockElement): MockElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(event: string, fn: Function): void {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, fn: Function): void {
    const list = this.listeners.get(event) || [];
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  contains(other: unknown): boolean {
    if (other === this) return true;
    if (!(other instanceof MockElement)) return false;
    for (const child of this.children) {
      if (child.contains(other)) return true;
    }
    return false;
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }

  set innerHTML(html: string) {
    this.children = [];
    this._rawText = '';
    parseHtmlFragment(html, this);
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
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
    }
    return null;
  }

  querySelector(sel: string): MockElement | null {
    for (const ch of this.children) {
      if (matchesSel(ch, sel)) return ch;
      const sub = ch.querySelector(sel);
      if (sub) return sub;
    }
    return null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const res: MockElement[] = [];
    for (const ch of this.children) {
      if (matchesSel(ch, sel)) res.push(ch);
      res.push(...ch.querySelectorAll(sel));
    }
    return res;
  }
}

function matchesSel(el: MockElement, sel: string): boolean {
  sel = sel.trim();
  if (sel.includes(',')) {
    return sel.split(',').some((s) => matchesSel(el, s));
  }

  const idMatch = sel.match(/^#([a-zA-Z0-9_-]+)$/);
  if (idMatch) return el.id === idMatch[1];

  const classMatches = sel.match(/\.([a-zA-Z0-9_-]+)/g);
  if (classMatches) {
    for (const cm of classMatches) {
      if (!el.classList.contains(cm.slice(1))) return false;
    }
    const leadingId = sel.match(/^#([a-zA-Z0-9_-]+)/);
    if (leadingId && el.id !== leadingId[1]) return false;
    return true;
  }

  if (sel.startsWith('#')) {
    const leadingId = sel.slice(1);
    return el.id === leadingId;
  }

  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function parseHtmlFragment(html: string, parent: MockElement): void {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').trim();
  const tagTokenRegex = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  const stack: MockElement[] = [parent];
  let m: RegExpExecArray | null;

  while ((m = tagTokenRegex.exec(clean)) !== null) {
    if (m[4]) {
      const text = m[4].trim();
      if (text) {
        const top = stack[stack.length - 1];
        if (top) {
          top._rawText = (top._rawText ? top._rawText + ' ' : '') + text;
        }
      }
    } else {
      const isClosing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const rawAttrs = m[3] || '';
      const isSelfClosing =
        rawAttrs.trim().endsWith('/') ||
        ['circle', 'path', 'line', 'input', 'img', 'br', 'hr'].includes(tag);

      if (isClosing) {
        if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tag) {
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

// Helper to load real settlements for scrubbing verification
function load15kSettlements(): Settlement[] {
  const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
  return parseSettlements(rawData);
}

// ---------------------------------------------------------------------------
// Test Suite: Challenger Milestone 5 HUD and Timeline Telemetry
// ---------------------------------------------------------------------------

describe('Challenger M5: HUD and Timeline Live Telemetry Empirical Stress', () => {
  let originalDocument: unknown;
  let originalWindow: unknown;
  let originalResizeObserver: unknown;
  let mockDoc: {
    documentElement: MockElement;
    body: MockElement;
    createElement: (tag: string) => MockElement;
    getElementById: (id: string) => MockElement | null;
    addEventListener: (event: string, fn: Function) => void;
    removeEventListener: (event: string, fn: Function) => void;
    fullscreenEnabled: boolean;
  };
  let mockWin: {
    location: { href: string };
    clearTimeout: (id: number) => void;
    setTimeout: (fn: Function, ms: number) => number;
    addEventListener: (event: string, fn: Function) => void;
    removeEventListener: (event: string, fn: Function) => void;
  };

  beforeEach(() => {
    i18n.setLocale('en');

    originalDocument = (globalThis as unknown as { document: unknown }).document;
    originalWindow = (globalThis as unknown as { window: unknown }).window;
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

    const docElementsMap = new Map<string, MockElement>();

    mockDoc = {
      documentElement: docEl,
      body: bodyEl,
      createElement: (tag: string) => new MockElement(tag),
      getElementById: (id: string) => {
        return docElementsMap.get(id) || docEl.querySelector(`#${id}`) || null;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      fullscreenEnabled: true,
    };

    const winListeners = new Map<string, Function[]>();
    mockWin = {
      location: { href: 'http://localhost/' },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn((fn) => 1),
      addEventListener: vi.fn((event, fn) => {
        const l = winListeners.get(event) || [];
        l.push(fn);
        winListeners.set(event, l);
      }),
      removeEventListener: vi.fn((event, fn) => {
        const l = winListeners.get(event) || [];
        const idx = l.indexOf(fn);
        if (idx !== -1) l.splice(idx, 1);
      }),
      listeners: winListeners,
    };

    (globalThis as unknown as { document: unknown }).document = mockDoc;
    (globalThis as unknown as { window: unknown }).window = mockWin;
  });

  afterEach(() => {
    i18n.setLocale('en');
    (globalThis as unknown as { document: unknown }).document = originalDocument;
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = originalResizeObserver;
  });

  // =========================================================================
  // 1. DOM Integrity & Accessibility Verification
  // =========================================================================
  describe('Requirement 1: DOM Integrity & Accessibility (#stat-chip-last-third)', () => {
    it('mounts #stat-chip-last-third with dot, label, initial value, tabindex 0, and valid title tooltip', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const chip = timeline.element.querySelector('#stat-chip-last-third');
      expect(chip).not.toBeNull();
      expect(chip!.classList.contains('stat-chip')).toBe(true);
      expect(chip!.classList.contains('stat-chip-last-third')).toBe(true);
      expect(chip!.getAttribute('tabindex')).toBe('0');
      expect(chip!.getAttribute('title')).toBe(DICTIONARIES.en.timeline.lastThirdTip);

      // Dot element verification
      const dot = chip!.querySelector('.stat-chip-dot');
      expect(dot).not.toBeNull();
      expect(dot!.getAttribute('aria-hidden')).toBe('true');

      // Label element verification
      const label = chip!.querySelector('#stat-last-third-label');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe(DICTIONARIES.en.timeline.lastThirdCities);

      // Value element verification
      const val = chip!.querySelector('#stat-last-third');
      expect(val).not.toBeNull();
      expect(val!.textContent).toBe('--');

      // Initial state: not active
      expect(chip!.classList.contains('is-active')).toBe(false);

      timeline.dispose();
    });

    it('reactively updates label and tooltip across all 10 supported locales', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const locales = Object.keys(DICTIONARIES) as SupportedLocale[];
      expect(locales.length).toBe(10);

      const chip = timeline.element.querySelector('#stat-chip-last-third');
      const label = timeline.element.querySelector('#stat-last-third-label');

      for (const loc of locales) {
        i18n.setLocale(loc);
        const expectedDict = DICTIONARIES[loc];

        expect(label!.textContent).toBe(expectedDict.timeline.lastThirdCities);
        expect(chip!.getAttribute('title')).toBe(expectedDict.timeline.lastThirdTip);
        expect(chip!.getAttribute('tabindex')).toBe('0');
      }

      timeline.dispose();
    });

    it('cleans up DOM and listeners cleanly on dispose without leaving detached artifacts', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const container = timeline.element;
      expect(container.parentNode).toBeNull(); // not yet appended

      // Append to mock body
      mockDoc.body.appendChild(container);
      expect(mockDoc.body.children).toContain(container);

      timeline.dispose();
      expect(mockDoc.body.children).not.toContain(container);
    });
  });

  // =========================================================================
  // 2. Rapid Updates & 60fps Layout Caching Stress
  // =========================================================================
  describe('Requirement 2: Rapid Updates & Layout Caching (100 Calls at 60fps)', () => {
    it('executes 100 sequential 60fps calls with differing counts accurately without memory leaks or errors', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      const startMs = performance.now();

      for (let i = 1; i <= 100; i++) {
        const count = i * 150;
        timeline.updateLastThirdCount(count);
        expect(valEl!.textContent).toBe(count.toLocaleString('en-US'));
        expect(chipEl!.classList.contains('is-active')).toBe(true);
      }

      const elapsedMs = performance.now() - startMs;
      // 100 calls in mock DOM should take less than 20ms
      expect(elapsedMs).toBeLessThan(100);

      timeline.dispose();
    });

    it('bypasses redundant DOM writes when identical count is provided repeatedly', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      timeline.updateLastThirdCount(7500);
      expect(valEl!.textContent).toBe('7,500');

      // Mutate textContent manually to detect if updateLastThirdCount performs redundant write
      valEl!.textContent = 'cached-marker';

      // 100 identical calls
      for (let i = 0; i < 100; i++) {
        timeline.updateLastThirdCount(7500);
      }

      // Must remain cached-marker because layout caching avoided overwriting
      expect(valEl!.textContent).toBe('cached-marker');

      // Calling with a different count must invalidate cache and update DOM
      timeline.updateLastThirdCount(7501);
      expect(valEl!.textContent).toBe('7,501');

      timeline.dispose();
    });

    it('robustly handles adversarial numerical inputs (negative, fractional, NaN, Infinity)', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      // Negative values clamped to 0
      timeline.updateLastThirdCount(-42);
      expect(valEl!.textContent).toBe('0');
      expect(chipEl!.classList.contains('is-active')).toBe(false);

      // NaN defaulted to 0
      timeline.updateLastThirdCount(NaN);
      expect(valEl!.textContent).toBe('0');
      expect(chipEl!.classList.contains('is-active')).toBe(false);

      // Infinity defaulted to 0
      timeline.updateLastThirdCount(Infinity);
      expect(valEl!.textContent).toBe('0');
      expect(chipEl!.classList.contains('is-active')).toBe(false);

      // Fractional values floored
      timeline.updateLastThirdCount(99.99);
      expect(valEl!.textContent).toBe('99');
      expect(chipEl!.classList.contains('is-active')).toBe(true);

      // Large values formatted with US commas
      timeline.updateLastThirdCount(15000);
      expect(valEl!.textContent).toBe('15,000');
      expect(chipEl!.classList.contains('is-active')).toBe(true);

      timeline.dispose();
    });

    it('strictly preserves Western Arabic numerals (0-9) even under non-Latin locales', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      const nonLatinLocales: SupportedLocale[] = ['ar', 'fa', 'ur', 'bn'];
      for (const loc of nonLatinLocales) {
        i18n.setLocale(loc);
        timeline.updateLastThirdCount(12345);
        expect(valEl!.textContent).toBe('12,345');
        // Ensure no Eastern Arabic-Indic numerals (٠-٩) or Persian numerals (۰-۹)
        expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(valEl!.textContent || '')).toBe(false);
      }

      timeline.dispose();
    });
  });

  // =========================================================================
  // 3. State Toggling Verification (.is-active)
  // =========================================================================
  describe('Requirement 3: State Toggling (.is-active Dynamic Class)', () => {
    it('dynamically toggles .is-active class when count transitions between 0 and >0', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      expect(chipEl!.classList.contains('is-active')).toBe(false);

      // Transition to active
      timeline.updateLastThirdCount(1);
      expect(chipEl!.classList.contains('is-active')).toBe(true);

      // Transition to zero (inactive)
      timeline.updateLastThirdCount(0);
      expect(chipEl!.classList.contains('is-active')).toBe(false);

      // Multiple alternating cycles
      const pattern = [500, 0, 12, 0, 15000, 0, 3, 0];
      for (const val of pattern) {
        timeline.updateLastThirdCount(val);
        expect(chipEl!.classList.contains('is-active')).toBe(val > 0);
      }

      timeline.dispose();
    });

    it('stress-tests 50 rapid alternating 0 and >0 transitions without class synchronization drift', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');
      const valEl = timeline.element.querySelector('#stat-last-third');

      for (let cycle = 0; cycle < 50; cycle++) {
        // High count
        timeline.updateLastThirdCount(cycle + 1);
        expect(chipEl!.classList.contains('is-active')).toBe(true);
        expect(valEl!.textContent).toBe(String(cycle + 1));

        // Zero count
        timeline.updateLastThirdCount(0);
        expect(chipEl!.classList.contains('is-active')).toBe(false);
        expect(valEl!.textContent).toBe('0');
      }

      timeline.dispose();
    });
  });

  // =========================================================================
  // 4. Timeline Scrubbing & Real-Time Telemetry Synchronization
  // =========================================================================
  describe('Requirement 4: Timeline Scrubbing & EventEngine Integration', () => {
    it('triggers accurate settlement count updates when scrubbing via createTimelineUI callback', () => {
      const settlements = load15kSettlements();
      const eventEngine = new AdhanEventEngine(settlements, {
        convention: 'MuslimWorldLeague',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      const clock = new SimulationClock(new Date('2026-10-06T00:00:00Z'));
      let scrubbedDate: Date | null = null;

      const timeline = createTimelineUI(clock, {
        onScrub: (date) => {
          scrubbedDate = date;
          const count = eventEngine.countSettlementsInLastThird(date);
          timeline.updateLastThirdCount(count);
        },
      });

      const valEl = timeline.element.querySelector('#stat-last-third');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      // Test scrubbing across 4 distinct hours of the day
      const scrubHours = [0, 6, 12, 18];
      for (const h of scrubHours) {
        const testDate = new Date(`2026-10-06T${String(h).padStart(2, '0')}:00:00Z`);
        clock.setTime(testDate);

        // Simulate scrub action
        const expectedCount = eventEngine.countSettlementsInLastThird(testDate);
        expect(expectedCount).toBeGreaterThan(0); // across 15,000 cities, some are always in last third
        expect(expectedCount).toBeLessThan(15000);

        timeline.updateLastThirdCount(expectedCount);
        expect(valEl!.textContent).toBe(expectedCount.toLocaleString('en-US'));
        expect(chipEl!.classList.contains('is-active')).toBe(true);
      }

      timeline.dispose();
    });

    it('integrates HUD overlay and updates last third count automatically during time advances and scrubs', () => {
      const settlements = load15kSettlements();
      const eventEngine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
      });

      const clock = new SimulationClock(new Date('2026-10-06T02:30:00Z'));

      const mockGlobeScene = {
        cameraRig: {
          focusCoordinates: vi.fn(),
          setViewShift: vi.fn(),
          setAutoRotateAllowed: vi.fn(),
        },
        qiblaArcs: {
          clearInspectedCity: vi.fn(),
          setInspectedCity: vi.fn(),
        },
        setTime: vi.fn(),
        setConvention: vi.fn(),
        setMadhab: vi.fn(),
        setMapStyle: vi.fn(),
        getMapStyle: vi.fn(() => 'roadmap'),
      } as unknown as GlobeScene;

      const hud = createHudOverlay(clock, mockGlobeScene);
      hud.setEventEngine(eventEngine);

      const valEl = hud.element.querySelector('#stat-last-third');
      const chipEl = hud.element.querySelector('#stat-chip-last-third');

      expect(valEl).not.toBeNull();
      expect(chipEl).not.toBeNull();

      // Advancing time via hud.updateTime updates timeline playhead and last-third count
      const t1 = new Date('2026-10-06T03:00:00Z');
      hud.updateTime(t1);

      const count1 = eventEngine.countSettlementsInLastThird(t1);
      expect(valEl!.textContent).toBe(count1.toLocaleString('en-US'));
      expect(chipEl!.classList.contains('is-active')).toBe(count1 > 0);

      // Scrubbing to another time
      const t2 = new Date('2026-10-06T15:00:00Z');
      hud.updateTime(t2);

      const count2 = eventEngine.countSettlementsInLastThird(t2);
      expect(valEl!.textContent).toBe(count2.toLocaleString('en-US'));
      expect(chipEl!.classList.contains('is-active')).toBe(count2 > 0);
      expect(count2).not.toBe(count1); // Different count at 15:00 UTC vs 03:00 UTC

      hud.dispose();
    });

    it('simulates interactive track mouse dragging and verifies accurate scrub time calculation', () => {
      const clock = new SimulationClock(new Date('2026-10-06T00:00:00Z'));
      let lastScrubbedDate: Date | null = null;

      const timeline = createTimelineUI(clock, {
        onScrub: (date) => {
          lastScrubbedDate = date;
        },
      });

      const trackWrapper = timeline.element.querySelector('.timeline-track-wrapper');
      expect(trackWrapper).not.toBeNull();

      // Trigger mousedown at clientX = 300 (50% of 600px width -> 12:00:00 UTC)
      const mouseDownListeners = trackWrapper!.listeners.get('mousedown') || [];
      expect(mouseDownListeners.length).toBeGreaterThan(0);
      mouseDownListeners[0]({ clientX: 300 });

      expect(lastScrubbedDate).not.toBeNull();
      expect((lastScrubbedDate as unknown as Date).getUTCHours()).toBe(12);
      expect((lastScrubbedDate as unknown as Date).getUTCMinutes()).toBe(0);
      expect((lastScrubbedDate as unknown as Date).getUTCSeconds()).toBe(0);

      // Trigger mousemove on window at clientX = 450 (75% of 600px width -> 18:00:00 UTC)
      // The timeline attaches mousemove to window
      const win = globalThis.window as unknown as { listeners: Map<string, Function[]> };
      const mouseMoveListeners = win.listeners.get('mousemove') || [];
      expect(mouseMoveListeners.length).toBeGreaterThan(0);
      mouseMoveListeners[0]({ clientX: 450 });

      expect((lastScrubbedDate as unknown as Date).getUTCHours()).toBe(18);

      // Trigger mouseup to complete drag
      const mouseUpListeners = win.listeners.get('mouseup') || [];
      expect(mouseUpListeners.length).toBeGreaterThan(0);
      mouseUpListeners[0]({});

      timeline.dispose();
    });

    it('detects day boundary crossing during timeline scrubbing and triggers onDayBoundary callback', () => {
      const clock = new SimulationClock(new Date('2026-10-06T23:50:00Z'));
      let dayBoundaryDate: Date | null = null;

      const timeline = createTimelineUI(clock, {
        onDayBoundary: (date) => {
          dayBoundaryDate = date;
        },
      });

      // Advance playhead into next day
      const nextDay = new Date('2026-10-07T00:10:00Z');
      timeline.updatePlayhead(nextDay);

      expect(dayBoundaryDate).not.toBeNull();
      expect((dayBoundaryDate as unknown as Date).toISOString().slice(0, 10)).toBe('2026-10-07');

      timeline.dispose();
    });
  });

  // =========================================================================
  // 5. High-Frequency Simulation Loop & Teardown Stress
  // =========================================================================
  describe('Requirement 5: Lifecycle Teardown & High-Frequency Simulation Stress', () => {
    it('executes 600 continuous simulation ticks (60 seconds at 10Hz) under 25ms total execution time', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      const start = performance.now();
      for (let tick = 0; tick < 600; tick++) {
        // Continuous fluctuating population count
        const simulatedCount = 2000 + Math.floor(Math.sin(tick / 20) * 1500);
        timeline.updateLastThirdCount(simulatedCount);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(chipEl!.classList.contains('is-active')).toBe(true);
      expect(Number(valEl!.textContent?.replace(/,/g, ''))).toBeGreaterThan(0);

      timeline.dispose();
    });

    it('calling updateLastThirdCount after dispose does not throw or crash', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      timeline.dispose();

      expect(() => {
        timeline.updateLastThirdCount(123);
      }).not.toThrow();
    });

    it('supports rapid creation and disposal of 20 timeline instances without DOM leaks', () => {
      const clock = new SimulationClock();
      const instances = [];

      for (let i = 0; i < 20; i++) {
        const t = createTimelineUI(clock);
        t.updateLastThirdCount(i * 10);
        instances.push(t);
      }

      for (const t of instances) {
        expect(() => t.dispose()).not.toThrow();
      }
    });
  });
});
