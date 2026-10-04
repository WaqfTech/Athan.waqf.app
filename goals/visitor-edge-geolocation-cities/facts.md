# Facts & Ground Truth: visitor-edge-geolocation-cities

- **Cloudflare Edge Geolocation**: `request.cf` provides `latitude`, `longitude`, `city`, `country`, `region`, and `timezone` on every incoming request with zero client-side permission dialogs.
- **Worker Configuration**: Worker script entry `src/server.ts` with static asset binding `ASSETS` handles `/api/geo` and delegates static file requests to `env.ASSETS.fetch(request)`.
- **Spatial Indexing**: `SettlementSpatialIndex.findKNearest(lat, lon, k)` finds the nearest settlements using spatial hash bins and great-circle angular distance.
- **Header Presentation**: Keep the sacred cities (Makkah, Madinah, Al-Quds) pinned, followed by the 10 closest visitor settlements dynamically populated from edge coordinates.
