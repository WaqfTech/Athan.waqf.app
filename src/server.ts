// Cloudflare Worker entry point for Adhan Earth edge routing & geolocation

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface IncomingRequestCfProperties {
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
  latitude?: string | number;
  longitude?: string | number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Dynamic edge geolocation endpoint powered by Cloudflare request.cf
    if (url.pathname === '/api/geo') {
      const cf = (request as unknown as { cf?: IncomingRequestCfProperties }).cf;
      const data = {
        city: cf?.city || null,
        country: cf?.country || null,
        region: cf?.region || null,
        timezone: cf?.timezone || null,
        latitude: cf?.latitude ? parseFloat(String(cf.latitude)) : null,
        longitude: cf?.longitude ? parseFloat(String(cf.longitude)) : null,
      };

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Serve static assets from Vite build directory
    return env.ASSETS.fetch(request);
  },
};
