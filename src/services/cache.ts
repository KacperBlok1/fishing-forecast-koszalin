/**
 * Prosta cache'owanie wyników w localStorage.
 * Klucze są generowane z współrzędnych i typu łowiska.
 */

const CACHE_KEY_NAMESPACE = 'fishing_cache_';
const CACHE_KEY_PREFIX = `${CACHE_KEY_NAMESPACE}v2_`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minut

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCacheKey(latitude: number, longitude: number, type: string): string {
  return `${CACHE_KEY_PREFIX}${latitude.toFixed(2)}_${longitude.toFixed(2)}_${type}`;
}

export function getCachedResult<T>(
  latitude: number,
  longitude: number,
  type: string
): T | null {
  try {
    const key = getCacheKey(latitude, longitude, type);
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);

    // Sprawdź czy cache nie wygasł
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedResult<T>(
  latitude: number,
  longitude: number,
  type: string,
  data: T
): void {
  try {
    const key = getCacheKey(latitude, longitude, type);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignoruj błędy localStorage
  }
}

export function clearAllCaches(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_NAMESPACE)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
