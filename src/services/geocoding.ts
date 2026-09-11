import type { GeoLocation } from '../types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 10000;

interface RawGeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

function isRawGeocodingResult(value: unknown): value is RawGeocodingResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'number' &&
    typeof r.name === 'string' &&
    typeof r.latitude === 'number' &&
    typeof r.longitude === 'number'
  );
}

/**
 * Wyszukuje miejscowość po nazwie (Open-Meteo Geocoding API).
 * Wyniki są ograniczone do Polski — aplikacja jest regionalna.
 */
export async function searchPlace(query: string): Promise<GeoLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: '8',
    language: 'pl',
    format: 'json',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${GEOCODING_URL}?${params.toString()}`, { signal: controller.signal });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const results =
      data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
        ? ((data as { results: unknown[] }).results as unknown[])
        : [];
    return results
      .filter(isRawGeocodingResult)
      .filter((r) => r.country === 'Polska' || r.country === 'Poland')
      .map((r) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country ?? 'Polska',
        admin1: r.admin1,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parsuje współrzędne wpisane ręcznie.
 * Akceptuje m.in. "54.1943, 16.2207", "54,1943 16,2207", "54.19 N 16.22 E".
 * Zwraca null, jeśli wartości są spoza dopuszczalnego zakresu.
 */
export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const normalized = input
    .replace(/[NnEe]/g, ' ')
    .replace(/°/g, ' ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .trim();

  const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return null;

  const latitude = Number.parseFloat(matches[0]);
  const longitude = Number.parseFloat(matches[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    latitude: Math.round(latitude * 10000) / 10000,
    longitude: Math.round(longitude * 10000) / 10000,
  };
}
