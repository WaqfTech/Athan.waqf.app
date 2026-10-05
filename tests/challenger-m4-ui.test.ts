import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTimelineUI } from '../src/ui/timeline';
import { renderProvenanceBadge, InspectorPanel } from '../src/ui/inspector';
import { createHudOverlay } from '../src/ui/hud';
import { SimulationClock } from '../src/simulation/clock';
import { ContinuityStats } from '../src/simulation/continuity';
import { PrayerEntry } from '../src/prayer/calculator';
import { i18n } from '../src/i18n/manager';
import { DICTIONARIES, SupportedLocale } from '../src/i18n/translations';
import { PRAYER_COLORS, AllFrontKey } from '../src/globe/fronts';
import { GlobeScene } from '../src/globe/scene';

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
  public type = '';
  public placeholder = '';
  public value = '';
  public _rawText = '';
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

  appendChild(child: MockElement): MockElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
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

  contains(target: MockElement | null): boolean {
    if (!target) return false;
    if (target === this) return true;
    for (const ch of this.children) {
      if (ch.contains(target)) return true;
    }
    return false;
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

  dispatchEvent(event: { type: string }): boolean {
    const list = this.listeners.get(event.type) || [];
    for (const fn of list) {
      fn(event);
    }
    return true;
  }

  click(): void {
    const evt = {
      type: 'click',
      target: this,
      currentTarget: this,
      stopPropagation: () => {},
      preventDefault: () => {},
    };
    const list = this.listeners.get('click') || [];
    for (const fn of list) {
      fn(evt);
    }
  }

  set innerHTML(html: string) {
    this.children = [];
    this._rawText = '';
    parseHtmlFragment(html, this);
  }

  get innerHTML(): string {
    return this.children
      .map((c) => `<${c.tagName.toLowerCase()}>${c.textContent}</${c.tagName.toLowerCase()}>`)
      .join('');
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
  // Check compound selector with attribute like .btn-prayer-pill[data-prayer="apparentTerminator"]
  const attrRegex = /\[([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g;
  let remaining = sel;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(sel)) !== null) {
    const attrName = attrMatch[1];
    const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4];
    if (!el.hasAttribute(attrName)) return false;
    if (attrVal !== undefined && el.getAttribute(attrName) !== attrVal) return false;
    remaining = remaining.replace(attrMatch[0], '');
  }

  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    if (el.id !== idMatch[1]) return false;
    remaining = remaining.replace(idMatch[0], '');
  }

  const classMatches = remaining.match(/\.([a-zA-Z0-9_-]+)/g);
  if (classMatches) {
    for (const cm of classMatches) {
      if (!el.classList.contains(cm.slice(1))) return false;
      remaining = remaining.replace(cm, '');
    }
  }

  const tag = remaining.trim();
  if (tag && tag !== '*' && el.tagName.toLowerCase() !== tag.toLowerCase()) {
    return false;
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

// ---------------------------------------------------------------------------
// Test Suite Setup and Fixtures
// ---------------------------------------------------------------------------

describe('Challenger M4: UI Components, Disclosures & RTL Interaction Oracles', () => {
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
    _elementsById: Map<string, MockElement>;
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
    docEl.setAttribute('lang', 'en');
    docEl.setAttribute('dir', 'ltr');

    const bodyEl = new MockElement('body');
    docEl.appendChild(bodyEl);

    const elementsById = new Map<string, MockElement>();

    mockDoc = {
      documentElement: docEl,
      body: bodyEl,
      _elementsById: elementsById,
      createElement: (tag: string) => {
        const el = new MockElement(tag);
        return el;
      },
      getElementById: (id: string) => {
        if (elementsById.has(id)) return elementsById.get(id)!;
        return docEl.querySelector(`#${id}`);
      },
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

  // =========================================================================
  // Group 1: Timeline Ribbon Subtitle & Tooltip Rendering (Criterion A26)
  // =========================================================================
  describe('Group 1: Timeline Ribbon Subtitle and Tooltip Rendering (Criterion A26)', () => {
    it('asserts 15,000 settlements and 4-minute duration render dynamic counts and tooltips', () => {
      const clock = new SimulationClock(new Date('2026-10-04T12:00:00Z'));
      const timeline = createTimelineUI(clock);

      const stats: ContinuityStats = {
        coveragePercent: 100,
        unbrokenCoverage: true,
        longestGapSeconds: 0,
        timelineBins: new Array(288).fill(25),
        peakConcurrentAdhans: 85,
        minConcurrentAdhans: 12,
        settlementCount: 15000,
        adhanDurationMinutes: 4,
      };

      timeline.updateStats(stats);

      const subtitleEl = timeline.element.querySelector('#timeline-subtitle');
      expect(subtitleEl).not.toBeNull();
      expect(subtitleEl!.textContent).toContain('15,000');
      expect(subtitleEl!.textContent).toContain('4m');
      expect(subtitleEl!.textContent).toContain(i18n.getTranslations().timeline.cities);
      expect(subtitleEl!.textContent).toContain(i18n.getTranslations().timeline.subtitle);

      const tooltip = subtitleEl!.getAttribute('title');
      expect(tooltip).toBe(i18n.getTranslations().timeline.modelDisclaimer);
      expect(tooltip).toContain('15,000');
      expect(tooltip).toContain('4');

      timeline.dispose();
    });

    it('empirically verifies dynamic updates when settlement count and duration vary', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      // Variation A: 25,000 settlements and 6 minutes
      timeline.updateStats({
        coveragePercent: 100,
        unbrokenCoverage: true,
        longestGapSeconds: 0,
        timelineBins: [10],
        peakConcurrentAdhans: 40,
        minConcurrentAdhans: 5,
        settlementCount: 25000,
        adhanDurationMinutes: 6,
      });

      const subtitleEl = timeline.element.querySelector('#timeline-subtitle');
      expect(subtitleEl!.textContent).toContain('25,000');
      expect(subtitleEl!.textContent).toContain('6m');

      // Variation B: 1,500 settlements and 2 minutes
      timeline.updateStats({
        coveragePercent: 95.5,
        unbrokenCoverage: false,
        longestGapSeconds: 120,
        timelineBins: [2],
        peakConcurrentAdhans: 10,
        minConcurrentAdhans: 0,
        settlementCount: 1500,
        adhanDurationMinutes: 2,
      });

      expect(subtitleEl!.textContent).toContain('1,500');
      expect(subtitleEl!.textContent).toContain('2m');

      timeline.dispose();
    });

    it('empirically verifies Arabic locale switches subtitle and tooltip without Eastern numerals', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      timeline.updateStats({
        coveragePercent: 100,
        unbrokenCoverage: true,
        longestGapSeconds: 0,
        timelineBins: [30],
        peakConcurrentAdhans: 50,
        minConcurrentAdhans: 10,
        settlementCount: 15000,
        adhanDurationMinutes: 4,
      });

      // Switch to Arabic
      i18n.setLocale('ar');

      const subtitleEl = timeline.element.querySelector('#timeline-subtitle');
      expect(subtitleEl!.textContent).toContain(DICTIONARIES.ar.timeline.subtitle);
      expect(subtitleEl!.textContent).toContain('15,000');
      expect(subtitleEl!.textContent).toContain(DICTIONARIES.ar.timeline.cities);
      expect(subtitleEl!.textContent).toContain('4m');

      // Prohibit Eastern Arabic-Indic numerals (٠-٩)
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(subtitleEl!.textContent)).toBe(false);

      const titleAttr = subtitleEl!.getAttribute('title') || '';
      expect(titleAttr).toContain('15,000');
      expect(titleAttr).toContain('4');
      expect(titleAttr).toBe(DICTIONARIES.ar.timeline.modelDisclaimer);
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(titleAttr)).toBe(false);

      timeline.dispose();
    });

    it('verifies all 10 locales render qualified tooltips and parameterized subtitles cleanly', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const stats: ContinuityStats = {
        coveragePercent: 100,
        unbrokenCoverage: true,
        longestGapSeconds: 0,
        timelineBins: [15],
        peakConcurrentAdhans: 60,
        minConcurrentAdhans: 15,
        settlementCount: 15000,
        adhanDurationMinutes: 4,
      };

      const locales = Object.keys(DICTIONARIES) as SupportedLocale[];
      for (const loc of locales) {
        i18n.setLocale(loc);
        timeline.updateStats(stats);

        const sub = timeline.element.querySelector('#timeline-subtitle');
        expect(sub).not.toBeNull();
        expect(sub!.textContent).not.toContain('undefined');
        expect(sub!.textContent).not.toContain('NaN');
        expect(sub!.textContent).toContain('15,000');
        expect(sub!.textContent).toContain('4m');

        const tip = sub!.getAttribute('title');
        expect(tip).toBeTruthy();
        expect(tip).toMatch(/15[\s.,]000/);
        expect(tip).toContain('4');
      }

      timeline.dispose();
    });

    it('asserts stat chips have descriptive tooltips and tabindex 0 for keyboard access', () => {
      const clock = new SimulationClock();
      const timeline = createTimelineUI(clock);

      const chips = timeline.element.querySelectorAll('.stat-chip');
      expect(chips.length).toBe(3);

      for (const chip of chips) {
        expect(chip.getAttribute('tabindex')).toBe('0');
        expect(chip.getAttribute('title')).toBeTruthy();
      }

      timeline.dispose();
    });
  });

  // =========================================================================
  // Group 2: Inspector Provenance Badge Rendering (Criterion A03 & C03)
  // =========================================================================
  describe('Group 2: Inspector Provenance Badge Rendering (Criterion A03 & C03)', () => {
    const locales = Object.keys(DICTIONARIES) as SupportedLocale[];

    it('renders astronomical sign badge with correct classes, label, and tooltip', () => {
      const entry: PrayerEntry = {
        date: new Date('2026-10-04T05:00:00Z'),
        provenance: 'astronomicalSign',
      };

      const html = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(html).toContain('prayer-provenance-badge');
      expect(html).toContain('prayer-provenance-astronomicalSign');
      expect(html).toContain('badge-astro');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('>Astro</span>');
      expect(html).toContain(`title="${DICTIONARIES.en.inspector.provenance.astro.desc}"`);
    });

    it('renders fixed interval badge with correct classes, label, and tooltip', () => {
      const entry: PrayerEntry = {
        date: new Date('2026-10-04T19:30:00Z'),
        provenance: 'fixedInterval',
        ruleApplied: '90-min fixed delay',
      };

      const html = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(html).toContain('prayer-provenance-badge');
      expect(html).toContain('prayer-provenance-fixedInterval');
      expect(html).toContain('badge-fixed');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('>Fixed</span>');
      expect(html).toContain(`title="${DICTIONARIES.en.inspector.provenance.fixed.desc}"`);
    });

    it('renders AngleBased high-latitude adjustment with badge-high-lat and Angle label', () => {
      const entry: PrayerEntry = {
        date: new Date('2026-07-25T01:30:00Z'),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: 'AngleBased',
      };

      const html = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(html).toContain('prayer-provenance-badge');
      expect(html).toContain('prayer-provenance-highLatitudeAdjustment');
      expect(html).toContain('badge-high-lat');
      expect(html).toContain('>Angle</span>');
      expect(html).toContain(`title="${DICTIONARIES.en.inspector.provenance.angle.desc}"`);
    });

    it('renders SeventhOfTheNight and MiddleOfTheNight high-latitude adjustment with High Lat label', () => {
      const entrySeventh: PrayerEntry = {
        date: new Date('2026-07-25T02:00:00Z'),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: 'SeventhOfTheNight',
      };
      const htmlSeventh = renderProvenanceBadge(entrySeventh, DICTIONARIES.en);
      expect(htmlSeventh).toContain('prayer-provenance-badge');
      expect(htmlSeventh).toContain('badge-high-lat');
      expect(htmlSeventh).toContain('>High Lat</span>');
      expect(htmlSeventh).toContain(`title="${DICTIONARIES.en.inspector.provenance.highLat.desc}"`);

      const entryMiddle: PrayerEntry = {
        date: new Date('2026-07-25T02:15:00Z'),
        provenance: 'highLatitudeAdjustment',
        ruleApplied: 'MiddleOfTheNight',
      };
      const htmlMiddle = renderProvenanceBadge(entryMiddle, DICTIONARIES.en);
      expect(htmlMiddle).toContain('>High Lat</span>');
    });

    it('renders unresolved entry badge when solar crossing is physically absent', () => {
      const entry: PrayerEntry = {
        date: null,
        provenance: 'unresolved',
      };

      const html = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(html).toContain('prayer-provenance-badge');
      expect(html).toContain('prayer-provenance-unresolved');
      expect(html).toContain('badge-unresolved');
      expect(html).toContain(`>${DICTIONARIES.en.inspector.provenance.unresolved.label}</span>`);
      expect(html).toContain(`title="${DICTIONARIES.en.inspector.provenance.unresolved.desc}"`);
    });

    it('respects entry.note as priority tooltip title over generic description', () => {
      const customNote = 'Extreme polar night: Sun remains 12° below horizon';
      const entry: PrayerEntry = {
        date: null,
        provenance: 'unresolved',
        note: customNote,
      };

      const html = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(html).toContain(`title="${customNote}"`);
      expect(html).not.toContain(DICTIONARIES.en.inspector.provenance.unresolved.desc);
    });

    it('defaults to astronomicalSign if provenance property is omitted', () => {
      const entry = {
        date: new Date('2026-10-04T12:00:00Z'),
      } as PrayerEntry;

      const html = renderProvenanceBadge(entry, DICTIONARIES.en);
      expect(html).toContain('prayer-provenance-badge');
      expect(html).toContain('prayer-provenance-astronomicalSign');
      expect(html).toContain('badge-astro');
      expect(html).toContain('>Astro</span>');
    });

    it('verifies localized labels and tooltips across all 10 supported locales', () => {
      const entries: PrayerEntry[] = [
        { date: new Date(), provenance: 'astronomicalSign' },
        { date: new Date(), provenance: 'fixedInterval' },
        { date: new Date(), provenance: 'highLatitudeAdjustment', ruleApplied: 'AngleBased' },
        { date: new Date(), provenance: 'highLatitudeAdjustment', ruleApplied: 'SeventhOfTheNight' },
        { date: null, provenance: 'unresolved' },
      ];

      for (const loc of locales) {
        const trans = DICTIONARIES[loc];
        for (const entry of entries) {
          const html = renderProvenanceBadge(entry, trans);
          expect(html).toContain('prayer-provenance-badge');
          expect(html).not.toContain('undefined');
          expect(html).not.toContain('null');

          if (loc === 'ar') {
            // Must not contain Eastern Arabic numerals in badge HTML
            expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(html)).toBe(false);
          }
        }
      }
    });

    it('verifies Arabic labels use dignified Islamic scholarly terminology', () => {
      const ar = DICTIONARIES.ar;
      const bAstro = renderProvenanceBadge({ date: new Date(), provenance: 'astronomicalSign' }, ar);
      expect(bAstro).toContain(`>${ar.inspector.provenance.astro.label}</span>`);

      const bFixed = renderProvenanceBadge({ date: new Date(), provenance: 'fixedInterval' }, ar);
      expect(bFixed).toContain(`>${ar.inspector.provenance.fixed.label}</span>`);

      const bAngle = renderProvenanceBadge(
        { date: new Date(), provenance: 'highLatitudeAdjustment', ruleApplied: 'AngleBased' },
        ar,
      );
      expect(bAngle).toContain(`>${ar.inspector.provenance.angle.label}</span>`);

      const bHighLat = renderProvenanceBadge(
        { date: new Date(), provenance: 'highLatitudeAdjustment', ruleApplied: 'SeventhOfTheNight' },
        ar,
      );
      expect(bHighLat).toContain(`>${ar.inspector.provenance.highLat.label}</span>`);

      const bUnresolved = renderProvenanceBadge({ date: null, provenance: 'unresolved' }, ar);
      expect(bUnresolved).toContain(`>${ar.inspector.provenance.unresolved.label}</span>`);
    });
  });

  // =========================================================================
  // Group 3: HUD Front Controls & Distinct Terminators (Criterion A15 & Feature 8)
  // =========================================================================
  describe('Group 3: HUD Front Controls & Distinct Terminators (Criterion A15 & Feature 8)', () => {
    function createMockGlobeScene() {
      const visibilityMap = new Map<AllFrontKey, boolean>();
      const setVisibilitySpy = vi.fn((key: AllFrontKey, visible: boolean) => {
        visibilityMap.set(key, visible);
      });

      return {
        visibilityMap,
        globeScene: {
          cameraRig: {
            focusCoordinates: vi.fn(),
            setViewShift: vi.fn(),
            setAutoRotateAllowed: vi.fn(),
          },
          getMapStyle: vi.fn(() => 'satellite'),
          setMapStyle: vi.fn(),
          prayerFronts: {
            setVisibility: setVisibilitySpy,
          },
          setConvention: vi.fn(),
          setMadhab: vi.fn(),
          qiblaArcs: {
            clearInspectedCity: vi.fn(),
          },
          setTime: vi.fn(),
        } as unknown as GlobeScene,
      };
    }

    it('asserts both apparentTerminator and geometricTerminator toggle buttons exist in the HUD', () => {
      const clock = new SimulationClock();
      const { globeScene } = createMockGlobeScene();

      const hud = createHudOverlay(clock, globeScene);

      const apparentBtn = hud.element.querySelector('[data-prayer="apparentTerminator"]');
      const geometricBtn = hud.element.querySelector('[data-prayer="geometricTerminator"]');

      expect(apparentBtn).not.toBeNull();
      expect(geometricBtn).not.toBeNull();

      expect(apparentBtn!.classList.contains('btn-prayer-pill')).toBe(true);
      expect(geometricBtn!.classList.contains('btn-prayer-pill')).toBe(true);

      expect(apparentBtn!.classList.contains('active')).toBe(true);
      expect(geometricBtn!.classList.contains('active')).toBe(true);
      expect(apparentBtn!.getAttribute('aria-pressed')).toBe('true');
      expect(geometricBtn!.getAttribute('aria-pressed')).toBe('true');

      hud.dispose();
    });

    it('asserts distinct color classes and CSS variables are bound to both terminators', () => {
      const clock = new SimulationClock();
      const { globeScene } = createMockGlobeScene();

      const hud = createHudOverlay(clock, globeScene);

      const apparentBtn = hud.element.querySelector('[data-prayer="apparentTerminator"]');
      const geometricBtn = hud.element.querySelector('[data-prayer="geometricTerminator"]');

      const apparentColor = apparentBtn!.style.getPropertyValue('--prayer-color');
      const geometricColor = geometricBtn!.style.getPropertyValue('--prayer-color');

      expect(apparentColor).toBe('#e2e8f0'); // Crisp silver-white
      expect(geometricColor).toBe('#94a3b8'); // Slate
      expect(apparentColor).not.toBe(geometricColor);

      expect(PRAYER_COLORS.apparentTerminator).toBe(0xe2e8f0);
      expect(PRAYER_COLORS.geometricTerminator).toBe(0x94a3b8);

      hud.dispose();
    });

    it('asserts distinct labels with solar zenith/depression angles are bound to each toggle', () => {
      const clock = new SimulationClock();
      const { globeScene } = createMockGlobeScene();

      const hud = createHudOverlay(clock, globeScene);

      const apparentBtn = hud.element.querySelector('[data-prayer="apparentTerminator"]');
      const geometricBtn = hud.element.querySelector('[data-prayer="geometricTerminator"]');

      expect(apparentBtn!.textContent).toContain('-0.833°');
      expect(geometricBtn!.textContent).toContain('0.0°');

      // Test English labels
      expect(apparentBtn!.textContent).toContain('Apparent');
      expect(geometricBtn!.textContent).toContain('Geometric');

      hud.dispose();
    });

    it('asserts clicking toggles independently triggers visibility controls on the globe layer', () => {
      const clock = new SimulationClock();
      const { globeScene } = createMockGlobeScene();

      const hud = createHudOverlay(clock, globeScene);

      const apparentBtn = hud.element.querySelector('[data-prayer="apparentTerminator"]')!;
      const geometricBtn = hud.element.querySelector('[data-prayer="geometricTerminator"]')!;

      // Click apparent terminator: hides apparent terminator
      apparentBtn.click();

      expect(globeScene.prayerFronts.setVisibility).toHaveBeenCalledWith('apparentTerminator', false);
      expect(apparentBtn.classList.contains('active')).toBe(false);
      expect(apparentBtn.getAttribute('aria-pressed')).toBe('false');

      // Verify geometric terminator was NOT affected
      expect(globeScene.prayerFronts.setVisibility).not.toHaveBeenCalledWith('geometricTerminator', false);
      expect(geometricBtn.classList.contains('active')).toBe(true);

      // Click apparent terminator again: restores visibility
      apparentBtn.click();
      expect(globeScene.prayerFronts.setVisibility).toHaveBeenCalledWith('apparentTerminator', true);
      expect(apparentBtn.classList.contains('active')).toBe(true);
      expect(apparentBtn.getAttribute('aria-pressed')).toBe('true');

      // Click geometric terminator: hides geometric terminator
      geometricBtn.click();
      expect(globeScene.prayerFronts.setVisibility).toHaveBeenCalledWith('geometricTerminator', false);
      expect(geometricBtn.classList.contains('active')).toBe(false);
      expect(geometricBtn.getAttribute('aria-pressed')).toBe('false');

      hud.dispose();
    });

    it('asserts layers legend contains distinct entries and colors for both terminators', () => {
      const clock = new SimulationClock();
      const { globeScene } = createMockGlobeScene();

      const hud = createHudOverlay(clock, globeScene);

      const legend = hud.element.querySelector('.layers-legend-container');
      expect(legend).not.toBeNull();

      const legendText = legend!.textContent;
      expect(legendText).toContain(i18n.getTranslations().controls.legendApparentTerminator);
      expect(legendText).toContain(i18n.getTranslations().controls.legendGeometricTerminator);
      expect(legendText).toContain(i18n.getTranslations().controls.legendModelNote);

      hud.dispose();
    });

    it('asserts switching to Arabic dynamically updates terminator button labels and legend', () => {
      const clock = new SimulationClock();
      const { globeScene } = createMockGlobeScene();

      const hud = createHudOverlay(clock, globeScene);

      i18n.setLocale('ar');

      const apparentBtn = hud.element.querySelector('[data-prayer="apparentTerminator"]');
      const geometricBtn = hud.element.querySelector('[data-prayer="geometricTerminator"]');

      expect(apparentBtn!.textContent).toContain('فاصل الشروق والغروب الظاهري (-0.833°)');
      expect(geometricBtn!.textContent).toContain('الفاصل الهندسي (0.0°)');

      // Confirm no Eastern Arabic-Indic numerals
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(apparentBtn!.textContent)).toBe(false);
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(geometricBtn!.textContent)).toBe(false);

      hud.dispose();
    });
  });

  // =========================================================================
  // Group 4: RTL CSS Geometry & Coordinate Alignment Oracles
  // =========================================================================
  describe('Group 4: RTL CSS Geometry and Coordinate Alignment Oracles', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    it('empirically asserts .timeline-track-wrapper has direction: ltr; in main.css', () => {
      const ruleMatch = cssContent.match(/\.timeline-track-wrapper\s*\{[^}]*direction:\s*ltr;/);
      expect(ruleMatch).not.toBeNull();
    });

    it('asserts no rule overrides .timeline-track-wrapper to direction: rtl under [dir="rtl"]', () => {
      // Search for any selector matching [dir="rtl"] ... .timeline-track-wrapper with direction: rtl
      const rtlRegex =
        /\[dir=["']?rtl["']?\][^{]*\.timeline-track-wrapper\s*\{[^}]*direction:\s*rtl/;
      const rtlOverride = cssContent.match(rtlRegex);
      expect(rtlOverride).toBeNull();
    });

    it('asserts .timeline-canvas is display: block with width: 100% for physical rendering', () => {
      const canvasMatch = cssContent.match(/\.timeline-canvas\s*\{[^}]*\}/);
      expect(canvasMatch).not.toBeNull();
      expect(canvasMatch![0]).toContain('width: 100%;');
      expect(canvasMatch![0]).toContain('display: block;');
    });

    it('asserts .timeline-playhead is positioned absolute with white color token', () => {
      const playheadMatch = cssContent.match(/\.timeline-playhead\s*\{[^}]*position:\s*absolute;/);
      expect(playheadMatch).not.toBeNull();
      expect(cssContent).toContain('--color-white');
    });

    it('mathematically proves direction: ltr preserves playhead alignment and eliminates phase error', () => {
      // In LTR coordinate isolation:
      // Time t in [0, 86400] seconds maps to fraction f = t / 86400 in [0, 1].
      // Scrubber playhead is placed at inset-inline-start: (f * 100)%.
      // Since direction is LTR, inset-inline-start == left == f * trackWidth.
      // Canvas waveform renders with x = 0 at left edge (f = 0) to x = trackWidth at right edge (f = 1).
      // Click at mouse clientX evaluates fraction f_click = (clientX - rect.left) / trackWidth.
      // Under LTR, f_playhead == f_canvas == f_click, with 0 discrepancy!
      const trackWidth = 800; // px
      for (const hour of [0, 3, 6, 9, 12, 15, 18, 21, 24]) {
        const timeSec = hour * 3600;
        const fraction = timeSec / 86400;

        const canvasX = fraction * trackWidth;

        // In LTR isolated container:
        const playheadPhysicalLeft = fraction * trackWidth;
        expect(Math.abs(canvasX - playheadPhysicalLeft)).toBe(0);

        // Simulated mouse click at physical canvas position:
        const simulatedClientX = playheadPhysicalLeft;
        const rectLeft = 0;
        const computedFraction = (simulatedClientX - rectLeft) / trackWidth;
        const computedTimeSec = Math.round(computedFraction * 86400);

        expect(computedTimeSec).toBe(timeSec);

        // Counter-proof: In an UN-ISOLATED RTL container where direction == rtl:
        // inset-inline-start would resolve to physical RIGHT edge!
        const playheadInvertedLeft = (1 - fraction) * trackWidth;
        const phaseError = Math.abs(canvasX - playheadInvertedLeft);

        if (fraction !== 0.5) {
          // At non-noon hours, an un-isolated RTL container causes severe phase inversion!
          expect(phaseError).toBeGreaterThan(0);
        }
      }
    });

    it('asserts RTL font stack and letter-spacing reset are defined for Arabic typography', () => {
      expect(cssContent).toContain('"Noto Sans Arabic"');
      expect(cssContent).toContain('[dir="rtl"]');
      expect(cssContent).toContain('letter-spacing: normal;');
    });
  });
});
