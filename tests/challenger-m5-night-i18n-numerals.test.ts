import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimelineUI } from '../src/ui/timeline';
import { SimulationClock } from '../src/simulation/clock';
import { i18n } from '../src/i18n/manager';
import { DICTIONARIES, SupportedLocale } from '../src/i18n/translations';
import { SUPPORTED_LOCALES } from '../src/i18n/config';

// ---------------------------------------------------------------------------
// High-Fidelity Minimal DOM Emulation for Headless Node Environment
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

  const idMatch = sel.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && el.id !== idMatch[1]) return false;

  const classMatches = sel.match(/\.([a-zA-Z0-9_-]+)/g);
  if (classMatches) {
    for (const cm of classMatches) {
      if (!el.classList.contains(cm.slice(1))) return false;
    }
  }

  return true;
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

describe('Challenger M5-2: Multilingual Dictionary Integrity & Western Numeral Compliance', () => {
  const supportedLocales: SupportedLocale[] = [
    'en',
    'ar',
    'fr',
    'tr',
    'ur',
    'fa',
    'bn',
    'id',
    'ms',
    'ru',
  ];

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
  };

  beforeEach(() => {
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
    };

    (globalThis as unknown as { document: unknown }).document = mockDoc;
    (globalThis as unknown as { window: unknown }).window = {
      innerWidth: 1024,
      innerHeight: 768,
      document: mockDoc,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };

    i18n.setLocale('en');
  });

  afterEach(() => {
    (globalThis as unknown as { document: unknown }).document = originalDocument;
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = originalResizeObserver;
    i18n.setLocale('en');
  });

  describe('Suite 1: Multilingual Dictionary Integrity Across 10 Locales', () => {
    it('verifies all 10 supported locales exist in config and translations', () => {
      expect(supportedLocales).toHaveLength(10);
      for (const loc of supportedLocales) {
        expect(SUPPORTED_LOCALES[loc]).toBeDefined();
        expect(DICTIONARIES[loc]).toBeDefined();
      }
    });

    it('verifies non-empty, non-null, defined last third strings across all 10 locales', () => {
      for (const loc of supportedLocales) {
        const trans = DICTIONARIES[loc];
        expect(trans.timeline.lastThirdCities).toBeDefined();
        expect(typeof trans.timeline.lastThirdCities).toBe('string');
        expect(trans.timeline.lastThirdCities.trim().length).toBeGreaterThan(0);

        expect(trans.timeline.lastThirdTip).toBeDefined();
        expect(typeof trans.timeline.lastThirdTip).toBe('string');
        expect(trans.timeline.lastThirdTip.trim().length).toBeGreaterThan(0);

        expect(trans.stats.citiesInLastThird).toBeDefined();
        expect(typeof trans.stats.citiesInLastThird).toBe('string');
        expect(trans.stats.citiesInLastThird.trim().length).toBeGreaterThan(0);

        expect(trans.stats.lastThirdTip).toBeDefined();
        expect(typeof trans.stats.lastThirdTip).toBe('string');
        expect(trans.stats.lastThirdTip.trim().length).toBeGreaterThan(0);
      }
    });

    it('verifies distinct localized terms for non-English locales without fallback artifacts', () => {
      const enLabel = DICTIONARIES.en.timeline.lastThirdCities;
      const enTip = DICTIONARIES.en.timeline.lastThirdTip;

      for (const loc of supportedLocales) {
        if (loc === 'en') continue;
        const trans = DICTIONARIES[loc];
        // Non-English languages should not return identical English label
        expect(trans.timeline.lastThirdCities).not.toBe(enLabel);
        expect(trans.timeline.lastThirdTip).not.toBe(enTip);
        // Verify no placeholder strings like undefined or null
        expect(trans.timeline.lastThirdCities).not.toMatch(/undefined|null|\[object/i);
        expect(trans.timeline.lastThirdTip).not.toMatch(/undefined|null|\[object/i);
      }
    });
  });

  describe('Suite 2: Reactive UI Locale Switching Across All 10 Locales', () => {
    it('reactively updates label and tooltip attribute when switching through all 10 locales sequentially', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const labelEl = timeline.element.querySelector('#stat-last-third-label');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      expect(labelEl).not.toBeNull();
      expect(chipEl).not.toBeNull();

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);
        const dict = DICTIONARIES[loc];

        expect(labelEl!.textContent).toBe(dict.timeline.lastThirdCities);
        expect(chipEl!.getAttribute('title')).toBe(dict.timeline.lastThirdTip);
        expect(labelEl!.textContent).not.toBe('');
        expect(chipEl!.getAttribute('title')).not.toBe('');
      }

      timeline.dispose();
    });

    it('reactively updates label and tooltip when switching in reverse and random permutations', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const labelEl = timeline.element.querySelector('#stat-last-third-label');
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      const reverseLocales = [...supportedLocales].reverse();
      for (const loc of reverseLocales) {
        i18n.setLocale(loc);
        const dict = DICTIONARIES[loc];
        expect(labelEl!.textContent).toBe(dict.timeline.lastThirdCities);
        expect(chipEl!.getAttribute('title')).toBe(dict.timeline.lastThirdTip);
      }

      const randomOrder: SupportedLocale[] = ['fa', 'ru', 'ar', 'id', 'bn', 'fr', 'ur', 'ms', 'tr', 'en'];
      for (const loc of randomOrder) {
        i18n.setLocale(loc);
        const dict = DICTIONARIES[loc];
        expect(labelEl!.textContent).toBe(dict.timeline.lastThirdCities);
        expect(chipEl!.getAttribute('title')).toBe(dict.timeline.lastThirdTip);
      }

      timeline.dispose();
    });
  });

  describe('Suite 3: Western Arabic Numeral Compliance (0-9 with Comma Separators)', () => {
    it('renders counts 0, 15, 1240, 15000 in Arabic and Persian with zero Eastern numerals', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      expect(valEl).not.toBeNull();

      const testCounts = [
        { count: 0, expected: '0' },
        { count: 15, expected: '15' },
        { count: 1240, expected: '1,240' },
        { count: 15000, expected: '15,000' },
      ];

      for (const loc of ['ar', 'fa'] as const) {
        i18n.setLocale(loc);

        for (const { count, expected } of testCounts) {
          timeline.updateLastThirdCount(count);
          const text = valEl!.textContent;

          // Must strictly equal Western formatted expected string
          expect(text).toBe(expected);

          // Must NOT contain Eastern Arabic (0660-0669) or Persian (06F0-06F9) numerals
          expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(text)).toBe(false);

          // Must match standard Western digit format with comma thousands separators
          expect(text).toMatch(/^[0-9]+(,[0-9]{3})*$/);
        }
      }

      timeline.dispose();
    });

    it('enforces Western numeral compliance across all 10 locales for extensive counts', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      const edgeCounts = [
        { count: 0, expected: '0' },
        { count: 1, expected: '1' },
        { count: 999, expected: '999' },
        { count: 1000, expected: '1,000' },
        { count: 14999, expected: '14,999' },
        { count: 15000, expected: '15,000' },
        { count: 1000000, expected: '1,000,000' },
      ];

      for (const loc of supportedLocales) {
        i18n.setLocale(loc);

        for (const { count, expected } of edgeCounts) {
          timeline.updateLastThirdCount(count);
          const text = valEl!.textContent;

          expect(text).toBe(expected);
          expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(text)).toBe(false);
          expect(text).toMatch(/^[0-9]+(,[0-9]{3})*$/);
        }
      }

      timeline.dispose();
    });

    it('handles negative, non-finite, and decimal counts safely with Western digits', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      i18n.setLocale('ar');

      // Clamps negative numbers to 0
      timeline.updateLastThirdCount(-25);
      expect(valEl!.textContent).toBe('0');
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(valEl!.textContent)).toBe(false);

      // Floors fractional numbers
      timeline.updateLastThirdCount(1240.85);
      expect(valEl!.textContent).toBe('1,240');
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(valEl!.textContent)).toBe(false);

      // Clamps NaN to 0
      timeline.updateLastThirdCount(Number.NaN);
      expect(valEl!.textContent).toBe('0');
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(valEl!.textContent)).toBe(false);

      timeline.dispose();
    });
  });

  describe('Suite 4: Telemetry State Coherence and Active Badge Transitions', () => {
    it('accurately toggles is-active class on stat-chip-last-third', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const chipEl = timeline.element.querySelector('#stat-chip-last-third');

      expect(chipEl!.classList.contains('is-active')).toBe(false);

      timeline.updateLastThirdCount(15);
      expect(chipEl!.classList.contains('is-active')).toBe(true);

      timeline.updateLastThirdCount(0);
      expect(chipEl!.classList.contains('is-active')).toBe(false);

      timeline.updateLastThirdCount(1240);
      expect(chipEl!.classList.contains('is-active')).toBe(true);

      timeline.dispose();
    });

    it('preserves rendered count when switching locales without re-invoking counter', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);
      const valEl = timeline.element.querySelector('#stat-last-third');

      timeline.updateLastThirdCount(15000);
      expect(valEl!.textContent).toBe('15,000');

      i18n.setLocale('ar');
      expect(valEl!.textContent).toBe('15,000');

      i18n.setLocale('fa');
      expect(valEl!.textContent).toBe('15,000');

      i18n.setLocale('ru');
      expect(valEl!.textContent).toBe('15,000');

      timeline.dispose();
    });
  });
});
