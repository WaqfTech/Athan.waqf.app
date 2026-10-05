// URL query parameter state serialization and parsing for reproducible planetary views

import { Madhab, HighLatitudeRule } from '../prayer/conventions';

export interface PlanetaryUrlState {
  lat?: number;
  lon?: number;
  time?: Date;
  mode?: string;
  convention?: string;
  madhab?: Madhab;
  highLatitudeRule?: HighLatitudeRule;
  rule?: HighLatitudeRule;
  style?: 'roadmap' | 'satellite';
  lang?: string;
}

export function parseUrlState(search = typeof window !== 'undefined' ? window.location.search : ''): PlanetaryUrlState {
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

  const madhabStr = params.get('madhab');
  if (madhabStr === 'Shafi' || madhabStr === 'Hanafi') {
    state.madhab = madhabStr;
  }

  const ruleStr = params.get('highLatitudeRule') || params.get('rule');
  if (
    ruleStr === 'MiddleOfTheNight' ||
    ruleStr === 'SeventhOfTheNight' ||
    ruleStr === 'AngleBased'
  ) {
    state.highLatitudeRule = ruleStr;
    state.rule = ruleStr;
  }

  const style = params.get('style');
  if (style === 'satellite' || style === 'roadmap') {
    state.style = style;
  }

  const lang = params.get('lang');
  if (lang) {
    state.lang = lang;
  } else if (typeof window !== 'undefined') {
    const pathSegment = window.location.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/')[0]
      ?.toLowerCase();
    if (pathSegment && pathSegment !== 'credits') state.lang = pathSegment;
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
  if (state.madhab !== undefined) params.set('madhab', state.madhab);
  if (state.highLatitudeRule !== undefined) {
    params.set('rule', state.highLatitudeRule);
  } else if (state.rule !== undefined) {
    params.set('rule', state.rule);
  }
  if (state.style !== undefined) params.set('style', state.style);

  // Remove redundant ?lang= from search query since language lives in path
  params.delete('lang');

  let newPath = window.location.pathname;
  const isCredits = window.location.pathname === '/credits' || window.location.pathname.endsWith('/credits');
  if (state.lang !== undefined) {
    if (state.lang === 'en') {
      newPath = isCredits ? '/credits' : '/';
    } else {
      newPath = isCredits ? `/${state.lang}/credits` : `/${state.lang}`;
    }
  }

  const query = params.toString();
  const newUrl = query ? (newPath === '/' ? `/?${query}` : `${newPath}?${query}`) : newPath;
  window.history.replaceState(null, '', newUrl);
}
