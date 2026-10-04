// Visitor Edge Geolocation helper for Cloudflare request.cf and browser fallbacks

export interface VisitorLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
  source: 'cloudflare-edge' | 'browser-gps' | 'fallback';
}

export async function fetchVisitorLocation(): Promise<VisitorLocation | null> {
  // 1. Fetch Cloudflare Worker edge geolocation endpoint (runs instantly, zero permission prompts)
  try {
    const res = await fetch('/api/geo', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (
        data &&
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number' &&
        !isNaN(data.latitude) &&
        !isNaN(data.longitude)
      ) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city || undefined,
          country: data.country || undefined,
          region: data.region || undefined,
          timezone: data.timezone || undefined,
          source: 'cloudflare-edge',
        };
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // 2. Fallback to browser geolocation API
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 3000,
          maximumAge: 3600000,
          enableHighAccuracy: false,
        });
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        source: 'browser-gps',
      };
    } catch {
      // Ignore error and fall through
    }
  }

  return null;
}
