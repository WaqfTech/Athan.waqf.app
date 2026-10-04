// Spatial indexing and fast geographic lookup for settlements

import { Settlement } from './loader';
import { angularDistanceDegrees } from '../astronomy/coordinates';

export class SettlementSpatialIndex {
  private settlements: Settlement[];
  private binSizeDeg = 5;
  private grid: Map<string, Settlement[]> = new Map();

  constructor(settlements: Settlement[]) {
    this.settlements = settlements;
    this.buildGrid();
  }

  private getBinKey(lat: number, lon: number): string {
    const latBin = Math.floor(lat / this.binSizeDeg);
    const lonBin = Math.floor(lon / this.binSizeDeg);
    return `${latBin}:${lonBin}`;
  }

  private buildGrid(): void {
    for (const settlement of this.settlements) {
      const key = this.getBinKey(settlement.latitude, settlement.longitude);
      const list = this.grid.get(key);
      if (list) {
        list.push(settlement);
      } else {
        this.grid.set(key, [settlement]);
      }
    }
  }

  /**
   * Find the nearest settlement to a geographic coordinate within a maximum distance.
   */
  public findNearest(
    latitude: number,
    longitude: number,
    maxDistanceDeg = 10,
  ): { settlement: Settlement; distanceDeg: number } | null {
    const searchBinsRadius = Math.ceil(maxDistanceDeg / this.binSizeDeg);
    const centerLatBin = Math.floor(latitude / this.binSizeDeg);
    const centerLonBin = Math.floor(longitude / this.binSizeDeg);

    let bestSettlement: Settlement | null = null;
    let minDistance = maxDistanceDeg;

    for (let dLat = -searchBinsRadius; dLat <= searchBinsRadius; dLat++) {
      for (let dLon = -searchBinsRadius; dLon <= searchBinsRadius; dLon++) {
        const latBin = centerLatBin + dLat;
        let lonBin = centerLonBin + dLon;

        // Wrap longitude bins around dateline [-36, 36)
        const maxLonBins = 360 / this.binSizeDeg;
        while (lonBin < -maxLonBins / 2) lonBin += maxLonBins;
        while (lonBin >= maxLonBins / 2) lonBin -= maxLonBins;

        const key = `${latBin}:${lonBin}`;
        const candidates = this.grid.get(key);
        if (!candidates) continue;

        for (const candidate of candidates) {
          const dist = angularDistanceDegrees(
            latitude,
            longitude,
            candidate.latitude,
            candidate.longitude,
          );
          if (dist < minDistance) {
            minDistance = dist;
            bestSettlement = candidate;
          }
        }
      }
    }

    return bestSettlement ? { settlement: bestSettlement, distanceDeg: minDistance } : null;
  }

  /**
   * Find the K nearest settlements to a geographic coordinate.
   */
  public findKNearest(
    latitude: number,
    longitude: number,
    k = 10,
    initialRadiusDeg = 15,
  ): Array<{ settlement: Settlement; distanceDeg: number }> {
    if (this.settlements.length === 0) return [];
    if (this.settlements.length <= k) {
      return this.settlements
        .map((s) => ({
          settlement: s,
          distanceDeg: angularDistanceDegrees(latitude, longitude, s.latitude, s.longitude),
        }))
        .sort((a, b) => a.distanceDeg - b.distanceDeg);
    }

    let maxDistanceDeg = initialRadiusDeg;
    let candidatesList: Array<{ settlement: Settlement; distanceDeg: number }> = [];

    while (maxDistanceDeg <= 180) {
      const searchBinsRadius = Math.ceil(maxDistanceDeg / this.binSizeDeg);
      const centerLatBin = Math.floor(latitude / this.binSizeDeg);
      const centerLonBin = Math.floor(longitude / this.binSizeDeg);
      const visited = new Set<string>();
      candidatesList = [];

      for (let dLat = -searchBinsRadius; dLat <= searchBinsRadius; dLat++) {
        for (let dLon = -searchBinsRadius; dLon <= searchBinsRadius; dLon++) {
          const latBin = centerLatBin + dLat;
          let lonBin = centerLonBin + dLon;

          const maxLonBins = 360 / this.binSizeDeg;
          while (lonBin < -maxLonBins / 2) lonBin += maxLonBins;
          while (lonBin >= maxLonBins / 2) lonBin -= maxLonBins;

          const key = `${latBin}:${lonBin}`;
          if (visited.has(key)) continue;
          visited.add(key);

          const candidates = this.grid.get(key);
          if (!candidates) continue;

          for (const candidate of candidates) {
            const dist = angularDistanceDegrees(
              latitude,
              longitude,
              candidate.latitude,
              candidate.longitude,
            );
            if (dist <= maxDistanceDeg) {
              candidatesList.push({ settlement: candidate, distanceDeg: dist });
            }
          }
        }
      }

      if (candidatesList.length >= k || maxDistanceDeg >= 180) {
        break;
      }
      maxDistanceDeg *= 2;
    }

    candidatesList.sort((a, b) => a.distanceDeg - b.distanceDeg);
    return candidatesList.slice(0, k);
  }

  /**
   * Fast text search across English and Arabic names.
   */
  public searchByName(query: string, limit = 10): Settlement[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const matches: Settlement[] = [];
    for (const s of this.settlements) {
      if (
        s.name.toLowerCase().includes(normalized) ||
        s.nameAr.toLowerCase().includes(normalized)
      ) {
        matches.push(s);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }

  /**
   * Find an intelligent, diverse set of nearby cities balanced by country and geographic spread.
   * Avoids overloading with same-country suburbs and satellite districts while preserving proximity.
   */
  public findIntelligentNearby(options: IntelligentNearbyOptions): IntelligentNearbyResult[] {
    const {
      latitude,
      longitude,
      visitorCountryCode,
      visitorCity,
      targetCount = 10,
      maxHomeCountry = 2,
      maxOtherCountry = 1,
      minClusterDistanceKm = 40,
      excludeCoordinates = [],
    } = options;

    if (this.settlements.length === 0) return [];

    const KM_PER_DEGREE = 111.1949;

    const isExcluded = (lat: number, lon: number): boolean => {
      for (const ex of excludeCoordinates) {
        const rad = ex.radiusKm ?? 30;
        const dKm = angularDistanceDegrees(lat, lon, ex.lat, ex.lon) * KM_PER_DEGREE;
        if (dKm < rad) return true;
      }
      return false;
    };

    // Calculate distances to all settlements and sort in ascending order
    const allCandidates: IntelligentNearbyResult[] = this.settlements
      .map((s) => {
        const distDeg = angularDistanceDegrees(latitude, longitude, s.latitude, s.longitude);
        return {
          settlement: s,
          distanceDeg: distDeg,
          distanceKm: distDeg * KM_PER_DEGREE,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const selected: IntelligentNearbyResult[] = [];
    const countryCounts = new Map<string, number>();

    // 1. Primary visitor local anchor
    let anchor: IntelligentNearbyResult | null = null;
    if (visitorCity) {
      const normalizedCity = visitorCity.trim().toLowerCase();
      // Look within closest candidates for a name match
      for (let i = 0; i < Math.min(35, allCandidates.length); i++) {
        const item = allCandidates[i];
        if (
          (!visitorCountryCode || item.settlement.countryCode === visitorCountryCode) &&
          (item.settlement.name.toLowerCase().includes(normalizedCity) ||
            normalizedCity.includes(item.settlement.name.toLowerCase()))
        ) {
          anchor = item;
          break;
        }
      }
    }

    if (!anchor) {
      for (const item of allCandidates) {
        if (!isExcluded(item.settlement.latitude, item.settlement.longitude)) {
          anchor = item;
          break;
        }
      }
    }

    if (anchor) {
      selected.push(anchor);
      countryCounts.set(anchor.settlement.countryCode, 1);
    }

    const isFarEnoughFromSelected = (lat: number, lon: number): boolean => {
      for (const sel of selected) {
        const dKm =
          angularDistanceDegrees(lat, lon, sel.settlement.latitude, sel.settlement.longitude) *
          KM_PER_DEGREE;
        if (dKm < minClusterDistanceKm) return false;
      }
      return true;
    };

    // 2. Identify the most prominent city in each country within expanding radius
    const countryBest = new Map<string, IntelligentNearbyResult>();
    for (const item of allCandidates) {
      const s = item.settlement;
      if (isExcluded(s.latitude, s.longitude)) continue;
      const cc = s.countryCode;
      if (!countryBest.has(cc)) {
        const maxDist = Math.max(item.distanceKm * 2.0, item.distanceKm + 250);
        const peers = allCandidates.filter(
          (x) =>
            x.settlement.countryCode === cc &&
            x.distanceKm <= maxDist &&
            !isExcluded(x.settlement.latitude, x.settlement.longitude),
        );
        let best = item;
        for (const p of peers) {
          if (p.settlement.population > best.settlement.population * 2.0) {
            best = p;
          }
        }
        countryBest.set(cc, best);
      }
    }

    // 3. For home country, add a secondary major city if available
    if (visitorCountryCode && (countryCounts.get(visitorCountryCode) || 0) < maxHomeCountry) {
      const homePeers = allCandidates.filter(
        (x) =>
          x.settlement.countryCode === visitorCountryCode &&
          x.distanceKm >= minClusterDistanceKm &&
          !isExcluded(x.settlement.latitude, x.settlement.longitude) &&
          !selected.some((sel) => sel.settlement.name === x.settlement.name) &&
          isFarEnoughFromSelected(x.settlement.latitude, x.settlement.longitude),
      );

      if (homePeers.length > 0) {
        let bestHome = homePeers[0];
        for (let i = 1; i < Math.min(5, homePeers.length); i++) {
          if (homePeers[i].settlement.population > bestHome.settlement.population) {
            bestHome = homePeers[i];
          }
        }
        selected.push(bestHome);
        countryCounts.set(visitorCountryCode, (countryCounts.get(visitorCountryCode) || 0) + 1);
      }
    }

    // 4. Add closest prominent cities from other countries in ascending distance order
    const otherCountryCandidates = Array.from(countryBest.entries())
      .filter(([cc]) => cc !== visitorCountryCode)
      .map(([, best]) => best)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    for (const item of otherCountryCandidates) {
      if (selected.length >= targetCount) break;
      const s = item.settlement;
      if (isExcluded(s.latitude, s.longitude)) continue;
      if (
        selected.some(
          (sel) => sel.settlement.name === s.name && sel.settlement.countryCode === s.countryCode,
        )
      ) {
        continue;
      }
      if (!isFarEnoughFromSelected(s.latitude, s.longitude)) continue;

      const currentCount = countryCounts.get(s.countryCode) || 0;
      if (currentCount >= maxOtherCountry) continue;

      selected.push(item);
      countryCounts.set(s.countryCode, currentCount + 1);
    }

    // 5. Relaxation pass: if still under targetCount (e.g. isolated region or island)
    if (selected.length < targetCount) {
      for (const item of allCandidates) {
        if (selected.length >= targetCount) break;
        const s = item.settlement;
        if (isExcluded(s.latitude, s.longitude)) continue;
        if (
          selected.some(
            (sel) => sel.settlement.name === s.name && sel.settlement.countryCode === s.countryCode,
          )
        ) {
          continue;
        }
        if (!isFarEnoughFromSelected(s.latitude, s.longitude)) continue;

        const currentCount = countryCounts.get(s.countryCode) || 0;
        const limit = s.countryCode === visitorCountryCode ? 5 : 2;
        if (currentCount >= limit) continue;

        selected.push(item);
        countryCounts.set(s.countryCode, currentCount + 1);
      }
    }

    // 6. Final unconditional fallback fill if necessary (ensures targetCount is satisfied)
    if (selected.length < targetCount) {
      for (const item of allCandidates) {
        if (selected.length >= targetCount) break;
        if (isExcluded(item.settlement.latitude, item.settlement.longitude)) continue;
        if (
          selected.some(
            (sel) =>
              sel.settlement.name === item.settlement.name &&
              sel.settlement.countryCode === item.settlement.countryCode,
          )
        ) {
          continue;
        }
        if (!isFarEnoughFromSelected(item.settlement.latitude, item.settlement.longitude)) continue;
        selected.push(item);
      }
    }

    return selected.slice(0, targetCount);
  }

  public getAll(): Settlement[] {
    return this.settlements;
  }
}

export interface IntelligentNearbyOptions {
  latitude: number;
  longitude: number;
  visitorCountryCode?: string;
  visitorCity?: string;
  targetCount?: number;
  maxHomeCountry?: number;
  maxOtherCountry?: number;
  minClusterDistanceKm?: number;
  excludeCoordinates?: Array<{ lat: number; lon: number; radiusKm?: number }>;
}

export interface IntelligentNearbyResult {
  settlement: Settlement;
  distanceDeg: number;
  distanceKm: number;
}
