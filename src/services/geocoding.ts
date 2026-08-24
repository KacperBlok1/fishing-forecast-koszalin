import type { GeoLocation } from '../types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Wyszukaj miejscowość po nazwie.
 */
export async function searchCity(query: string): Promise<GeoLocation[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query.trim())}&count=5&language=pl&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Geocoding API zwróciło błąd: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results) {
      return [];
    }

    // Filtruj tylko miejscowości z Polski
    const results: GeoLocation[] = data.results
      .filter((r: any) => r.country === 'Polska')
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country,
        admin1: r.admin1,
      }));

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Użyj domyślnej lokalizacji — Koszalin.
 */
export function getDefaultLocation() {
  return {
    name: 'Koszalin',
    latitude: 54.1943,
    longitude: 16.2207,
    country: 'Polska',
  };
}
