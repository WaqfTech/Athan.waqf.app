import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInspectorPanel, formatDuration, getInspectorSchedule } from '../src/ui/inspector';
import { Settlement } from '../src/population/loader';
import { i18n } from '../src/i18n/manager';
import { DICTIONARIES, SupportedLocale } from '../src/i18n/translations';
import * as fs from 'fs';
import * as path from 'path';

describe('Challenger M3 Suite 1: Mathematical Boundary Stress on formatDuration', () => {
  it('handles zero, sub-minute, multi-day, negative, and non-finite millisecond inputs cleanly', () => {
    expect(formatDuration(0)).toBe('0h 0m');
    expect(formatDuration(1000)).toBe('0h 0m');
    expect(formatDuration(29999)).toBe('0h 0m');
    expect(formatDuration(30000)).toBe('0h 1m'); // Rounding threshold
    expect(formatDuration(59999)).toBe('0h 1m');
    expect(formatDuration(60000)).toBe('0h 1m');
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(3660000)).toBe('1h 1m');
    expect(formatDuration(86400000)).toBe('24h 0m');
    expect(formatDuration(86400000 * 5 + 3600000 * 7 + 60000 * 42)).toBe('127h 42m');

    // Invalid or edge inputs
    expect(formatDuration(null)).toBe('--h --m');
    expect(formatDuration(undefined)).toBe('--h --m');
    expect(formatDuration(NaN)).toBe('--h --m');
    expect(formatDuration(-1)).toBe('--h --m');
    expect(formatDuration(-3600000)).toBe('--h --m');
    expect(formatDuration(Infinity)).toBe('--h --m');
    expect(formatDuration(-Infinity)).toBe('--h --m');
  });

  it('guarantees zero Eastern Arabic-Indic numerals across 1,000 randomized durations', () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 1000; i++) {
      const ms = Math.floor(rnd() * 86400000 * 2);
      const res = formatDuration(ms);
      expect(/[\u0660-\u0669\u06F0-\u06F9]/.test(res)).toBe(false);
      expect(res).toMatch(/^\d+h \d+m$/);
    }
  });
});

describe('Challenger M3 Suite 2: Adversarial Inspector Panel Lifecycle and Boundary Testing', () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    const createFakeElement = (tag: string) => {
      const el: Record<string, unknown> = {
        tagName: tag.toUpperCase(),
        className: '',
        style: { display: '' },
        innerHTML: '',
        children: [] as unknown[],
        classList: {
          add: (cls: string) => {
            if (!el.className) el.className = cls;
            else if (!el.className.split(' ').includes(cls)) el.className += ` ${cls}`;
          },
          remove: (cls: string) => {
            el.className = (el.className as string)
              .split(' ')
              .filter((c) => c !== cls)
              .join(' ');
          },
          contains: (cls: string) => (el.className as string).split(' ').includes(cls),
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild: (child: unknown) => {
          (el.children as unknown[]).push(child);
          return child;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        remove: () => {},
      };
      return el;
    };

    globalThis.document = {
      createElement: (tag: string) => createFakeElement(tag),
      documentElement: { lang: 'en', dir: 'ltr' },
    } as unknown as Document;
  });

  afterEach(() => {
    i18n.setLocale('en');
    globalThis.document = originalDocument;
  });

  const makkahSettlement: Settlement = {
    name: 'Makkah',
    nameAr: 'مكة المكرمة',
    latitude: 21.4225,
    longitude: 39.8262,
    countryCode: 'SA',
    population: 2000000,
    timezone: 'Asia/Riyadh',
  };

  it('empirically verifies 1ms boundary transitions around lastThirdStart and lastThirdEnd', () => {
    const baseInstant = new Date('2026-10-04T18:00:00Z');
    const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
    panel.inspectSettlement(makkahSettlement, baseInstant);

    const sched = getInspectorSchedule(21.4225, 39.8262, baseInstant, {
      convention: 'UmmAlQura',
      madhab: 'Shafi',
      timezone: 'Asia/Riyadh',
    });
    expect(sched.islamicNight).toBeDefined();
    const startMs = sched.islamicNight!.lastThirdStart.getTime();
    const endMs = sched.islamicNight!.lastThirdEnd.getTime();

    // 1ms before start: NOT active, countdown shows 00:00:01 (Math.ceil or floor of remaining ms)
    panel.updateTime(new Date(startMs - 1000));
    expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
    expect(panel.element.innerHTML).not.toContain('inspector-night-card active');
    expect(panel.element.innerHTML).toContain('00:00:01');

    // Exactly at start: ACTIVE
    panel.updateTime(new Date(startMs));
    expect(panel.element.innerHTML).toContain('inspector-night-badge active');
    expect(panel.element.innerHTML).toContain('inspector-night-card active');

    // Midpoint of last third: ACTIVE
    const midLastThirdMs = Math.round((startMs + endMs) / 2);
    panel.updateTime(new Date(midLastThirdMs));
    expect(panel.element.innerHTML).toContain('inspector-night-badge active');
    expect(panel.element.innerHTML).toContain('inspector-night-card active');

    // 1ms before end: ACTIVE
    panel.updateTime(new Date(endMs - 1));
    expect(panel.element.innerHTML).toContain('inspector-night-badge active');
    expect(panel.element.innerHTML).toContain('inspector-night-card active');

    // Exactly at end (Fajr): INACTIVE (transitions to upcoming night)
    panel.updateTime(new Date(endMs));
    expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
    expect(panel.element.innerHTML).not.toContain('inspector-night-card active');

    panel.dispose();
  });

  it('adversarially stress-tests second-by-second scrub across 60 seconds with monotonic countdown', () => {
    const baseInstant = new Date('2026-10-04T22:00:00Z');
    const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
    panel.inspectSettlement(makkahSettlement, baseInstant);

    let lastSec = -1;
    for (let step = 0; step < 60; step++) {
      const t = new Date(baseInstant.getTime() + step * 1000);
      panel.updateTime(t);
      const html = panel.element.innerHTML;
      const match = html.match(/class="inspector-night-countdown-value">(\d{2}):(\d{2}):(\d{2})</);
      expect(match).not.toBeNull();
      if (match) {
        const totalSec = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
        if (lastSec !== -1) {
          // Monotonically decreasing countdown
          expect(lastSec - totalSec).toBe(1);
        }
        lastSec = totalSec;
      }
    }
    panel.dispose();
  });

  it('verifies graceful degradation in extreme polar coordinates without errors or NaNs', () => {
    const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });

    // Polar night (winter in Tromsø, Norway and Longyearbyen, Svalbard)
    const polarLocations = [
      { name: 'Tromso', lat: 69.65, lon: 18.96, date: new Date('2026-12-21T12:00:00Z') },
      { name: 'Svalbard', lat: 78.22, lon: 15.65, date: new Date('2026-12-21T12:00:00Z') },
      { name: 'Alert Canada', lat: 82.50, lon: -62.34, date: new Date('2026-12-21T12:00:00Z') },
      // Midnight sun (summer in Arctic)
      { name: 'Tromso Summer', lat: 69.65, lon: 18.96, date: new Date('2026-06-21T12:00:00Z') },
    ];

    for (const loc of polarLocations) {
      panel.inspectCoordinates(loc.lat, loc.lon, loc.date);
      const html = panel.element.innerHTML;
      expect(html).toContain('inspector-night-card');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('[object Object]');
    }

    panel.dispose();
  });
});

describe('Challenger M3 Suite 3: Multilingual and CSS Logical Property Verification', () => {
  it('empirically verifies dictionary coverage across all 10 locales', () => {
    const locales: SupportedLocale[] = ['ar', 'en', 'fr', 'tr', 'ur', 'fa', 'bn', 'id', 'ms', 'ru'];
    for (const loc of locales) {
      const dict = DICTIONARIES[loc];
      expect(dict.inspector.lastThird, `Missing lastThird in ${loc}`).toBeTruthy();
      expect(dict.inspector.nightDuration, `Missing nightDuration in ${loc}`).toBeTruthy();
      expect(dict.inspector.lastThirdStart, `Missing lastThirdStart in ${loc}`).toBeTruthy();
      expect(dict.inspector.lastThirdEnd, `Missing lastThirdEnd in ${loc}`).toBeTruthy();
      expect(dict.inspector.lastThirdActive, `Missing lastThirdActive in ${loc}`).toBeTruthy();
      expect(dict.inspector.countdown, `Missing countdown in ${loc}`).toBeTruthy();
    }
  });

  it('scans src/styles/main.css for physical directional properties in inspector night card selectors', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Extract the section for inspector night card
    const startIdx = cssContent.indexOf('/* Last Third of the Night Inspector Card */');
    expect(startIdx).toBeGreaterThan(-1);
    const endIdx = cssContent.indexOf('/* Prayer Provenance Badges */', startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);

    const nightCss = cssContent.slice(startIdx, endIdx);

    // Assert strictly zero forbidden physical properties in this block
    expect(nightCss).not.toMatch(/\bmargin-left\b/);
    expect(nightCss).not.toMatch(/\bmargin-right\b/);
    expect(nightCss).not.toMatch(/\bpadding-left\b/);
    expect(nightCss).not.toMatch(/\bpadding-right\b/);
    expect(nightCss).not.toMatch(/\bborder-left\b/);
    expect(nightCss).not.toMatch(/\bborder-right\b/);
    expect(nightCss).not.toMatch(/\btext-align:\s*left\b/);
    expect(nightCss).not.toMatch(/\btext-align:\s*right\b/);

    // Assert presence of mandatory logical properties
    expect(nightCss).toMatch(/\bpadding-inline\b/);
    expect(nightCss).toMatch(/\bpadding-block\b/);
    expect(nightCss).toMatch(/\bborder-inline-start\b/);
    expect(nightCss).toMatch(/\btext-align:\s*start\b/);
    expect(nightCss).toMatch(/\btext-align:\s*end\b/);
  });
});
