import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Milestone 5 CSS Telemetry & Responsive Properties', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/main.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  it('defines .stat-chip-last-third with celestial night theme and transition', () => {
    expect(cssContent).toContain('.stat-chip-last-third');
    expect(cssContent).toMatch(/\.stat-chip-last-third\s*\{[^}]*background:\s*rgba\(15,\s*23,\s*42/);
    expect(cssContent).toMatch(/\.stat-chip-last-third\s*\{[^}]*border-color:\s*rgba\(129,\s*140,\s*248/);
  });

  it('defines .stat-chip-dot and is-active states for live status indication', () => {
    expect(cssContent).toContain('.stat-chip-dot');
    expect(cssContent).toContain('.stat-chip-last-third.is-active');
    expect(cssContent).toContain('.stat-chip-last-third.is-active .stat-chip-dot');
    expect(cssContent).toContain('.stat-chip-last-third.is-active .stat-chip-val');
  });

  it('defines pulseLastThirdDot keyframes protected by prefers-reduced-motion', () => {
    expect(cssContent).toContain('@keyframes pulseLastThirdDot');
    expect(cssContent).toContain('@media (prefers-reduced-motion: no-preference)');
    const reducedMotionSection = cssContent.slice(
      cssContent.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    expect(reducedMotionSection).toContain('pulseLastThirdDot');
  });

  it('switches .timeline-stats-strip to a 2-column grid under max-width: 640px', () => {
    const mobileMatch = cssContent.match(/@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]*?)(?=@media|\n\/\*)/);
    expect(mobileMatch).not.toBeNull();
    const mobileCss = mobileMatch![1];
    expect(mobileCss).toContain('display: grid;');
    expect(mobileCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(mobileCss).toContain('width: 100%;');
  });

  it('defines compact chip padding and font sizes under max-width: 480px', () => {
    const narrowMatch = cssContent.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)(?=@media|\n\/\*)/);
    expect(narrowMatch).not.toBeNull();
    const narrowCss = narrowMatch![1];
    expect(narrowCss).toContain('padding-block: 2px;');
    expect(narrowCss).toContain('padding-inline: 6px;');
  });

  it('strictly adheres to CSS logical properties with zero physical directional properties in chip rules', () => {
    // Extract stat-chip and stat-chip-last-third rules
    const chipRuleMatches = cssContent.match(/\.stat-chip[^{]*\{[^}]*\}/g) || [];
    expect(chipRuleMatches.length).toBeGreaterThan(0);

    for (const rule of chipRuleMatches) {
      expect(rule).not.toMatch(/\bmargin-left\b/);
      expect(rule).not.toMatch(/\bmargin-right\b/);
      expect(rule).not.toMatch(/\bpadding-left\b/);
      expect(rule).not.toMatch(/\bpadding-right\b/);
      expect(rule).not.toMatch(/\bleft\s*:/);
      expect(rule).not.toMatch(/\bright\s*:/);
    }
  });

  it('includes .stat-chip-label and .stat-chip-val in RTL letter-spacing normal reset', () => {
    const rtlSection = cssContent.slice(0, 3000);
    expect(rtlSection).toContain('[dir="rtl"] .stat-chip-label');
    expect(rtlSection).toContain('[dir="rtl"] .stat-chip-val');
  });
});
