import type { FishingLocationType, Spot, SpeciesId, TabId } from '../types';
import { DEFAULT_SPOTS, DEFAULT_SPOT_ID } from '../data/spots';
import { DEFAULT_SPECIES_ID, isSpeciesId } from '../data/species';

/**
 * Cała trwała pamięć aplikacji to localStorage przeglądarki.
 * Nie ma konta, logowania, backendu ani bazy — dane nie opuszczają urządzenia.
 */

const KEYS = {
  customSpots: 'fishing_v2_custom_spots',
  selectedSpot: 'fishing_v2_selected_spot',
  species: 'fishing_v2_species',
  tab: 'fishing_v2_tab',
  lastResult: 'fishing_v2_last_result',
} as const;

const LOCATION_TYPES: FishingLocationType[] = ['jezioro', 'rzeka', 'morze'];

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage może być wyłączony (tryb prywatny) — aplikacja działa dalej.
  }
}

function isSpot(value: unknown): value is Spot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.latitude === 'number' &&
    Number.isFinite(s.latitude) &&
    typeof s.longitude === 'number' &&
    Number.isFinite(s.longitude) &&
    typeof s.type === 'string' &&
    LOCATION_TYPES.includes(s.type as FishingLocationType)
  );
}

/** Łowiska dodane przez użytkownika. */
export function loadCustomSpots(): Spot[] {
  const raw = readJson<unknown>(KEYS.customSpots);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSpot).map((spot) => ({ ...spot, custom: true }));
}

export function saveCustomSpots(spots: Spot[]): void {
  writeJson(KEYS.customSpots, spots);
}

/** Pełna lista łowisk: wbudowane + własne. */
export function loadAllSpots(): Spot[] {
  return [...DEFAULT_SPOTS, ...loadCustomSpots()];
}

/** Tworzy identyfikator dla nowego łowiska, unikalny w obrębie listy. */
export function createSpotId(name: string, existing: Spot[]): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'lowisko';

  const taken = new Set(existing.map((s) => s.id));
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

export function loadSelectedSpotId(): string {
  try {
    return localStorage.getItem(KEYS.selectedSpot) ?? DEFAULT_SPOT_ID;
  } catch {
    return DEFAULT_SPOT_ID;
  }
}

export function saveSelectedSpotId(id: string): void {
  try {
    localStorage.setItem(KEYS.selectedSpot, id);
  } catch {
    // ignorujemy
  }
}

export function loadSpeciesId(): SpeciesId {
  try {
    const raw = localStorage.getItem(KEYS.species);
    return isSpeciesId(raw) ? raw : DEFAULT_SPECIES_ID;
  } catch {
    return DEFAULT_SPECIES_ID;
  }
}

export function saveSpeciesId(id: SpeciesId): void {
  try {
    localStorage.setItem(KEYS.species, id);
  } catch {
    // ignorujemy
  }
}

const TABS: TabId[] = ['teraz', 'dzis', 'tydzien', 'dlaczego'];

export function loadTab(): TabId {
  try {
    const raw = localStorage.getItem(KEYS.tab);
    return TABS.includes(raw as TabId) ? (raw as TabId) : 'teraz';
  } catch {
    return 'teraz';
  }
}

export function saveTab(tab: TabId): void {
  try {
    localStorage.setItem(KEYS.tab, tab);
  } catch {
    // ignorujemy
  }
}

/** Skrót ostatniego wyniku — pokazywany od razu po otwarciu aplikacji. */
export interface LastResultSnapshot {
  spotId: string;
  spotName: string;
  speciesId: SpeciesId;
  score: number;
  label: string;
  savedAt: number;
}

export function loadLastResult(): LastResultSnapshot | null {
  const raw = readJson<LastResultSnapshot>(KEYS.lastResult);
  if (!raw || typeof raw.score !== 'number' || typeof raw.spotId !== 'string') return null;
  return raw;
}

export function saveLastResult(snapshot: LastResultSnapshot): void {
  writeJson(KEYS.lastResult, snapshot);
}
