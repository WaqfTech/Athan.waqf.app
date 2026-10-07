import { calculatePrayerTimes } from '../../src/prayer/calculator';
import { Coordinates, CalculationMethod, PrayerTimes, Rounding, Madhab } from 'adhan';

export interface LocationInput {
  id: number;
  category: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
}

export interface PrayerOutput {
  fajr: string | null;
  sunrise: string | null;
  dhuhr: string | null;
  asr: string | null;
  maghrib: string | null;
  isha: string | null;
}

export interface LocationResult {
  id: number;
  category: string;
  name: string;
  lat: number;
  lon: number;
  athanEarth: PrayerOutput;
  athanEarthProvenance: {
    fajr: string;
    sunrise: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
  };
  batoulAdhan: PrayerOutput;
}

export function computeLocation(loc: LocationInput, dateStr: string): LocationResult {
  const date = new Date(`${dateStr}T12:00:00Z`);

  // 1. Athan Earth calculation
  const athanResult = calculatePrayerTimes(loc.lat, loc.lon, date, {
    convention: 'MuslimWorldLeague',
    madhab: 'Shafi',
  });

  const formatAthanDate = (d: Date | null): string | null => {
    return d ? d.toISOString() : null;
  };

  const athanEarth: PrayerOutput = {
    fajr: formatAthanDate(athanResult.fajr.date),
    sunrise: formatAthanDate(athanResult.sunrise.date),
    dhuhr: formatAthanDate(athanResult.dhuhr.date),
    asr: formatAthanDate(athanResult.asr.date),
    maghrib: formatAthanDate(athanResult.maghrib.date),
    isha: formatAthanDate(athanResult.isha.date),
  };

  const athanEarthProvenance = {
    fajr: athanResult.fajr.provenance + (athanResult.fajr.note ? ` (${athanResult.fajr.note})` : ''),
    sunrise: athanResult.sunrise.provenance + (athanResult.sunrise.note ? ` (${athanResult.sunrise.note})` : ''),
    dhuhr: athanResult.dhuhr.provenance,
    asr: athanResult.asr.provenance,
    maghrib: athanResult.maghrib.provenance + (athanResult.maghrib.note ? ` (${athanResult.maghrib.note})` : ''),
    isha: athanResult.isha.provenance + (athanResult.isha.note ? ` (${athanResult.isha.note})` : ''),
  };

  // 2. Batoul Apps Adhan calculation (with Rounding.None)
  let batoulAdhan: PrayerOutput;
  try {
    const coords = new Coordinates(loc.lat, loc.lon);
    const params = CalculationMethod.MuslimWorldLeague();
    params.madhab = Madhab.Shafi;
    params.rounding = Rounding.None;
    const pt = new PrayerTimes(coords, date, params);

    batoulAdhan = {
      fajr: pt.fajr ? pt.fajr.toISOString() : null,
      sunrise: pt.sunrise ? pt.sunrise.toISOString() : null,
      dhuhr: pt.dhuhr ? pt.dhuhr.toISOString() : null,
      asr: pt.asr ? pt.asr.toISOString() : null,
      maghrib: pt.maghrib ? pt.maghrib.toISOString() : null,
      isha: pt.isha ? pt.isha.toISOString() : null,
    };
  } catch (err) {
    batoulAdhan = {
      fajr: null,
      sunrise: null,
      dhuhr: null,
      asr: null,
      maghrib: null,
      isha: null,
    };
  }

  return {
    id: loc.id,
    category: loc.category,
    name: loc.name,
    lat: loc.lat,
    lon: loc.lon,
    athanEarth,
    athanEarthProvenance,
    batoulAdhan,
  };
}

// Read JSON array of LocationInput from stdin, write JSON array of LocationResult to stdout
if (import.meta.url === `file://${process.argv[1]}`) {
  import('fs').then((fs) => {
    const inputData = fs.readFileSync(0, 'utf-8');
    const { locations, date }: { locations: LocationInput[]; date: string } = JSON.parse(inputData);
    const results = locations.map((loc) => computeLocation(loc, date));
    process.stdout.write(JSON.stringify(results, null, 2));
  });
}
