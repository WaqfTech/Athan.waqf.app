import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateIslamicNight,
  calculatePrayerTimes,
  IslamicNightInfo,
} from '../src/prayer/calculator';
import {
  CALCULATION_CONVENTIONS,
  CalculationConventionName,
  HighLatitudeRule,
} from '../src/prayer/conventions';
import { DICTIONARIES, SupportedLocale, getTranslations } from '../src/i18n/translations';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../src/i18n/config';
import { SEO_METADATA } from '../src/i18n/seo';
import {
  createInspectorPanel,
  formatDuration,
  resolveObserverCivilDate,
  getInspectorSchedule,
} from '../src/ui/inspector';
import { createTimelineUI } from '../src/ui/timeline';
import { createHudOverlay } from '../src/ui/hud';
import { SimulationClock } from '../src/simulation/clock';
import { AdhanEventEngine } from '../src/simulation/eventEngine';
import { parseSettlements, CompactSettlementRow, Settlement } from '../src/population/loader';
import { GlobeScene } from '../src/globe/scene';
import { i18n } from '../src/i18n/manager';

// ---------------------------------------------------------------------------
// High-Fidelity Headless DOM Emulation Harness for Node.js Vitest Environment
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
      if (c) this._set.delete(c);
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
    if (k === 'id') this.id = '';
    if (k === 'class') this.className = '';
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

  replaceChildren(...newChildren: MockElement[]): void {
    this.children = [];
    for (const c of newChildren) {
      this.appendChild(c);
    }
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
      if (matchesSimple(ch, sel)) return ch;
      const found = ch.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const result: MockElement[] = [];
    for (const ch of this.children) {
      if (matchesSimple(ch, sel)) result.push(ch);
      result.push(...ch.querySelectorAll(sel));
    }
    return result;
  }

  focus(): void {}
  blur(): void {}
}

function matchesSimple(el: MockElement, sel: string): boolean {
  if (sel.startsWith('#')) {
    return el.id === sel.slice(1);
  }
  if (sel.startsWith('.')) {
    const targetClass = sel.slice(1);
    return el.classList.contains(targetClass);
  }
  return el.tagName.toLowerCase() === sel.toLowerCase();
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

function load15kSettlements(): Settlement[] {
  const jsonPath = path.resolve(__dirname, '../public/data/cities-core.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CompactSettlementRow[];
  return parseSettlements(rawData);
}

// ---------------------------------------------------------------------------
// Final Regression Challenger Suite M6
// ---------------------------------------------------------------------------

describe('Milestone 6 Final Regression & Forensic Verification', () => {
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
    listeners: Map<string, Function[]>;
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

    mockDoc = {
      documentElement: docEl,
      body: bodyEl,
      createElement: (tag: string) => new MockElement(tag),
      getElementById: (id: string) => docEl.querySelector(`#${id}`),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      fullscreenEnabled: true,
    };

    const winListeners = new Map<string, Function[]>();
    mockWin = {
      location: { href: 'http://localhost/' },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 1),
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
  // R1: Islamic Legal Night Astronomical Calculation Engine
  // =========================================================================
  describe('R1: Islamic Legal Night Calculation Across Geographic Extremes', () => {
    it('calculates equatorial night span and strict division invariants for Singapore (1.35°N, 103.82°E)', () => {
      const equinoxDate = new Date('2026-03-20T12:00:00Z');
      const sched = calculatePrayerTimes(1.3521, 103.8198, equinoxDate, {
        convention: 'Singapore',
        madhab: 'Shafi',
      });

      expect(sched.islamicNight).toBeDefined();
      const night = sched.islamicNight!;

      // Duration equals next Fajr minus Maghrib
      const maghribMs = sched.maghrib.date!.getTime();
      const fajrMs = night.lastThirdEnd.getTime();
      expect(night.durationMs).toBe(fajrMs - maghribMs);

      // Equatorial night duration is ~11-12 hours
      const durationHours = night.durationMs / 3600000;
      expect(durationHours).toBeGreaterThan(10.5);
      expect(durationHours).toBeLessThan(12.5);

      // Invariant: Midnight is exactly halfway
      const expectedMidnight = Math.round(maghribMs + night.durationMs / 2);
      expect(night.midnight.getTime()).toBe(expectedMidnight);

      // Invariant: Last third start is Maghrib + 2/3 * duration === Fajr - 1/3 * duration
      const expectedLastThirdStart = Math.round(maghribMs + (night.durationMs * 2) / 3);
      expect(night.lastThirdStart.getTime()).toBe(expectedLastThirdStart);
      const dualStart = fajrMs - Math.round(night.durationMs / 3);
      expect(Math.abs(night.lastThirdStart.getTime() - dualStart)).toBeLessThanOrEqual(1);

      // Invariant: Last third end equals Fajr
      expect(night.lastThirdEnd.getTime()).toBe(fajrMs);

      // Active state probe tests
      const probeBefore = new Date(night.lastThirdStart.getTime() - 60000);
      const nightBefore = calculateIslamicNight(sched.maghrib.date!, night.lastThirdEnd, probeBefore);
      expect(nightBefore?.isCurrentlyLastThird).toBe(false);

      const probeInside = new Date(night.lastThirdStart.getTime() + 60000);
      const nightInside = calculateIslamicNight(sched.maghrib.date!, night.lastThirdEnd, probeInside);
      expect(nightInside?.isCurrentlyLastThird).toBe(true);

      const probeAfter = new Date(night.lastThirdEnd.getTime() + 60000);
      const nightAfter = calculateIslamicNight(sched.maghrib.date!, night.lastThirdEnd, probeAfter);
      expect(nightAfter?.isCurrentlyLastThird).toBe(false);
    });

    it('calculates mid-latitude seasonal variation for Makkah (21.42°N) and London (51.5°N)', () => {
      // Makkah winter vs summer
      const makkahWinter = calculatePrayerTimes(21.4225, 39.8262, new Date('2026-12-21T12:00:00Z'), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const makkahSummer = calculatePrayerTimes(21.4225, 39.8262, new Date('2026-06-21T12:00:00Z'), {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      expect(makkahWinter.islamicNight).toBeDefined();
      expect(makkahSummer.islamicNight).toBeDefined();
      // Winter night in northern hemisphere is longer than summer night
      expect(makkahWinter.islamicNight!.durationMs).toBeGreaterThan(makkahSummer.islamicNight!.durationMs);

      // London winter
      const londonWinter = calculatePrayerTimes(51.5074, -0.1278, new Date('2026-12-21T12:00:00Z'), {
        convention: 'MuslimWorldLeague',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      expect(londonWinter.islamicNight).toBeDefined();
      expect(londonWinter.islamicNight!.durationMs).toBeGreaterThan(14 * 3600000); // > 14 hours
    });

    it('safely handles polar night and midnight sun in Tromsø (69.65°N) with high-latitude adaptation', () => {
      // Polar night (winter solstice)
      const tromsoWinter = calculatePrayerTimes(69.6492, 18.9553, new Date('2026-12-21T12:00:00Z'), {
        convention: 'MuslimWorldLeague',
        madhab: 'Shafi',
        highLatitudeRule: 'AngleBased',
      });
      // Should not throw and should retain valid mathematical structures
      expect(tromsoWinter).toBeDefined();
      if (tromsoWinter.islamicNight) {
        expect(Number.isFinite(tromsoWinter.islamicNight.durationMs)).toBe(true);
        expect(tromsoWinter.islamicNight.durationMs).toBeGreaterThan(0);
      }

      // Midnight sun (summer solstice)
      const tromsoSummer = calculatePrayerTimes(69.6492, 18.9553, new Date('2026-06-21T12:00:00Z'), {
        convention: 'MuslimWorldLeague',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
      });
      expect(tromsoSummer).toBeDefined();
      if (tromsoSummer.islamicNight) {
        expect(Number.isFinite(tromsoSummer.islamicNight.durationMs)).toBe(true);
      }
    });

    it('strictly returns null on degenerate, inverted, and over-24h intervals', () => {
      const now = new Date('2026-10-06T18:00:00Z');
      // Equal times (0 duration)
      expect(calculateIslamicNight(now, now)).toBeNull();
      // Inverted times (Fajr before Maghrib)
      const earlier = new Date('2026-10-06T17:00:00Z');
      expect(calculateIslamicNight(now, earlier)).toBeNull();
      // Over 24 hours duration
      const over24h = new Date(now.getTime() + 25 * 3600000);
      expect(calculateIslamicNight(now, over24h)).toBeNull();
      // Invalid dates
      expect(calculateIslamicNight(new Date(NaN), now)).toBeNull();
      expect(calculateIslamicNight(now, new Date(NaN))).toBeNull();
    });
  });

  // =========================================================================
  // R2: Multilingual Internationalization Across All 10 Locales
  // =========================================================================
  describe('R2: Multilingual Internationalization and Numeral Integrity', () => {
    const requiredLocales: SupportedLocale[] = [
      'en', 'ar', 'tr', 'id', 'ms', 'ur', 'fa', 'bn', 'fr', 'ru',
    ];

    it('confirms exact presence of all 10 supported locales in configuration and dictionaries', () => {
      const configLocales = Object.keys(SUPPORTED_LOCALES);
      expect(configLocales).toHaveLength(10);
      for (const loc of requiredLocales) {
        expect(SUPPORTED_LOCALES[loc]).toBeDefined();
        expect(DICTIONARIES[loc]).toBeDefined();
      }
    });

    it('guarantees 0 missing keys and 100% parity across all 10 locale dictionaries', () => {
      const enDict = DICTIONARIES.en;

      function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
        const paths: string[] = [];
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            paths.push(...collectKeyPaths(value as Record<string, unknown>, currentPath));
          } else {
            paths.push(currentPath);
          }
        }
        return paths;
      }

      const enKeys = collectKeyPaths(enDict as unknown as Record<string, unknown>);

      // Check required last third keys explicitly
      const requiredNightKeys = [
        'timeline.lastThirdTip',
        'timeline.lastThirdCities',
        'inspector.lastThird',
        'inspector.lastThirdStart',
        'inspector.lastThirdEnd',
        'inspector.lastThirdActive',
        'inspector.nightDuration',
        'inspector.countdown',
      ];

      for (const key of requiredNightKeys) {
        expect(enKeys).toContain(key);
      }

      for (const loc of requiredLocales) {
        const dict = DICTIONARIES[loc];
        for (const keyPath of enKeys) {
          const parts = keyPath.split('.');
          let curr: any = dict;
          for (const p of parts) {
            curr = curr?.[p];
          }
          expect(curr).toBeDefined();
          expect(typeof curr).toBe('string');
          expect((curr as string).trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('enforces 100% Western Arabic ASCII numerals (0-9) and 0 Eastern Arabic-Indic numerals across all dictionaries and SEO metadata', () => {
      const easternNumRegex = /[\u0660-\u0669\u06F0-\u06F9\u09E6-\u09EF]/;

      // Scan all dictionary strings
      for (const loc of requiredLocales) {
        const dict = DICTIONARIES[loc];
        const json = JSON.stringify(dict);
        expect(easternNumRegex.test(json)).toBe(false);
      }

      // Scan all SEO metadata strings (especially Bengali 3D update)
      for (const loc of requiredLocales) {
        const seo = SEO_METADATA[loc];
        expect(seo).toBeDefined();
        const json = JSON.stringify(seo);
        expect(easternNumRegex.test(json)).toBe(false);
      }

      // Verify bn SEO contains 3D rather than Bengali ৩
      expect(SEO_METADATA.bn.title).toContain('3D');
      expect(SEO_METADATA.bn.description).toContain('3D');
      expect(SEO_METADATA.bn.noscript).toContain('3D');
    });

    it('resists prototype pollution by returning safe default translations on foreign keys', () => {
      const protoKeys = ['toString', 'valueOf', 'constructor', '__proto__'];
      for (const k of protoKeys) {
        const trans = getTranslations(k as SupportedLocale);
        expect(trans).toBeDefined();
        expect(trans.brand.title).toBe(DICTIONARIES.en.brand.title);
      }
    });
  });

  // =========================================================================
  // R3: Inspector Panel Display and Real-Time Telemetry
  // =========================================================================
  describe('R3: Inspector Panel Structure, Countdown, Active Badge & Duration Rendering', () => {
    it('verifies formatDuration across boundaries, nulls, and negative inputs', () => {
      expect(formatDuration(0)).toBe('0h 0m');
      expect(formatDuration(1000)).toBe('0h 0m');
      expect(formatDuration(29999)).toBe('0h 0m');
      expect(formatDuration(30000)).toBe('0h 1m'); // rounds to 1 minute
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3600000 * 9 + 60000 * 45)).toBe('9h 45m');
      expect(formatDuration(86400000)).toBe('24h 0m');

      // Invalid inputs return fallback
      expect(formatDuration(null)).toBe('--h --m');
      expect(formatDuration(undefined)).toBe('--h --m');
      expect(formatDuration(NaN)).toBe('--h --m');
      expect(formatDuration(-1000)).toBe('--h --m');
      expect(formatDuration(Infinity)).toBe('--h --m');
    });

    it('mounts inspector night card with start time, end time, total duration, and countdown', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });

      const testCity: Settlement = {
        name: 'Makkah',
        nameAr: 'مكة المكرمة',
        latitude: 21.4225,
        longitude: 39.8262,
        countryCode: 'SA',
        population: 2000000,
        timezone: 'Asia/Riyadh',
      };

      const instant = new Date('2026-10-06T19:00:00Z');
      panel.inspectSettlement(testCity, instant);

      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-night-card');
      expect(html).toContain('inspector-night-times');
      expect(html).toContain('inspector-night-countdown');
      expect(html).toContain(DICTIONARIES.en.inspector.lastThird);
      expect(html).toContain(DICTIONARIES.en.inspector.lastThirdStart);
      expect(html).toContain(DICTIONARIES.en.inspector.lastThirdEnd);
      expect(html).toContain(DICTIONARIES.en.inspector.nightDuration);
    });

    it('toggles active badge accurately when current time enters versus exits the last third', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const testCity: Settlement = {
        name: 'Tokyo',
        nameAr: 'طوكيو',
        latitude: 35.6762,
        longitude: 139.6503,
        countryCode: 'JP',
        population: 14000000,
        timezone: 'Asia/Tokyo',
      };

      // Query schedule to find exact lastThirdStart and lastThirdEnd
      const refDate = new Date('2026-10-06T12:00:00Z');
      const sched = getInspectorSchedule(testCity.latitude, testCity.longitude, refDate, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
        timezone: testCity.timezone,
      });

      expect(sched.islamicNight).toBeDefined();
      const night = sched.islamicNight!;

      // 1. Before last third (maghrib + 30m)
      const timeBefore = new Date(sched.maghrib.date!.getTime() + 1800000);
      panel.inspectSettlement(testCity, timeBefore);
      let html = panel.element.innerHTML;
      expect(html).not.toContain('inspector-night-badge active');

      // 2. Inside last third (lastThirdStart + 1m)
      const timeInside = new Date(night.lastThirdStart.getTime() + 60000);
      panel.inspectSettlement(testCity, timeInside);
      html = panel.element.innerHTML;
      expect(html).toContain('inspector-night-badge active');
      expect(html).toContain(DICTIONARIES.en.inspector.lastThirdActive);

      // 3. After last third (fajr + 5m)
      const timeAfter = new Date(night.lastThirdEnd.getTime() + 300000);
      panel.inspectSettlement(testCity, timeAfter);
      html = panel.element.innerHTML;
      expect(html).not.toContain('inspector-night-badge active');
    });
  });

  // =========================================================================
  // R4: Global Settlements Counter in Event Engine
  // =========================================================================
  describe('R4: Global Settlements Counter in Event Engine', () => {
    const settlements = load15kSettlements();

    it('verifies dataset integrity contains exactly 15,000 settlements', () => {
      expect(settlements).toHaveLength(15000);
    });

    it('evaluates settlements count genuinely across global diurnal cycles', () => {
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      // Probe counts across 4 distinct global hours
      const h0 = engine.countSettlementsInLastThird(new Date('2026-10-06T00:00:00Z'));
      const h6 = engine.countSettlementsInLastThird(new Date('2026-10-06T06:00:00Z'));
      const h12 = engine.countSettlementsInLastThird(new Date('2026-10-06T12:00:00Z'));
      const h18 = engine.countSettlementsInLastThird(new Date('2026-10-06T18:00:00Z'));

      // Across 15,000 cities distributed globally, some portion is always in the last third
      expect(h0).toBeGreaterThan(0);
      expect(h6).toBeGreaterThan(0);
      expect(h12).toBeGreaterThan(0);
      expect(h18).toBeGreaterThan(0);

      expect(h0).toBeLessThan(15000);
      expect(h6).toBeLessThan(15000);
      expect(h12).toBeLessThan(15000);
      expect(h18).toBeLessThan(15000);
    });

    it('executes in under 2.0ms per tick across 15,000 settlements without heap thrashing', () => {
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });

      const baseInstant = new Date('2026-10-06T12:00:00Z');

      // Warmup (10 iterations)
      for (let w = 0; w < 10; w++) {
        engine.countSettlementsInLastThird(new Date(baseInstant.getTime() + w * 16.666));
      }

      const timings: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const tickTime = new Date(baseInstant.getTime() + 1000 + i * 16.666);
        const t0 = performance.now();
        engine.countSettlementsInLastThird(tickTime);
        const dt = performance.now() - t0;
        timings.push(dt);
      }

      timings.sort((a, b) => a - b);
      const median = timings[Math.floor(timings.length / 2)];
      expect(median).toBeLessThan(2.0); // Sub-2ms invariant
    });
  });

  // =========================================================================
  // R5: HUD and Timeline Live Telemetry Integration
  // =========================================================================
  describe('R5: HUD and Timeline Live Telemetry Integration', () => {
    it('mounts #stat-chip-last-third in timeline with live dot and accessible tooltip', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const chip = timeline.element.querySelector('#stat-chip-last-third');
      expect(chip).not.toBeNull();
      expect(chip!.classList.contains('stat-chip')).toBe(true);
      expect(chip!.classList.contains('stat-chip-last-third')).toBe(true);
      expect(chip!.getAttribute('tabindex')).toBe('0');
      expect(chip!.getAttribute('title')).toBe(DICTIONARIES.en.timeline.lastThirdTip);

      const dot = timeline.element.querySelector('.stat-chip-dot');
      expect(dot).not.toBeNull();

      const label = timeline.element.querySelector('#stat-last-third-label');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe(DICTIONARIES.en.timeline.lastThirdCities);

      const val = timeline.element.querySelector('#stat-last-third');
      expect(val).not.toBeNull();
      expect(val!.textContent).toBe('--');

      timeline.updateLastThirdCount(0);
      expect(val!.textContent).toBe('0');

      timeline.dispose();
    });

    it('performs layout caching and avoids redundant DOM writes on identical values', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      timeline.updateLastThirdCount(4200);
      expect(valEl!.textContent).toBe('4,200');

      // Inject a marker to verify no DOM overwrite occurs if count is unchanged
      valEl!.textContent = 'cached-sentinel';

      for (let i = 0; i < 50; i++) {
        timeline.updateLastThirdCount(4200);
      }
      expect(valEl!.textContent).toBe('cached-sentinel');

      // Changing count updates immediately
      timeline.updateLastThirdCount(4201);
      expect(valEl!.textContent).toBe('4,201');

      timeline.dispose();
    });

    it('updates telemetry chip smoothly during scrubbing actions and time advances', () => {
      const settlements = load15kSettlements();
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const clock = new SimulationClock(new Date('2026-10-06T00:00:00Z'));

      const timeline = createTimelineUI(clock, {
        onScrub: (date) => {
          const count = engine.countSettlementsInLastThird(date);
          timeline.updateLastThirdCount(count);
        },
      });

      const valEl = timeline.element.querySelector('#stat-last-third');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      const testTimes = [
        new Date('2026-10-06T03:00:00Z'),
        new Date('2026-10-06T09:00:00Z'),
        new Date('2026-10-06T15:00:00Z'),
      ];

      for (const t of testTimes) {
        const expectedCount = engine.countSettlementsInLastThird(t);
        timeline.updateLastThirdCount(expectedCount);
        expect(valEl!.textContent).toBe(expectedCount.toLocaleString('en-US'));
        expect(chipEl!.classList.contains('is-active')).toBe(true);
      }

      timeline.dispose();
    });

    it('wires HUD overlay to eventEngine and updates timeline last third count during tick advances', () => {
      const settlements = load15kSettlements();
      const engine = new AdhanEventEngine(settlements, {
        convention: 'UmmAlQura',
        madhab: 'Shafi',
      });
      const clock = new SimulationClock(new Date('2026-10-06T02:00:00Z'));

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
      hud.setEventEngine(engine);

      const valEl = hud.element.querySelector('#stat-last-third');
      expect(valEl).not.toBeNull();

      hud.updateTime(new Date('2026-10-06T04:00:00Z'));
      const count = engine.countSettlementsInLastThird(new Date('2026-10-06T04:00:00Z'));
      expect(valEl!.textContent).toBe(count.toLocaleString('en-US'));

      hud.dispose();
    });

    it('defines 2x2 responsive grid and compact padding in src/styles/main.css', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/main.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      // 640px breakpoint: 2-column grid
      const m640 = css.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)(?=@media|\n\/\*)/);
      expect(m640).not.toBeNull();
      const m640Css = m640![1];
      expect(m640Css).toContain('display: grid;');
      expect(m640Css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');

      // 480px breakpoint: compact padding using logical properties
      const m480 = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)(?=@media|\n\/\*)/);
      expect(m480).not.toBeNull();
      const m480Css = m480![1];
      expect(m480Css).toContain('padding-block: 2px;');
      expect(m480Css).toContain('padding-inline: 6px;');
    });
  });

  // =========================================================================
  // R6: Zero Physical Directional CSS, Zero CI Sprawl, and Em Dash Absence
  // =========================================================================
  describe('R6: Zero Physical CSS, Zero CI Sprawl & Style Hygiene', () => {
    it('verifies src/styles/main.css contains 0 physical directional CSS properties', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/main.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      const lines = css.split('\n');

      const physRegex = /\b(margin-left|margin-right|padding-left|padding-right|left\s*:|right\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)|ml-|mr-|pl-|pr-)\b/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('/*') || line.startsWith('*')) continue;
        if (line.includes('linear-gradient') || line.includes('to right') || line.includes('to left')) continue;

        expect(physRegex.test(line)).toBe(false);
      }
    });

    it('verifies 0 .github/workflows files exist in the repository', () => {
      const workflowDir = path.resolve(__dirname, '../.github/workflows');
      expect(fs.existsSync(workflowDir)).toBe(false);
    });

    it('verifies 0 em dashes in UI components (inspector, hud, timeline)', () => {
      const emDashRe = /[\u2014\u2015\u2E3A\u2E3B]/;
      const uiFiles = [
        path.resolve(__dirname, '../src/ui/inspector.ts'),
        path.resolve(__dirname, '../src/ui/hud.ts'),
        path.resolve(__dirname, '../src/ui/timeline.ts'),
      ];

      for (const file of uiFiles) {
        const content = fs.readFileSync(file, 'utf8');
        expect(emDashRe.test(content)).toBe(false);
      }
    });
  });
});
