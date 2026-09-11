import type { DayPoint, HourPoint, MarineSeries, Spot, WeatherBundle } from '../types';
import { ApiError, weatherApi } from '../api';

/**
 * Normalizacja odpowiedzi Open-Meteo do modelu aplikacji.
 *
 * Od wersji 3 dane nie są pobierane wprost z Open-Meteo, tylko z naszego
 * serwera, który je cache'uje w Postgresie. Kształt odpowiedzi jest ten sam
 * (serwer działa jak proxy), więc cała logika parsowania została bez zmian —
 * zmienił się wyłącznie transport i to, że serwer dokłada informację o wieku
 * danych oraz o tym, czy są awaryjne.
 */

/** Ile dni wstecz pobiera serwer (trend i zmiana ciśnienia z 24 h). */
export const PAST_DAYS = 3;
/** Ile dni prognozy pobiera serwer. */
export const FORECAST_DAYS = 7;

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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseHours(hourly: Record<string, unknown> | undefined): HourPoint[] {
  if (!hourly || !Array.isArray(hourly.time)) return [];
  const times = hourly.time as unknown[];
  const result: HourPoint[] = [];

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    if (typeof time !== 'string') continue;
    const temperature = numberAt(hourly.temperature_2m, i);
    if (!Number.isFinite(temperature)) continue;

    const precipitation = numberAt(hourly.precipitation, i);
    const cloudCover = numberAt(hourly.cloud_cover, i);
    const windSpeed = numberAt(hourly.wind_speed_10m, i);
    const windDirection = numberAt(hourly.wind_direction_10m, i);
    const windGusts = numberAt(hourly.wind_gusts_10m, i);
    const weatherCode = numberAt(hourly.weather_code, i);
    const isDay = numberAt(hourly.is_day, i);

    result.push({
      time,
      temperature,
      apparentTemperature: numberAt(hourly.apparent_temperature, i),
      humidity: numberAt(hourly.relative_humidity_2m, i),
      precipitation: Number.isFinite(precipitation) ? precipitation : 0,
      precipitationProbability: nullableNumberAt(hourly.precipitation_probability, i),
      cloudCover: Number.isFinite(cloudCover) ? cloudCover : 50,
      pressure: numberAt(hourly.pressure_msl, i),
      windSpeed: Number.isFinite(windSpeed) ? windSpeed : 0,
      windDirection: Number.isFinite(windDirection) ? windDirection : 0,
      windGusts: Number.isFinite(windGusts) ? windGusts : 0,
      weatherCode: Number.isFinite(weatherCode) ? weatherCode : 0,
      isDay: Number.isFinite(isDay) ? isDay : 1,
    });
  }
  return result;
}

export function parseDays(daily: Record<string, unknown> | undefined): DayPoint[] {
  if (!daily || !Array.isArray(daily.time)) return [];
  const times = daily.time as unknown[];
  const result: DayPoint[] = [];

  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    if (typeof date !== 'string') continue;
    const precipitationSum = numberAt(daily.precipitation_sum, i);
    const weatherCode = numberAt(daily.weather_code, i);

    result.push({
      date,
      sunrise: stringAt(daily.sunrise, i, `${date}T05:00`),
      sunset: stringAt(daily.sunset, i, `${date}T20:00`),
      temperatureMax: numberAt(daily.temperature_2m_max, i),
      temperatureMin: numberAt(daily.temperature_2m_min, i),
      precipitationSum: Number.isFinite(precipitationSum) ? precipitationSum : 0,
      windSpeedMax: numberAt(daily.wind_speed_10m_max, i),
      windGustsMax: numberAt(daily.wind_gusts_10m_max, i),
      weatherCode: Number.isFinite(weatherCode) ? weatherCode : 0,
    });
  }
  return result;
}

export function parseCurrent(
  current: Record<string, unknown> | undefined,
  fallback: HourPoint | undefined
): HourPoint | null {
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

export function parseMarine(payload: unknown): MarineSeries | null {
  const root = asRecord(payload);
  const hourly = asRecord(root?.hourly);
  if (!hourly || !Array.isArray(hourly.time)) return null;

  const time = (hourly.time as unknown[]).filter((value): value is string => typeof value === 'string');
  if (time.length === 0) return null;

  const column = (key: string): (number | null)[] => time.map((_, index) => nullableNumberAt(hourly[key], index));

  const waveHeight = column('wave_height');
  if (waveHeight.every((value) => value === null)) return null;

  return {
    time,
    waveHeight,
    waveDirection: column('wave_direction'),
    wavePeriod: column('wave_period'),
    seaSurfaceTemperature: column('sea_surface_temperature'),
  };
}

/**
 * Pobiera komplet danych dla łowiska przez API aplikacji.
 * Dane morskie odpytujemy tylko dla akwenów typu "morze"; ich brak nigdy nie
 * jest zmyślany — wracamy z `marine: null` i komunikatem w `marineError`.
 */
export async function fetchWeatherBundle(spot: Spot, force = false): Promise<WeatherBundle> {
  const includeMarine = spot.type === 'morze';

  const [forecast, marine] = await Promise.all([
    weatherApi.forecast(spot.id, force),
    includeMarine
      ? weatherApi
          .marine(spot.id, force)
          .then((envelope) => ({ series: parseMarine(envelope.data), error: null as string | null }))
          .catch((error: unknown) => ({
            series: null,
            error:
              error instanceof ApiError
                ? `Nie udało się pobrać danych morskich: ${error.message}`
                : 'Nie udało się pobrać danych morskich.',
          }))
      : Promise.resolve({ series: null, error: null as string | null }),
  ]);

  const root = asRecord(forecast.data);
  const hours = parseHours(asRecord(root?.hourly));
  const days = parseDays(asRecord(root?.daily));
  const current = parseCurrent(asRecord(root?.current), hours[0]);

  if (!current || hours.length === 0 || days.length === 0) {
    throw new ApiError(502, 'bad_payload', 'Serwer zwrócił niekompletne dane pogodowe.');
  }

  const fetchedAt = Date.parse(forecast.meta.fetchedAt);

  return {
    fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Date.now(),
    stale: forecast.meta.stale,
    timezone: typeof root?.timezone === 'string' ? root.timezone : 'Europe/Warsaw',
    current,
    hours,
    days,
    marine: marine.series,
    marineRequested: includeMarine,
    marineError:
      marine.error ?? (includeMarine && !marine.series ? 'Marine API nie zwróciło danych o fali dla tego punktu.' : null),
  };
}
