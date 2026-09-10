import type { GeoLocation } from '../types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 500;

/** Kształt pojedynczego wyniku, jaki zwraca Open-Meteo Geocoding API (snake_case/raw). */
interface RawGeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRawGeocodingResult(value: unknown): value is RawGeocodingResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === 'number' && typeof r.name === 'string'
    && typeof r.latitude === 'number' && typeof r.longitude === 'number';
}

/**
 * Wyszukaj miejscowość po nazwie. Zwraca tylko wyniki z Polski.
 */
export async function searchCity(query: string): Promise<GeoLocation[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query.trim())}&count=5&language=pl&format=json`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        // Błędy 4xx nie są przejściowe — nie ma sensu ponawiać zapytania.
        if (response.status >= 400 && response.status < 500) return [];
        throw new Error(`Geocoding API zwróciło błąd: ${response.status}`);
      }

      const data: unknown = await response.json();
      const rawResults = (data && typeof data === 'object' && Array.isArray((data as any).results))
        ? (data as any).results as unknown[]
        : [];

      return rawResults
        .filter(isRawGeocodingResult)
        .filter((r) => r.country === 'Polska')
        .map((r) => ({
          id: r.id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          country: r.country ?? 'Polska',
          admin1: r.admin1,
        }));
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES) {
        return [];
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  // Nieosiągalne, ale zaspokaja kontrolę typów.
  throw lastError;
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
