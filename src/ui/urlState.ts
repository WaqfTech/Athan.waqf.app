// URL query parameter state serialization and parsing for reproducible planetary views

export interface PlanetaryUrlState {
  lat?: number;
  lon?: number;
  time?: Date;
  mode?: string;
  convention?: string;
  style?: 'roadmap' | 'satellite';
}

export function parseUrlState(search = window.location.search): PlanetaryUrlState {
  const params = new URLSearchParams(search);
  const state: PlanetaryUrlState = {};

  const latStr = params.get('lat');
  if (latStr !== null) {
    const lat = parseFloat(latStr);
    if (!isNaN(lat)) state.lat = lat;
  }

  const lonStr = params.get('lon');
  if (lonStr !== null) {
    const lon = parseFloat(lonStr);
    if (!isNaN(lon)) state.lon = lon;
  }

  const timeStr = params.get('t');
  if (timeStr !== null) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) state.time = d;
  }

  const mode = params.get('mode');
  if (mode) state.mode = mode;

  const conv = params.get('convention');
  if (conv) state.convention = conv;

  const style = params.get('style');
  if (style === 'satellite' || style === 'roadmap') {
    state.style = style;
  }

  return state;
}

export function updateUrlState(state: PlanetaryUrlState): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);

  if (state.lat !== undefined) params.set('lat', state.lat.toFixed(2));
  if (state.lon !== undefined) params.set('lon', state.lon.toFixed(2));
  if (state.time !== undefined) params.set('t', state.time.toISOString());
  if (state.mode !== undefined) params.set('mode', state.mode);
  if (state.convention !== undefined) params.set('convention', state.convention);
  if (state.style !== undefined) params.set('style', state.style);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}
