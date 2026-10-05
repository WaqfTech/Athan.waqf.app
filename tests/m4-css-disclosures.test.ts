import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Milestone 4 CSS and Layout Integrity', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/main.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('enforces direction: ltr on .timeline-track-wrapper to prevent 180-degree playhead inversion in RTL', () => {
    const match = cssContent.match(/\.timeline-track-wrapper\s*\{[^}]*direction:\s*ltr;/);
    expect(match).not.toBeNull();
  });

  it('defines font-family fallbacks and letter-spacing reset for RTL mode', () => {
    expect(cssContent).toContain('"Noto Sans Arabic"');
    expect(cssContent).toContain('[dir="rtl"]');
    expect(cssContent).toContain('letter-spacing: normal;');
  });

  it('defines styling classes for prayer provenance badges and layer legend container', () => {
    expect(cssContent).toContain('.prayer-provenance-badge');
    expect(cssContent).toContain('.badge-astro');
    expect(cssContent).toContain('.badge-fixed');
    expect(cssContent).toContain('.badge-high-lat');
    expect(cssContent).toContain('.badge-unresolved');
    expect(cssContent).toContain('.layers-legend-container');
  });
});
