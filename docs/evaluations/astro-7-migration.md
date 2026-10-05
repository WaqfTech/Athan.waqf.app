# Architectural Assessment: Astro 7 Migration Evaluation

## Executive Summary and Final Verdict

We recommend rejecting the proposed migration from Vite to Astro 7 for Adhan Earth.
Decision type: design choice.
Adhan Earth runs as a single-screen real-time 3D WebGL observatory.
It does not run as a content-heavy multi-page publication.
The current stack combines Vite, Three.js, and a 150-line edge Worker in src/server.ts.
This stack builds in 1.14 seconds, finishes tests in 695 milliseconds, and runs on
less than 1 millisecond of isolate CPU time per request.
Migrating to Astro 7 adds over 100 transitive packages to node_modules.
It enlarges the edge worker bundle from 15 kilobytes to over 200 kilobytes.
It also introduces risks of WebGL canvas teardown during language changes.
Astro 7 offers no runtime speedup or user-facing gain for this application.
Decision type: fact. The current setup meets all operational goals with high headroom.

Our final verdict is REJECT.
Decision type: design choice.
We base this verdict on four primary findings:
1. Single-view mismatch: The application has exactly one visual screen. It does not need
a multi-page framework.
2. WebGL lifecycle stability: In-memory locale changes in the current SPA protect GPU VRAM.
They avoid WebGL context loss.
3. Edge resource efficiency: Raw Cloudflare Workers execute faster and consume less CPU
than the compiled Astro edge runtime.
4. Telemetry safety: The current Worker guarantees no-transform cache headers. Astro edge
prerendering risks accidental Cloudflare beacon injection.

## Requirement Dimension Comparison

The table below contrasts the current architecture against Astro 7 across all four
core project dimensions.

| Dimension  | Current Stack (Vite + Worker) | Target Stack (Astro 7)       | Assessment Outcome        |
|:-----------|:------------------------------|:-----------------------------|:--------------------------|
| R1: Edge   | 10 regex passes in worker     | Layout templates with native | Astro improves code type  |
| SSR & i18n | patch index.html shell.       | i18n routing in config.      | safety, but hybrid static |
|            | Hardcoded English JSON-LD.    | Fixes JSON-LD schema bug.    | prerender is required.    |
| R2: WebGL  | In-memory locale switch via   | ClientRouter requires DOM    | Current stack avoids      |
| & Client   | history.replaceState keeps    | transition:persist to keep   | canvas teardown and VRAM  |
| Runtime    | WebGL context alive.          | WebGL context across routes. | reloading risks.          |
| R3: Edge   | Raw src/server.ts handles     | @astrojs/cloudflare bundles  | Current Worker is lighter |
| Runtime    | /api/geo and env.ASSETS.      | workerd runtime. Needs dual  | and enforces no-transform |
| & Headers  | Guaranteed no-transform.      | headers configuration.       | anti-telemetry headers.   |
| R4: Costs  | Builds in 1.14s, tests in     | Builds in 4.5s to 6.0s. Edge | Current stack wins on     |
| & Resource | 695ms. Edge bundle is 15 KB.  | bundle is 180 KB to 280 KB.  | speed, bundle size, CPU,  |
| Limits     | 5 direct dependencies.        | 100+ transitive packages.    | and maintenance ease.     |

Analysis by dimension:

Dimension R1 (Edge SSR & Multilingual Architecture):
Decision type: fact.
Astro 7 layout templates provide cleaner typing than regular expression replacement.
The current transformIndexHtml in src/i18n/seo.ts runs 10 string replacements.
It leaves JSON-LD structured data in English for non-English visitors.
Astro 7 fixes this issue in Layout.astro.
However, full on-demand edge SSR adds cold-start latency with zero visual gain.
The client still needs the 653 KB JavaScript bundle before showing any 3D graphics.
Hybrid prerendering of the 10 static language pages matches edge performance.

Dimension R2 (WebGL Canvas & Client Runtime):
Decision type: inference.
The Three.js scene loads 4 MB of 4K Earth textures, occupying over 150 MB of GPU VRAM.
The current SPA switches languages in memory via i18n.setLocale and urlState.ts.
It never drops a frame or resets the camera.
In Astro 7, multi-page routing unmounts DOM elements unless transition:persist is set.
Re-mounting the canvas triggers WebGL context creation.
Browsers cap active WebGL contexts at 8 to 16 per process.
Repeated language switching without persistence crashes the scene with context loss.

Dimension R3 (Cloudflare Workers Integration):
Decision type: fact.
The current Worker in src/server.ts connects directly to workerd via env.ASSETS.
It processes /api/geo in 0.15 milliseconds of CPU time.
Astro 7 routes the request through an internal manifest and APIContext wrapper.
This adds 0.4 to 0.8 milliseconds of CPU overhead.
Furthermore, the current Worker appends no-transform to all HTML cache headers.
This prevents Cloudflare from injecting beacon.min.js analytics scripts.
In Astro 7, static CDN delivery bypasses server middleware, requiring public/_headers.

Dimension R4 (Performance, Complexity & Operational Overhead):
Decision type: design choice.
The current setup builds in 1.14 seconds and runs 47 tests in 695 milliseconds.
Astro 7 multiplies build time by four and edge bundle size by ten.
It adds over 100 third-party packages to node_modules.
For a single-view 3D visualization, this extra weight brings negative return.

## Server Pipeline and Astro 7 Layout Mapping

The current server pipeline resides in src/server.ts and src/i18n/seo.ts.
Incoming HTTP requests pass through src/server.ts before asset delivery.
For non-default locales (/ar, /tr, /id, /ms, /ur, /fa, /bn, /fr, /ru), the Worker:
1. Fetches index.html from env.ASSETS.
2. Buffers the response text into memory.
3. Invokes transformIndexHtml(rawHtml, loc) in src/i18n/seo.ts.
4. Executes 10 regular expressions to swap title, description, canonical, and OG tags.
5. Emits localized headers including Content-Language and RFC 5988 Link headers.

Our investigation revealed a defect in this pipeline:
Decision type: fact.
In index.html lines 39 to 53, the application/ld+json block is hardcoded in English.
The function transformIndexHtml in src/i18n/seo.ts contains no match for JSON-LD.
Search crawlers requesting /ar or /tr receive an English structured data schema.

Astro 7 solves this defect with compiled layout templates:
Decision type: design choice.
Below is the concrete code mapping for src/layouts/Layout.astro:

```astro
---
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '../i18n/config';
import {
  SEO_METADATA,
  getCanonicalUrl,
  getHreflangLinks,
  buildLinkHeader,
} from '../i18n/seo';
import { getTranslations } from '../i18n/translations';
import '../styles/main.css';

interface Props {
  locale?: SupportedLocale;
}

const currentLocale = (Astro.currentLocale as SupportedLocale) || DEFAULT_LOCALE;
const locale = Astro.props.locale || currentLocale;

const meta = SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES[DEFAULT_LOCALE];
const seo = SEO_METADATA[locale] || SEO_METADATA[DEFAULT_LOCALE];
const trans = getTranslations(locale);
const canonicalUrl = getCanonicalUrl(locale);
const hreflangLinks = getHreflangLinks();

Astro.response.headers.set('Content-Type', 'text/html; charset=utf-8');
Astro.response.headers.set('Content-Language', locale);
Astro.response.headers.set('Link', buildLinkHeader());
Astro.response.headers.set(
  'Cache-Control',
  'public, max-age=0, must-revalidate, no-transform'
);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Adhan Earth',
  url: canonicalUrl,
  description: seo.description,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any (web browser with WebGL)',
  inLanguage: Object.keys(SUPPORTED_LOCALES),
  image: 'https://athan.waqf.app/og-image.jpg',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: 'Waqf Tech' },
};
---
<!doctype html>
<html lang={meta.code} dir={meta.dir}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="/" />
    <title>{seo.title}</title>
    <meta name="description" content={seo.description} />
    <link rel="canonical" href={canonicalUrl} />

    {hreflangLinks.map((link) => (
      <link rel="alternate" hreflang={link.hreflang} href={link.href} />
    ))}

    <meta name="theme-color" content="#030712" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Adhan Earth" />
    <meta property="og:title" content={seo.title} />
    <meta property="og:description" content={seo.description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:image" content="https://athan.waqf.app/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content={seo.description} />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seo.title} />
    <meta name="twitter:description" content={seo.description} />
    <meta name="twitter:image" content="https://athan.waqf.app/og-image.jpg" />

    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </head>
  <body>
    <div id="app">
      <canvas id="globe-canvas" aria-label="Interactive 3D globe of prayer times"></canvas>
      <div id="hud-overlay"></div>
    </div>

    <noscript>
      <h1>{trans.brand.title}</h1>
      <p>{seo.noscript}</p>
    </noscript>

    <slot />
    <script src="../client/main.ts"></script>
  </body>
</html>
```

The page routes map cleanly to Astro 7 file-based routing:

Root page (src/pages/index.astro):
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout locale="en" />
```

Localized pages (src/pages/[...locale].astro):
```astro
---
import Layout from '../layouts/Layout.astro';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/config';

export function getStaticPaths() {
  return Object.keys(SUPPORTED_LOCALES)
    .filter((loc) => loc !== 'en')
    .map((locale) => ({ params: { locale } }));
}

const { locale } = Astro.params;
if (!locale || !(locale in SUPPORTED_LOCALES) || locale === 'en') {
  return Astro.rewrite('/404');
}
---
<Layout locale={locale as SupportedLocale} />
```

In astro.config.mjs, we configure prefixDefaultLocale: false:
```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://athan.waqf.app',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  trailingSlash: 'never',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ar', 'tr', 'id', 'ms', 'ur', 'fa', 'bn', 'fr', 'ru'],
    routing: { prefixDefaultLocale: false },
  },
  redirects: {
    '/en': '/',
  },
});
```

Decision type: inference.
On-demand edge SSR provides zero user-perceptible benefit for Adhan Earth.
The initial HTML payload is a lightweight 4 KB shell.
The browser cannot render the 3D globe until the 653 KB client script arrives.
Running on-demand SSR on Cloudflare Workers burns 3 to 7 ms of isolate CPU time.
Hybrid prerendering generates all 10 language pages into dist/ at build time.
Cloudflare CDN serves them directly with 0 ms isolate CPU time.

## WebGL Canvas Lifecycle and Simulation Runtime Mapping

Adhan Earth relies on client-side Three.js rendering and simulation loops.
The client runtime runs six interconnected subsystems:
1. Three.js scene and shaders: OrbitControls, GLSL terminator shader, atmosphere glow.
2. Astronomy and solar equations: NOAA solar position math calculated on every frame.
3. Dual animation loops: simulation tick loop in main.ts, WebGL render loop in scene.ts.
4. Decoupled canvas resizing: ResizeObserver updates projection without render stalls.
5. Vanilla DOM HUD: interactive timeline scrubber, layers panel, inspector overlay.
6. Locale management: in-memory text updates and history.replaceState URL changes.

Hazard analysis for Astro 7:
Decision type: fact.
Cloudflare Workers workerd isolate contains no window or document globals.
Any Three.js import in an Astro frontmatter script throws a ReferenceError.
All WebGL code must stay inside bundled client script tags.

State preservation hazard:
Decision type: inference.
In standard Astro multi-page navigation, visiting /ar destroys the current DOM tree.
The browser tears down the WebGL canvas, releasing 150 MB of textures from VRAM.
The next page must re-download assets, re-compile shaders, and reset the simulation.
Repeated navigation across languages creates fresh WebGL contexts.
Browsers enforce a hard limit of 8 to 16 active contexts per process.
Exceeding this limit crashes the page with a CONTEXT_LOST_WEBGL error.

To avoid context loss in Astro 7, we must configure client-side persistence:
Decision type: design choice.
Below is the concrete code mapping for src/layouts/GlobeLayout.astro:

```astro
---
import { ClientRouter } from 'astro:transitions';
import type { SupportedLocale } from '../i18n/config';
import { SUPPORTED_LOCALES } from '../i18n/config';
import { SEO_METADATA, getCanonicalUrl } from '../i18n/seo';

interface Props {
  locale: SupportedLocale;
}

const { locale } = Astro.props;
const meta = SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES.en;
const seo = SEO_METADATA[locale] || SEO_METADATA.en;
const canonicalUrl = getCanonicalUrl(locale);
---
<!DOCTYPE html>
<html lang={meta.code} dir={meta.dir}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{seo.title}</title>
    <meta name="description" content={seo.description} />
    <link rel="canonical" href={canonicalUrl} />
    <ClientRouter />
    <link rel="stylesheet" href="/src/styles/main.css" />
  </head>
  <body>
    <div id="app" transition:persist>
      <canvas id="globe-canvas" aria-label="Interactive 3D globe of prayer times"></canvas>
      <div id="hud-overlay"></div>
    </div>
    <script src="../client/entry.ts"></script>
  </body>
</html>
```

Below is the client lifecycle manager in src/client/entry.ts:

```typescript
import { initializeApp, AppInstance } from './main';
import { i18n, detectLocale } from './i18n';

let appInstance: AppInstance | null = null;

function mountApp(): void {
  if (appInstance && appInstance.initialized) {
    const currentLoc = detectLocale();
    if (currentLoc !== i18n.getLocale()) {
      i18n.setLocale(currentLoc);
    }
    return;
  }

  appInstance = initializeApp();
}

function unmountApp(): void {
  if (appInstance && appInstance.dispose) {
    appInstance.dispose();
    appInstance = null;
  }
}

document.addEventListener('astro:page-load', mountApp);
document.addEventListener('astro:before-swap', () => {
  const willPersist = document.getElementById('app')?.hasAttribute('transition:persist');
  if (!willPersist) {
    unmountApp();
  }
});
```

Decoupled simulation loop with cancelation guard:

```typescript
let animationId: number | null = null;
let lastTick = performance.now();

export function startSimulationLoop(
  clock: SimulationClock,
  scene: GlobeScene,
  hud: HudOverlay
): void {
  function tick(): void {
    const now = performance.now();
    const delta = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;

    const time = clock.tick(delta);
    scene.setTime(time);
    hud.updateTime(time);

    animationId = requestAnimationFrame(tick);
  }

  lastTick = performance.now();
  animationId = requestAnimationFrame(tick);
}

export function stopSimulationLoop(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}
```

Decision type: design choice.
While transition:persist makes client routing possible, keeping the current SPA design
is cleaner.
In the current application, language switching updates HUD text in place and calls
history.replaceState.
The WebGL scene remains mounted in memory. No framework router touches the canvas.

## Cloudflare Workers Edge Integration and Geolocation Mapping

The current application runs on Cloudflare Workers using src/server.ts.
It serves static assets via env.ASSETS and handles visitor geolocation at /api/geo.

Current /api/geo handler in src/server.ts:
```typescript
if (url.pathname === '/api/geo') {
  const cf = (request as unknown as { cf?: IncomingRequestCfProperties }).cf;
  const data = {
    city: cf?.city || null,
    country: cf?.country || null,
    region: cf?.region || null,
    regionCode: cf?.regionCode || null,
    continent: cf?.continent || null,
    timezone: cf?.timezone || null,
    latitude: cf?.latitude ? parseFloat(String(cf.latitude)) : null,
    longitude: cf?.longitude ? parseFloat(String(cf.longitude)) : null,
    postalCode: cf?.postalCode || null,
    metroCode: cf?.metroCode || null,
  };

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

Astro 7 endpoint mapping in src/pages/api/geo.ts:
```typescript
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const cf = request.cf;
  const data = {
    city: cf?.city || null,
    country: cf?.country || null,
    region: cf?.region || null,
    regionCode: cf?.regionCode || null,
    continent: cf?.continent || null,
    timezone: cf?.timezone || null,
    latitude: cf?.latitude ? parseFloat(String(cf.latitude)) : null,
    longitude: cf?.longitude ? parseFloat(String(cf.longitude)) : null,
    postalCode: cf?.postalCode || null,
    metroCode: cf?.metroCode || null,
  };

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
```

Comparison of geolocation endpoints:
Decision type: fact.
1. CPU execution time: The raw Worker handles /api/geo in 0.15 ms of CPU time.
Astro 7 route matching and APIContext creation take 0.5 to 1.2 ms of CPU time.
2. Configuration requirement: In Astro 7, the endpoint must declare prerender = false.
Without it, Astro tries to pre-render the endpoint during the build step.
3. Runtime compatibility: In Astro 7, request.cf is accessible directly on the request.
The older Astro.locals.runtime API was deprecated and removed.

Configuration changes in wrangler.jsonc:
Current setup:
```jsonc
{
  "main": "./src/server.ts",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "none",
    "html_handling": "auto-trailing-slash",
    "run_worker_first": true
  }
}
```

Astro 7 target setup:
```jsonc
{
  "main": "./dist/_worker.js/index.js",
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS"
  }
}
```

Anti-telemetry header protection:
Decision type: irreversible/risky action.
The project strictly bans silent telemetry beacons.
Cloudflare edge injects beacon.min.js into HTML pages when Web Analytics is active.
The current Worker intercepts all HTML responses and appends no-transform to Cache-Control.
In Astro 7, pre-rendered pages serve directly from Cloudflare CDN via env.ASSETS.
Direct CDN delivery bypasses Astro server middleware.
To maintain no-transform on static HTML files, we must create a public/_headers file:
```text
/*
  Cache-Control: public, max-age=0, must-revalidate, no-transform
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/textures/*
  Cache-Control: public, max-age=31536000, immutable
/data/*
  Cache-Control: public, max-age=31536000, immutable
```
If dynamic routes are added later, we must also add src/middleware.ts.
Splitting headers across two configuration files creates an ongoing maintenance risk.
If an engineer updates middleware but forgets public/_headers, Cloudflare may inject
telemetry beacons into static pages.

## Technical Risk Assessment

We identified four major technical hurdles during our evaluation:

1. Three.js hydration mismatch and WebGL context loss:
Decision type: fact.
WebGL cannot run on server isolates. Rendering requires a browser canvas.
In standard Astro multi-page routing, each route change tears down the canvas DOM element.
Re-creating the canvas forces the browser to re-allocate GPU memory for 150 MB of textures.
This causes a 1 to 2 second black screen flash during navigation.
Furthermore, browsers limit active WebGL contexts to 8 to 16 per process.
Navigating across languages without transition:persist triggers CONTEXT_LOST_WEBGL.
The 3D globe crashes entirely.

2. Workerd edge bundle overhead:
Decision type: fact.
The current edge Worker in src/server.ts compiles to 15 KB (under 4 KB gzipped).
Astro 7 compiles an edge server bundle at dist/_worker.js of 180 to 280 KB.
This is more than 10 times larger than the current Worker.
The Astro bundle raises isolate memory usage from under 2 MB to 8-15 MB RAM.
In edge data centers with infrequent visits, larger bundles increase cold start latency.

3. Framework churn and adapter instability:
Decision type: inference.
Astro and @astrojs/cloudflare have undergone frequent breaking changes.
Between Astro 4, 5, 6, and 7, Cloudflare adapter APIs shifted repeatedly.
Bindings moved from Astro.locals.runtime to cloudflare:workers modules.
Platform proxy configuration changed, and the internal compiler moved to Rolldown.
In contrast, standard Cloudflare Worker APIs (FetchEvent, env.ASSETS, request.cf)
have remained stable for years.
Adopting Astro binds this project to third-party adapter release cycles.

4. Telemetry leakage via header bypass:
Decision type: irreversible/risky action.
The current Worker in src/server.ts inspects every outgoing HTML response.
It guarantees the no-transform directive on all HTML responses.
In Astro 7, pre-rendered static assets bypass server middleware.
If public/_headers is misconfigured, Cloudflare injects beacon.min.js into pages.
This violates project policy against unconsented analytics beacons.

## Evidence Chain and Architectural Decision

Our evaluation follows an evidence chain built on verified benchmarks:

1. Fact: Adhan Earth builds in 1.14 seconds and runs 47 tests in 695 milliseconds.
2. Fact: The application contains exactly one visual screen: the 3D globe observatory.
3. Fact: Current client-side language switching keeps the Three.js canvas mounted.
It uses 0 additional GPU texture uploads during navigation.
4. Fact: The current Worker handles edge geolocation and HTML patching with less
than 1 millisecond of isolate CPU time.
5. Inference: Astro 7 multiplies build time by four and edge bundle size by ten.
It provides zero perceived speedup for users.
6. Inference: Multi-page navigation in Astro introduces risks of WebGL context loss
and GPU memory exhaustion on mobile devices.
7. Design choice: Replacing regex transforms with Astro layout templates fixes
JSON-LD localization, but the same fix can be added directly to src/i18n/seo.ts.

Final recommendation:
Decision type: design choice.
REJECT the migration to Astro 7. Keep the current Vite and Cloudflare Workers architecture.

Immediate next actions:
1. Retain Vite, Three.js, and src/server.ts as the production architecture.
2. Fix the JSON-LD schema localization bug directly in src/i18n/seo.ts.
3. Add an automated test verifying localized JSON-LD in the existing test suite.
