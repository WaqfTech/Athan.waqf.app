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

  public getAll(): Settlement[] {
    return this.settlements;
  }
}
