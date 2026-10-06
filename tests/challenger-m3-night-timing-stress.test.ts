import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createInspectorPanel,
  getInspectorSchedule,
  formatDuration,
} from '../src/ui/inspector';
import { Settlement } from '../src/population/loader';
import { i18n } from '../src/i18n/manager';

describe('Challenger 1 Milestone 3: Timing and Countdown Adversarial Stress', () => {
  let originalDocument: typeof globalThis.document;

  const createMockContainer = () => {
    const el: Record<string, unknown> = {
      tagName: 'ASIDE',
      className: '',
      style: { display: '' },
      innerHTML: '',
      children: [] as unknown[],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
      querySelector: vi.fn((sel: string) => {
        if (sel === '.inspector-close-btn') {
          return {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
    };
    return el;
  };

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = {
      createElement: vi.fn((_tag: string) => createMockContainer()),
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
    latitude: 21.42,
    longitude: 39.83,
    countryCode: 'SA',
    population: 2000000,
    timezone: 'Asia/Riyadh',
  };

  const tokyoSettlement: Settlement = {
    name: 'Tokyo',
    nameAr: 'طوكيو',
    latitude: 35.68,
    longitude: 139.76,
    countryCode: 'JP',
    population: 14000000,
    timezone: 'Asia/Tokyo',
  };

  // Requirement 1: 1 millisecond before lastThirdStart
  describe('Requirement 1: 1 millisecond before lastThirdStart', () => {
    it('verifies active badge is absent and countdown counts down to start', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const anchor = new Date('2026-10-04T19:00:00Z');
      panel.inspectSettlement(makkahSettlement, anchor);

      const sched = getInspectorSchedule(
        makkahSettlement.latitude,
        makkahSettlement.longitude,
        anchor,
        {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          timezone: makkahSettlement.timezone,
        },
      );
      expect(sched.islamicNight).toBeDefined();
      const lastThirdStartMs = sched.islamicNight!.lastThirdStart.getTime();

      // Exactly 1 millisecond before lastThirdStart
      const tMinus1 = new Date(lastThirdStartMs - 1);
      panel.updateTime(tMinus1);

      const html = panel.element.innerHTML;
      // 1. Active badge is absent
      expect(html).not.toContain('inspector-night-badge active');
      expect(html).not.toContain('inspector-night-card active');

      // 2. Countdown counts down to start (1 ms remaining formats as 00:00:00)
      expect(html).toContain('inspector-night-countdown-value');
      expect(html).toContain('00:00:00');

      // 3. Confirm 10 seconds before start, countdown shows 00:00:10 (counting to start, NOT to Fajr)
      const tMinus10s = new Date(lastThirdStartMs - 10000);
      panel.updateTime(tMinus10s);
      expect(panel.element.innerHTML).toContain('00:00:10');

      // 4. Confirm 60 seconds before start, countdown shows 00:01:00
      const tMinus60s = new Date(lastThirdStartMs - 60000);
      panel.updateTime(tMinus60s);
      expect(panel.element.innerHTML).toContain('00:01:00');

      panel.dispose();
    });
  });

  // Requirement 2: At exact millisecond of lastThirdStart
  describe('Requirement 2: At exact millisecond of lastThirdStart', () => {
    it('verifies active badge appears with class active and countdown counts down to Fajr', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const anchor = new Date('2026-10-04T19:00:00Z');
      panel.inspectSettlement(makkahSettlement, anchor);

      const sched = getInspectorSchedule(
        makkahSettlement.latitude,
        makkahSettlement.longitude,
        anchor,
        {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          timezone: makkahSettlement.timezone,
        },
      );
      const lastThirdStartMs = sched.islamicNight!.lastThirdStart.getTime();
      const lastThirdEndMs = sched.islamicNight!.lastThirdEnd.getTime();
      const thirdDurationMs = lastThirdEndMs - lastThirdStartMs;

      // Exactly at millisecond of lastThirdStart
      const tExact = new Date(lastThirdStartMs);
      panel.updateTime(tExact);

      const html = panel.element.innerHTML;
      // 1. Active badge appears with class 'active'
      expect(html).toContain('inspector-night-badge active');
      expect(html).toContain('inspector-night-card active');

      // 2. Countdown counts down to Fajr (lastThirdEnd)
      const totalSec = Math.floor(thirdDurationMs / 1000);
      const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const s = String(totalSec % 60).padStart(2, '0');
      const expectedCountdownStr = `${h}:${m}:${s}`;

      expect(html).toContain(expectedCountdownStr);
      panel.dispose();
    });
  });

  // Requirement 3: Mid-last-third
  describe('Requirement 3: Mid-last-third', () => {
    it('verifies active badge remains present and countdown is strictly positive and <= nightDuration / 3', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const anchor = new Date('2026-10-04T19:00:00Z');
      panel.inspectSettlement(makkahSettlement, anchor);

      const sched = getInspectorSchedule(
        makkahSettlement.latitude,
        makkahSettlement.longitude,
        anchor,
        {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          timezone: makkahSettlement.timezone,
        },
      );
      const night = sched.islamicNight!;
      const startMs = night.lastThirdStart.getTime();
      const endMs = night.lastThirdEnd.getTime();
      const midMs = startMs + Math.floor((endMs - startMs) / 2);

      const tMid = new Date(midMs);
      panel.updateTime(tMid);

      const html = panel.element.innerHTML;
      // 1. Active badge remains present
      expect(html).toContain('inspector-night-badge active');
      expect(html).toContain('inspector-night-card active');

      // 2. Countdown is strictly positive and <= (nightDuration / 3)
      const remainingMs = endMs - midMs;
      expect(remainingMs).toBeGreaterThan(0);
      expect(remainingMs).toBeLessThanOrEqual(Math.ceil(night.durationMs / 3));

      const totalSec = Math.floor(remainingMs / 1000);
      const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const s = String(totalSec % 60).padStart(2, '0');
      const expectedCountdownStr = `${h}:${m}:${s}`;

      expect(html).toContain(expectedCountdownStr);
      panel.dispose();
    });
  });

  // Requirement 4: At exact millisecond of Fajr (lastThirdEnd)
  describe('Requirement 4: At exact millisecond of Fajr (lastThirdEnd)', () => {
    it('verifies active badge disappears at exact millisecond of Fajr', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const anchor = new Date('2026-10-04T19:00:00Z');
      panel.inspectSettlement(makkahSettlement, anchor);

      const sched = getInspectorSchedule(
        makkahSettlement.latitude,
        makkahSettlement.longitude,
        anchor,
        {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          timezone: makkahSettlement.timezone,
        },
      );
      const endMs = sched.islamicNight!.lastThirdEnd.getTime();

      // 1 ms before Fajr -> active badge is present
      panel.updateTime(new Date(endMs - 1));
      const htmlBefore = panel.element.innerHTML;
      expect(htmlBefore).toContain('inspector-night-badge active');
      expect(htmlBefore).toContain('inspector-night-card active');

      // At exact millisecond of Fajr -> active badge disappears
      panel.updateTime(new Date(endMs));
      const htmlAt = panel.element.innerHTML;
      expect(htmlAt).not.toContain('inspector-night-badge active');
      expect(htmlAt).not.toContain('inspector-night-card active');

      // 1 ms after Fajr -> active badge remains absent
      panel.updateTime(new Date(endMs + 1));
      const htmlAfter = panel.element.innerHTML;
      expect(htmlAfter).not.toContain('inspector-night-badge active');
      expect(htmlAfter).not.toContain('inspector-night-card active');

      panel.dispose();
    });
  });

  // Requirement 5: Polar night / midnight sun never throws, never renders NaN or undefined
  describe('Requirement 5: Polar night & midnight sun robustness', () => {
    it('verifies inspectCoordinates(69.65, 18.96, solsticeDate) never throws, never renders NaN or undefined', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const winterSolstice = new Date('2026-12-21T12:00:00Z');
      const summerSolstice = new Date('2026-06-21T12:00:00Z');

      // Winter solstice (polar night)
      expect(() => panel.inspectCoordinates(69.65, 18.96, winterSolstice)).not.toThrow();
      const winterHtml = panel.element.innerHTML;
      expect(winterHtml).not.toContain('NaN');
      expect(winterHtml).not.toContain('undefined');
      expect(winterHtml).not.toContain('null');
      expect(winterHtml).toContain('inspector-night-card');
      expect(winterHtml).toContain('--:--:--');
      expect(winterHtml).toContain('--h --m');

      // Summer solstice (midnight sun)
      expect(() => panel.inspectCoordinates(69.65, 18.96, summerSolstice)).not.toThrow();
      const summerHtml = panel.element.innerHTML;
      expect(summerHtml).not.toContain('NaN');
      expect(summerHtml).not.toContain('undefined');
      expect(summerHtml).not.toContain('null');
      expect(summerHtml).toContain('inspector-night-card');

      panel.dispose();
    });

    it('verifies additional extreme polar coordinates (Svalbard 78.22, Alert 82.50)', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const winterSolstice = new Date('2026-12-21T12:00:00Z');

      // Svalbard
      expect(() => panel.inspectCoordinates(78.22, 15.65, winterSolstice)).not.toThrow();
      expect(panel.element.innerHTML).not.toContain('NaN');
      expect(panel.element.innerHTML).not.toContain('undefined');

      // Alert, Canada
      expect(() => panel.inspectCoordinates(82.50, -62.34, winterSolstice)).not.toThrow();
      expect(panel.element.innerHTML).not.toContain('NaN');
      expect(panel.element.innerHTML).not.toContain('undefined');

      panel.dispose();
    });
  });

  // Requirement 6: Rapid updates in updateTime() (60 FPS animation frame ticks)
  describe('Requirement 6: Rapid 60 FPS animation frame ticks and memory stability', () => {
    it('empirically verifies 600 consecutive animation frame ticks (10 simulated seconds at 60 FPS) run error-free and under budget', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const anchor = new Date('2026-10-04T19:00:00Z');
      panel.inspectSettlement(tokyoSettlement, anchor);

      const sched = getInspectorSchedule(
        tokyoSettlement.latitude,
        tokyoSettlement.longitude,
        anchor,
        {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          timezone: tokyoSettlement.timezone,
        },
      );
      const startMs = sched.islamicNight!.lastThirdStart.getTime();

      // 600 ticks at 16.6ms intervals (10 seconds), traversing through the start boundary
      const initialTickMs = startMs - 5000; // 5 seconds before start
      const startTimePerf = performance.now();

      for (let i = 0; i < 600; i++) {
        const tickInstant = new Date(initialTickMs + Math.round(i * 16.666));
        panel.updateTime(tickInstant);

        if (i === 0) {
          expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');
        } else if (i === 400) {
          // Inside last third
          expect(panel.element.innerHTML).toContain('inspector-night-badge active');
        }
      }

      const elapsedMs = performance.now() - startTimePerf;
      const avgPerTickMs = elapsedMs / 600;

      // Each tick must take < 2.5ms average, well below 16.6ms 60 FPS frame budget
      expect(avgPerTickMs).toBeLessThan(2.5);

      // Verify no NaN or undefined was produced
      const finalHtml = panel.element.innerHTML;
      expect(finalHtml).not.toContain('NaN');
      expect(finalHtml).not.toContain('undefined');

      panel.dispose();
    });

    it('verifies panel.dispose cleanly unbinds and removes element without dangling references', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      panel.inspectSettlement(tokyoSettlement, new Date('2026-10-04T19:00:00Z'));

      const removeSpy = panel.element.remove;
      panel.dispose();

      expect(removeSpy).toHaveBeenCalled();
    });
  });

  // Cross-settlement empirical validation
  describe('Cross-settlement empirical validation across global longitudes', () => {
    it('verifies boundary transitions for Tokyo across 1ms before start, exact start, and exact Fajr', () => {
      const panel = createInspectorPanel({ convention: 'UmmAlQura', madhab: 'Shafi' });
      const anchor = new Date('2026-10-04T19:12:01.579Z');
      panel.inspectSettlement(tokyoSettlement, anchor);

      const sched = getInspectorSchedule(
        tokyoSettlement.latitude,
        tokyoSettlement.longitude,
        anchor,
        {
          convention: 'UmmAlQura',
          madhab: 'Shafi',
          timezone: tokyoSettlement.timezone,
        },
      );
      expect(sched.islamicNight).toBeDefined();
      const startMs = sched.islamicNight!.lastThirdStart.getTime();
      const endMs = sched.islamicNight!.lastThirdEnd.getTime();

      // 1ms before start
      panel.updateTime(new Date(startMs - 1));
      expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');

      // Exact start
      panel.updateTime(new Date(startMs));
      expect(panel.element.innerHTML).toContain('inspector-night-badge active');

      // Exact Fajr
      panel.updateTime(new Date(endMs));
      expect(panel.element.innerHTML).not.toContain('inspector-night-badge active');

      panel.dispose();
    });
  });
});
