// Cloudflare Worker entry point for Adhan Earth edge routing & geolocation

import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  DEFAULT_LOCALE,
  buildLinkHeader,
  transformIndexHtml,
} from './i18n';

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface IncomingRequestCfProperties {
  city?: string;
  country?: string;
  region?: string;
  regionCode?: string;
  continent?: string;
  timezone?: string;
  latitude?: string | number;
  longitude?: string | number;
  postalCode?: string;
  metroCode?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Dynamic edge geolocation endpoint powered by Cloudflare request.cf
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

    // 2. Canonical redirects for English (/en -> /, /en/credits -> /credits)
    if (url.pathname === '/en' || url.pathname === '/en/') {
      const target = new URL('/', request.url);
      target.search = url.search;
      return Response.redirect(target.toString(), 301);
    }
    if (url.pathname === '/en/credits' || url.pathname === '/en/credits/') {
      const target = new URL('/credits', request.url);
      target.search = url.search;
      return Response.redirect(target.toString(), 301);
    }

    // 3. Normalize trailing slashes on supported locales and credits
    const stripped = url.pathname.replace(/^\/+|\/+$/g, '');
    const segments = stripped.split('/');

    // Handle /credits
    if (segments.length === 1 && segments[0] === 'credits') {
      if (url.pathname.endsWith('/')) {
        const target = new URL('/credits', request.url);
        target.search = url.search;
        return Response.redirect(target.toString(), 301);
      }

      const indexUrl = new URL('/', request.url);
      const indexReq = new Request(indexUrl.toString(), request);
      const assetRes = await env.ASSETS.fetch(indexReq);
      if (!assetRes.ok) return assetRes;

      const headers = new Headers(assetRes.headers);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Content-Language', 'en');
      headers.set('Link', buildLinkHeader());
      const existingCache = headers.get('cache-control') || 'public, max-age=0, must-revalidate';
      if (!existingCache.includes('no-transform')) {
        headers.set('cache-control', `${existingCache}, no-transform`);
      }
      return new Response(assetRes.body, { status: 200, headers });
    }

    // Handle /:loc/credits
    if (segments.length === 2 && segments[0] in SUPPORTED_LOCALES && segments[1] === 'credits') {
      const loc = segments[0] as SupportedLocale;
      if (loc === DEFAULT_LOCALE) {
        const target = new URL('/credits', request.url);
        target.search = url.search;
        return Response.redirect(target.toString(), 301);
      }

      if (url.pathname.endsWith('/')) {
        const target = new URL(`/${loc}/credits`, request.url);
        target.search = url.search;
        return Response.redirect(target.toString(), 301);
      }

      const indexUrl = new URL('/', request.url);
      const indexReq = new Request(indexUrl.toString(), request);
      const assetRes = await env.ASSETS.fetch(indexReq);
      if (!assetRes.ok) return assetRes;

      const rawHtml = await assetRes.text();
      const localizedHtml = transformIndexHtml(rawHtml, loc);

      const headers = new Headers(assetRes.headers);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Content-Language', loc);
      headers.set('Link', buildLinkHeader());
      const existingCache = headers.get('cache-control') || 'public, max-age=0, must-revalidate';
      if (!existingCache.includes('no-transform')) {
        headers.set('cache-control', `${existingCache}, no-transform`);
      }
      return new Response(localizedHtml, { status: 200, headers });
    }

    if (segments.length === 1 && segments[0] in SUPPORTED_LOCALES) {
      const loc = segments[0] as SupportedLocale;

      if (loc !== DEFAULT_LOCALE && url.pathname.endsWith('/')) {
        const target = new URL(`/${loc}`, request.url);
        target.search = url.search;
        return Response.redirect(target.toString(), 301);
      }

      // Serve localized page for supported locale (/ar, /tr, etc.)
      if (loc !== DEFAULT_LOCALE) {
        const indexUrl = new URL('/', request.url);
        const indexReq = new Request(indexUrl.toString(), request);
        const assetRes = await env.ASSETS.fetch(indexReq);

        if (!assetRes.ok) {
          return assetRes;
        }

        const rawHtml = await assetRes.text();
        const localizedHtml = transformIndexHtml(rawHtml, loc);

        const headers = new Headers(assetRes.headers);
        headers.set('Content-Type', 'text/html; charset=utf-8');
        headers.set('Content-Language', loc);
        headers.set('Link', buildLinkHeader());

        const existingCache = headers.get('cache-control') || 'public, max-age=0, must-revalidate';
        if (!existingCache.includes('no-transform')) {
          headers.set('cache-control', `${existingCache}, no-transform`);
        }

        return new Response(localizedHtml, {
          status: 200,
          headers,
        });
      }
    }

    // 4. Serve root (/) with Content-Language and Link headers
    if (url.pathname === '/') {
      const response = await env.ASSETS.fetch(request);
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('Content-Language', 'en');
        headers.set('Link', buildLinkHeader());

        const existingCache = headers.get('cache-control') || 'public, max-age=0, must-revalidate';
        if (!existingCache.includes('no-transform')) {
          headers.set('cache-control', `${existingCache}, no-transform`);
        }

        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      return response;
    }

    // 5. Fallthrough for static assets (js, css, images, data, robots, sitemap)
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    // Prevent Cloudflare Edge from injecting ambient telemetry beacons (beacon.min.js)
    if (contentType.includes('text/html')) {
      const headers = new Headers(response.headers);
      const existingCache = headers.get('cache-control') || 'public, max-age=0, must-revalidate';
      if (!existingCache.includes('no-transform')) {
        headers.set('cache-control', `${existingCache}, no-transform`);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
};
