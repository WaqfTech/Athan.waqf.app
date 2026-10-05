import { describe, it, expect } from 'vitest';
import server from './server';

describe('Cloudflare Worker edge routing', () => {
  const sampleIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Adhan Earth | Live 3D Map of Prayer Times Worldwide</title>
    <meta name="description" content="Watch prayer times move around the Earth in real time." />
    <link rel="canonical" href="https://athan.waqf.app/" />
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`;

  function createMockEnv(): { ASSETS: { fetch: (req: Request) => Promise<Response> } } {
    return {
      ASSETS: {
        fetch: async (req: Request) => {
          const url = new URL(req.url);
          if (url.pathname === '/' || url.pathname === '/index.html') {
            return new Response(sampleIndexHtml, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
          if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
            return new Response('console.log("asset")', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' },
            });
          }
          return new Response('Not Found', { status: 404 });
        },
      },
    };
  }

  it('serves /credits with 200 and English headers', async () => {
    const env = createMockEnv();
    const req = new Request('https://athan.waqf.app/credits');
    const res = await server.fetch(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Language')).toBe('en');
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toContain('no-transform');
  });

  it('redirects /credits/ to /credits', async () => {
    const env = createMockEnv();
    const req = new Request('https://athan.waqf.app/credits/');
    const res = await server.fetch(req, env);

    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://athan.waqf.app/credits');
  });

  it('redirects /en/credits to /credits', async () => {
    const env = createMockEnv();
    const req = new Request('https://athan.waqf.app/en/credits');
    const res = await server.fetch(req, env);

    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://athan.waqf.app/credits');
  });

  it('serves /ar/credits with transformed Arabic HTML and headers', async () => {
    const env = createMockEnv();
    const req = new Request('https://athan.waqf.app/ar/credits');
    const res = await server.fetch(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Language')).toBe('ar');
    expect(res.headers.get('cache-control')).toContain('no-transform');

    const html = await res.text();
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('أذان الأرض');
  });

  it('redirects /ar/credits/ with trailing slash to /ar/credits', async () => {
    const env = createMockEnv();
    const req = new Request('https://athan.waqf.app/ar/credits/');
    const res = await server.fetch(req, env);

    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://athan.waqf.app/ar/credits');
  });

  it('serves /tr/credits with Turkish headers and transformed HTML', async () => {
    const env = createMockEnv();
    const req = new Request('https://athan.waqf.app/tr/credits');
    const res = await server.fetch(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Language')).toBe('tr');

    const html = await res.text();
    expect(html).toContain('lang="tr"');
    expect(html).toContain('dir="ltr"');
  });
});
