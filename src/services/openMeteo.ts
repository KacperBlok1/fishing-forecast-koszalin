import type { DayPoint, HourPoint, MarineSeries, WeatherBundle } from '../types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

/** Ile dni wstecz pobieramy (potrzebne do trendu i zmiany ciśnienia 24 h). */
export const PAST_DAYS = 3;
/** Ile dni prognozy pobieramy. */
export const FORECAST_DAYS = 7;

const TIMEOUT_MS = 15000;
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
/** Zestaw minimalny — używany, gdy pełne zapytanie zostanie odrzucone (np. brak SST dla punktu). */
const MARINE_FIELDS_FALLBACK = ['wave_height', 'wave_direction', 'wave_period'].join(',');

/** Błąd oznaczający brak połączenia z siecią. */
export class OfflineError extends Error {
  constructor() {
    super('Brak połączenia z internetem.');
    this.name = 'OfflineError';
  }
}

/** Błąd HTTP z API — niesie status, żeby odróżnić błędy przejściowe od trwałych. */
export class HttpStatusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Pobiera JSON z limitem czasu i ponowieniami przy błędach sieciowych oraz 5xx.
 * Błędy 4xx nie są ponawiane — nie są przejściowe.
 */
async function fetchJson(url: string, label: string): Promise<Record<string, unknown>> {
  if (isOffline()) throw new OfflineError();

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new HttpStatusError(`${label}: błąd ${response.status}`, response.status);
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      lastError = error;
      const status = error instanceof HttpStatusError ? error.status : undefined;
      const retryable = status === undefined || status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        if (isOffline()) throw new OfflineError();
        throw error instanceof Error ? error : new Error(String(error));
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function numberAt(source: unknown, index: number): number {
  if (!Array.isArray(source)) return Number.NaN;
  const value = source[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

function nullableNumberAt(source: unknown, index: number): number | null {
  if (!Array.isArray(source)) return null;
  const value = source[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringAt(source: unknown, index: number, fallback: string): string {
  if (!Array.isArray(source)) return fallback;
  const value = source[index];
  return typeof value === 'string' ? value : fallback;
}

function parseHours(hourly: Record<string, unknown> | undefined): HourPoint[] {
  if (!hourly || !Array.isArray(hourly.time)) return [];
  const times = hourly.time as unknown[];
  const result: HourPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    if (typeof time !== 'string') continue;
    const temperature = numberAt(hourly.temperature_2m, i);
    if (!Number.isFinite(temperature)) continue;
    result.push({
      time,
      temperature,
      apparentTemperature: numberAt(hourly.apparent_temperature, i),
      humidity: numberAt(hourly.relative_humidity_2m, i),
      precipitation: Number.isFinite(numberAt(hourly.precipitation, i)) ? numberAt(hourly.precipitation, i) : 0,
      precipitationProbability: nullableNumberAt(hourly.precipitation_probability, i),
      cloudCover: Number.isFinite(numberAt(hourly.cloud_cover, i)) ? numberAt(hourly.cloud_cover, i) : 50,
      pressure: numberAt(hourly.pressure_msl, i),
      windSpeed: Number.isFinite(numberAt(hourly.wind_speed_10m, i)) ? numberAt(hourly.wind_speed_10m, i) : 0,
      windDirection: Number.isFinite(numberAt(hourly.wind_direction_10m, i)) ? numberAt(hourly.wind_direction_10m, i) : 0,
      windGusts: Number.isFinite(numberAt(hourly.wind_gusts_10m, i)) ? numberAt(hourly.wind_gusts_10m, i) : 0,
      weatherCode: Number.isFinite(numberAt(hourly.weather_code, i)) ? numberAt(hourly.weather_code, i) : 0,
      isDay: Number.isFinite(numberAt(hourly.is_day, i)) ? numberAt(hourly.is_day, i) : 1,
    });
  }
  return result;
}

function parseDays(daily: Record<string, unknown> | undefined): DayPoint[] {
  if (!daily || !Array.isArray(daily.time)) return [];
  const times = daily.time as unknown[];
  const result: DayPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    if (typeof date !== 'string') continue;
    result.push({
      date,
      sunrise: stringAt(daily.sunrise, i, `${date}T05:00`),
      sunset: stringAt(daily.sunset, i, `${date}T20:00`),
      temperatureMax: numberAt(daily.temperature_2m_max, i),
      temperatureMin: numberAt(daily.temperature_2m_min, i),
      precipitationSum: Number.isFinite(numberAt(daily.precipitation_sum, i)) ? numberAt(daily.precipitation_sum, i) : 0,
      windSpeedMax: numberAt(daily.wind_speed_10m_max, i),
      windGustsMax: numberAt(daily.wind_gusts_10m_max, i),
      weatherCode: Number.isFinite(numberAt(daily.weather_code, i)) ? numberAt(daily.weather_code, i) : 0,
    });
  }
  return result;
}

function parseCurrent(current: Record<string, unknown> | undefined, fallback: HourPoint | undefined): HourPoint | null {
  if (!current || typeof current.time !== 'string') return fallback ?? null;
  const num = (key: string, alt: number): number => {
    const value = current[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : alt;
  };
  return {
    time: current.time,
    temperature: num('temperature_2m', fallback?.temperature ?? Number.NaN),
    apparentTemperature: num('apparent_temperature', fallback?.apparentTemperature ?? Number.NaN),
    humidity: num('relative_humidity_2m', fallback?.humidity ?? Number.NaN),
    precipitation: num('precipitation', 0),
    precipitationProbability: fallback?.precipitationProbability ?? null,
    cloudCover: num('cloud_cover', 50),
    pressure: num('pressure_msl', fallback?.pressure ?? Number.NaN),
    windSpeed: num('wind_speed_10m', 0),
    windDirection: num('wind_direction_10m', 0),
    windGusts: num('wind_gusts_10m', 0),
    weatherCode: num('weather_code', 0),
    isDay: num('is_day', 1),
  };
}

function parseMarine(data: Record<string, unknown>): MarineSeries | null {
  const hourly = data.hourly as Record<string, unknown> | undefined;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const time = (hourly.time as unknown[]).filter((t): t is string => typeof t === 'string');
  if (time.length === 0) return null;

  const column = (key: string): (number | null)[] =>
    time.map((_, i) => nullableNumberAt(hourly[key], i));

  const waveHeight = column('wave_height');
  if (waveHeight.every((v) => v === null)) return null;

  return {
    time,
    waveHeight,
    waveDirection: column('wave_direction'),
    wavePeriod: column('wave_period'),
    seaSurfaceTemperature: column('sea_surface_temperature'),
  };
}

/** Buduje URL prognozy — wydzielone, żeby dało się je przetestować bez sieci. */
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

/**
 * Dane morskie. Gdy pełne zapytanie zostanie odrzucone przez API (np. dla danego
 * punktu nie ma temperatury powierzchni morza), ponawiamy je z samym zestawem
 * falowym, zamiast tracić całą informację o fali.
 */
async function fetchMarine(
  latitude: number,
  longitude: number
): Promise<{ series: MarineSeries | null; error: string | null }> {
  const attempt = async (minimal: boolean) => {
    const data = await fetchJson(buildMarineUrl(latitude, longitude, minimal), 'Open-Meteo Marine API');
    return parseMarine(data);
  };

  try {
    const series = await attempt(false);
    if (series) return { series, error: null };
  } catch (error) {
    if (error instanceof OfflineError) {
      return { series: null, error: 'Brak połączenia — dane morskie niedostępne.' };
    }
  }

  try {
    const series = await attempt(true);
    return {
      series,
      error: series ? null : 'Marine API nie zwróciło danych o fali dla tego punktu.',
    };
  } catch (error) {
    return {
      series: null,
      error:
        error instanceof OfflineError
          ? 'Brak połączenia — dane morskie niedostępne.'
          : `Nie udało się pobrać danych morskich (${error instanceof Error ? error.message : String(error)}).`,
    };
  }
}

/**
 * Pobiera komplet danych dla łowiska: pogodę (3 dni wstecz + 7 dni prognozy)
 * oraz — wyłącznie dla akwenów morskich — dane z Marine API.
 *
 * Brak danych morskich nigdy nie jest zmyślany: zwracamy `marine: null`
 * i komunikat w `marineError`, a interfejs pokazuje to wprost.
 */
export async function fetchWeatherBundle(
  latitude: number,
  longitude: number,
  includeMarine: boolean
): Promise<WeatherBundle> {
  const forecastPromise = fetchJson(buildForecastUrl(latitude, longitude), 'Open-Meteo Forecast API');

  const marinePromise: Promise<{ series: MarineSeries | null; error: string | null }> = includeMarine
    ? fetchMarine(latitude, longitude)
    : Promise.resolve({ series: null, error: null });

  const [forecast, marine] = await Promise.all([forecastPromise, marinePromise]);

  const hours = parseHours(forecast.hourly as Record<string, unknown> | undefined);
  const days = parseDays(forecast.daily as Record<string, unknown> | undefined);
  const current = parseCurrent(forecast.current as Record<string, unknown> | undefined, hours[0]);

  if (!current || hours.length === 0 || days.length === 0) {
    throw new Error('Odpowiedź Open-Meteo nie zawiera kompletu danych pogodowych.');
  }

  return {
    fetchedAt: Date.now(),
    timezone: typeof forecast.timezone === 'string' ? forecast.timezone : 'Europe/Warsaw',
    current,
    hours,
    days,
    marine: marine.series,
    marineRequested: includeMarine,
    marineError: marine.error,
  };
}
