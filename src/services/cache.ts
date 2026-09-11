import type { WeatherBundle } from '../types';

/**
 * Cache odpowiedzi Open-Meteo w localStorage.
 *
 * Dwa progi:
 *  - FRESH_TTL — dane uznajemy za świeże i nie odpytujemy API ponownie;
 *  - STALE_TTL — dane są przeterminowane, ale wciąż pokazujemy je jako
 *    "ostatnia poprawna odpowiedź", gdy API lub internet nie działają.
 */

const CACHE_NAMESPACE = 'fishing_cache_';
const CACHE_PREFIX = `${CACHE_NAMESPACE}v3_`;

export const FRESH_TTL = 15 * 60 * 1000; // 15 minut
export const STALE_TTL = 24 * 60 * 60 * 1000; // 24 godziny

interface CacheEntry {
  data: WeatherBundle;
  savedAt: number;
}

export interface CachedBundle {
  bundle: WeatherBundle;
  savedAt: number;
  fresh: boolean;
}

function cacheKey(latitude: number, longitude: number, type: string): string {
  return `${CACHE_PREFIX}${latitude.toFixed(3)}_${longitude.toFixed(3)}_${type}`;
}

export function readCachedBundle(latitude: number, longitude: number, type: string): CachedBundle | null {
  try {
    const raw = localStorage.getItem(cacheKey(latitude, longitude, type));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry?.data?.current || !Array.isArray(entry.data.hours)) return null;
    const age = Date.now() - entry.savedAt;
    if (age > STALE_TTL) {
      localStorage.removeItem(cacheKey(latitude, longitude, type));
      return null;
    }
    return { bundle: entry.data, savedAt: entry.savedAt, fresh: age <= FRESH_TTL };
  } catch {
    return null;
  }
}

export function writeCachedBundle(
  latitude: number,
  longitude: number,
  type: string,
  bundle: WeatherBundle
): void {
  try {
    const entry: CacheEntry = { data: bundle, savedAt: Date.now() };
    localStorage.setItem(cacheKey(latitude, longitude, type), JSON.stringify(entry));
  } catch {
    // Brak miejsca albo zablokowany localStorage — cache jest opcjonalny.
  }
}

/** Czyści cache pogodowy (nie rusza zapisanych łowisk ani ustawień). */
export function clearWeatherCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_NAMESPACE)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignorujemy
  }
}
