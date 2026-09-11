import { config } from '../config.js';
import { query, queryOne } from '../db/pool.js';
import { badGateway } from '../lib/errors.js';

/**
 * Cache odpowiedzi Open-Meteo w Postgresie.
 *
 * Dwa progi czasowe:
 *  - WEATHER_FRESH_MINUTES — w tym oknie oddajemy zapis z bazy i w ogóle nie
 *    ruszamy Open-Meteo; to ten mechanizm sprawia, że telefon i komputer
 *    dzielą jedno zapytanie,
 *  - WEATHER_STALE_HOURS — po wygaśnięciu świeżości próbujemy pobrać nowe dane,
 *    a gdy Open-Meteo nie odpowiada, oddajemy ostatnią poprawną odpowiedź
 *    oznaczoną jako nieświeża. Klient pokazuje wtedy jej wiek i komunikat.
 */

export interface CachedPayload {
  data: unknown;
  fetchedAt: string;
  stale: boolean;
}

interface CacheRow {
  payload: unknown;
  fetched_at: Date;
}

/**
 * Zapytania w locie, po kluczu cache. Gdy dwa urządzenia odpytają o to samo
 * łowisko w tej samej sekundzie, do Open-Meteo poleci jedno zapytanie,
 * a obaj klienci dostaną ten sam wynik.
 */
const inFlight = new Map<string, Promise<CachedPayload>>();

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function ageMs(fetchedAt: Date | string): number {
  const time = fetchedAt instanceof Date ? fetchedAt.getTime() : Date.parse(String(fetchedAt));
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Date.now() - time;
}

async function readRow(key: string): Promise<CacheRow | null> {
  return queryOne<CacheRow>('SELECT payload, fetched_at FROM weather_cache WHERE cache_key = $1', [key]);
}

async function writeRow(key: string, payload: unknown): Promise<Date> {
  const row = await queryOne<{ fetched_at: Date }>(
    `INSERT INTO weather_cache (cache_key, payload, fetched_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (cache_key)
     DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()
     RETURNING fetched_at`,
    [key, JSON.stringify(payload)]
  );
  return row?.fetched_at ?? new Date();
}

export interface GetOrFetchOptions {
  /** Nadpisuje domyślny czas świeżości (ms) — np. dłuższy dla geokodowania. */
  freshMs?: number;
  staleMs?: number;
  /** Wymusza pobranie nowych danych, nawet jeśli zapis jest jeszcze świeży. */
  force?: boolean;
}

export async function getOrFetch(
  key: string,
  fetcher: () => Promise<unknown>,
  options: GetOrFetchOptions = {}
): Promise<CachedPayload> {
  const freshMs = options.freshMs ?? config.weatherFreshMs;
  const staleMs = options.staleMs ?? config.weatherStaleMs;

  const existing = await readRow(key);
  if (existing && !options.force && ageMs(existing.fetched_at) <= freshMs) {
    return { data: existing.payload, fetchedAt: toIso(existing.fetched_at), stale: false };
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async (): Promise<CachedPayload> => {
    try {
      const fresh = await fetcher();
      const fetchedAt = await writeRow(key, fresh);
      return { data: fresh, fetchedAt: toIso(fetchedAt), stale: false };
    } catch (error) {
      if (existing && ageMs(existing.fetched_at) <= staleMs) {
        return { data: existing.payload, fetchedAt: toIso(existing.fetched_at), stale: true };
      }
      throw error instanceof Error
        ? error
        : badGateway('Open-Meteo nie odpowiada, a w cache nie ma użytecznych danych.');
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

/** Usuwa wpisy starsze niż okno awaryjne. Wołane cyklicznie z index.ts. */
export async function cleanupWeatherCache(): Promise<number> {
  const maxAgeHours = Math.ceil(config.weatherStaleMs / 3_600_000) * 2;
  const result = await query(
    `DELETE FROM weather_cache WHERE fetched_at < now() - ($1 || ' hours')::interval`,
    [String(maxAgeHours)]
  );
  return result.rowCount ?? 0;
}

/** Klucz cache — współrzędne zaokrąglone do ok. 100 m, żeby bliskie punkty dzieliły zapis. */
export function coordinateKey(prefix: string, latitude: number, longitude: number): string {
  return `${prefix}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}
