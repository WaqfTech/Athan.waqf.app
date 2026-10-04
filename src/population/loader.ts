// Settlement dataset loader and data types

export interface Settlement {
  name: string;
  nameAr: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  population: number;
  timezone: string;
}

// Compact JSON format: [nameEn, nameAr, lat, lng, cc, pop, tz]
type CompactSettlementRow = [string, string, number, number, string, number, string];

let cachedSettlements: Settlement[] | null = null;

export function parseSettlements(data: CompactSettlementRow[]): Settlement[] {
  return data.map((row) => ({
    name: row[0],
    nameAr: row[1],
    latitude: row[2],
    longitude: row[3],
    countryCode: row[4],
    population: row[5],
    timezone: row[6],
  }));
}

export async function loadSettlements(url = './data/cities-core.json'): Promise<Settlement[]> {
  if (cachedSettlements) {
    return cachedSettlements;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load settlement data from ${url}: ${response.status}`);
  }

  const raw = (await response.json()) as CompactSettlementRow[];
  cachedSettlements = parseSettlements(raw);
  return cachedSettlements;
}
