import { badGateway } from '../lib/errors.js';

/**
 * Warstwa dostępu do Open-Meteo po stronie serwera.
 *
 * W wersji 3 to serwer — nie przeglądarka — rozmawia z Open-Meteo. Dzięki temu:
 *  - telefon i komputer dzielą jeden cache, więc na jedno łowisko przypada
 *    jedno zapytanie na kwadrans niezależnie od liczby urządzeń,
 *  - aplikacja działa również wtedy, gdy urządzenie klienckie nie ma dostępu
 *    do internetu, a tylko do serwera w LAN-ie,
 *  - parametry zapytania są w jednym miejscu i nie da się ich podmienić z klienta.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const PAST_DAYS = 3;
export const FORECAST_DAYS = 7;

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 600;

const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'precipitation_probability',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'weather_code',
  'is_day',
].join(',');

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'weather_code',
  'is_day',
].join(',');

const DAILY_FIELDS = [
  'sunrise',
  'sunset',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'weather_code',
].join(',');

const MARINE_FIELDS = ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature'].join(',');
const MARINE_FIELDS_FALLBACK = ['wave_height', 'wave_direction', 'wave_period'].join(',');

export type JsonObject = Record<string, unknown>;

class UpstreamStatusError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'UpstreamStatusError';
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

async function fetchJson(url: string, label: string): Promise<JsonObject> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new UpstreamStatusError(`${label} odpowiedziało kodem ${response.status}`, response.status);
      }
      const data = (await response.json()) as unknown;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`${label} zwróciło odpowiedź w nieoczekiwanym formacie`);
      }
      return data as JsonObject;
    } catch (error) {
      lastError = error;
      const status = error instanceof UpstreamStatusError ? error.status : undefined;
      // 4xx to błąd zapytania — powtarzanie nic nie da. 5xx i błędy sieci bywają przejściowe.
      const retryable = status === undefined || status >= 500;
      if (!retryable || attempt === MAX_RETRIES) break;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw badGateway(
    `Nie udało się pobrać danych z ${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export function buildForecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: 'kmh',
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

export function buildMarineUrl(latitude: number, longitude: number, minimal = false): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: minimal ? MARINE_FIELDS_FALLBACK : MARINE_FIELDS,
    timezone: 'auto',
    past_days: '1',
    forecast_days: String(FORECAST_DAYS),
  });
  return `${MARINE_URL}?${params.toString()}`;
}

export function buildGeocodingUrl(name: string): string {
  const params = new URLSearchParams({
    name,
    count: '8',
    language: 'pl',
    format: 'json',
  });
  return `${GEOCODING_URL}?${params.toString()}`;
}

export async function fetchForecast(latitude: number, longitude: number): Promise<JsonObject> {
  return fetchJson(buildForecastUrl(latitude, longitude), 'Open-Meteo Forecast API');
}

/**
 * Dane morskie. Gdy pełne zapytanie zostanie odrzucone (dla części punktów
 * model nie ma temperatury powierzchni morza), ponawiamy je z samym zestawem
 * falowym zamiast tracić całą informację o fali.
 */
export async function fetchMarine(latitude: number, longitude: number): Promise<JsonObject> {
  try {
    return await fetchJson(buildMarineUrl(latitude, longitude), 'Open-Meteo Marine API');
  } catch {
    return fetchJson(buildMarineUrl(latitude, longitude, true), 'Open-Meteo Marine API');
  }
}

export async function fetchGeocoding(name: string): Promise<JsonObject> {
  return fetchJson(buildGeocodingUrl(name), 'Open-Meteo Geocoding API');
}
