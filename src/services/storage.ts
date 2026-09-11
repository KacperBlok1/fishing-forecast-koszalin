import type { Spot, SpeciesId, TabId, WeatherBundle } from '../types';
import type { RemotePrefs, User } from '../api';

/**
 * localStorage pełni od wersji 3 wyłącznie rolę lustra danych z serwera.
 *
 * Źródłem prawdy jest baza: łowiska i ustawienia należą do konta, nie do
 * przeglądarki. Lokalna kopia służy do dwóch rzeczy: natychmiastowego
 * pierwszego renderu (bez czekania na sieć) i pracy offline w trybie
 * tylko do odczytu.
 */

const PREFIX = 'ffk_v3_';

const KEYS = {
  user: `${PREFIX}user`,
  spots: `${PREFIX}spots`,
  prefs: `${PREFIX}prefs`,
  bundle: `${PREFIX}bundle_`,
} as const;

interface Envelope<T> {
  data: T;
  savedAt: number;
}

function read<T>(key: string): Envelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() } satisfies Envelope<T>));
  } catch {
    // Tryb prywatny albo brak miejsca — aplikacja działa dalej, tylko bez lustra.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorujemy
  }
}

// ---------------------------------------------------------------- konto

export function cachedUser(): User | null {
  return read<User>(KEYS.user)?.data ?? null;
}

export function cacheUser(user: User | null): void {
  if (user) write(KEYS.user, user);
  else remove(KEYS.user);
}

// ---------------------------------------------------------------- łowiska

export function cachedSpots(): Spot[] {
  const entry = read<Spot[]>(KEYS.spots);
  return Array.isArray(entry?.data) ? entry.data : [];
}

export function cacheSpots(spots: Spot[]): void {
  write(KEYS.spots, spots);
}

// ---------------------------------------------------------------- ustawienia

export function cachedPrefs(): RemotePrefs | null {
  const entry = read<RemotePrefs>(KEYS.prefs);
  if (!entry?.data) return null;
  return entry.data;
}

export function cachePrefs(prefs: RemotePrefs): void {
  write(KEYS.prefs, prefs);
}

// ---------------------------------------------------------------- pogoda

/** Ile czasu lokalna kopia prognozy jest w ogóle użyteczna. */
export const LOCAL_BUNDLE_TTL = 24 * 60 * 60 * 1000;

export interface CachedBundle {
  bundle: WeatherBundle;
  savedAt: number;
}

export function cachedBundle(spotId: string, species: SpeciesId): CachedBundle | null {
  const entry = read<WeatherBundle>(`${KEYS.bundle}${spotId}_${species}`);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > LOCAL_BUNDLE_TTL) {
    remove(`${KEYS.bundle}${spotId}_${species}`);
    return null;
  }
  if (!entry.data?.current || !Array.isArray(entry.data.hours)) return null;
  return { bundle: entry.data, savedAt: entry.savedAt };
}

export function cacheBundle(spotId: string, species: SpeciesId, bundle: WeatherBundle): void {
  write(`${KEYS.bundle}${spotId}_${species}`, bundle);
}

// ---------------------------------------------------------------- porządki

/** Czyści całe lustro — wołane przy wylogowaniu, żeby nie zostawiać cudzych danych. */
export function clearLocalMirror(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach(remove);
  } catch {
    // ignorujemy
  }
}

/** Ostatnia aktywna zakładka trzymana lokalnie, żeby przełączenie było natychmiastowe. */
export function cachedTab(): TabId | null {
  return cachedPrefs()?.activeTab ?? null;
}
