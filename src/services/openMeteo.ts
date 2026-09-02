import type { OpenMeteoResponse, MarineResponse } from '../types';

const BASE_URL = 'https://api.open-meteo.com/v1';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1';

const COMMON_PARAMS = [
  'current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,is_day',
  'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,weather_code',
  'daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code,sunrise,sunset',
  'timezone=Europe%2FWarsaw',
  'forecast_days=3',
  'past_days=3',
].join('&');

/**
 * Oblicza średnią temperaturę i średnie ciśnienie dla każdego dnia z danych hourly.
 * Używane zamiast nieistniejących pól daily API (temperature_2m_mean i pressure_msl_mean).
 */
function computeDailyFromHourly(
  hourlyTime: string[],
  hourlyTemp2m: number[],
  hourlyPressure: number[]
): { temperatureMean: number[]; pressureMean: number[] } {
  const dailyTempMap = new Map<string, number[]>();
  const dailyPresMap = new Map<string, number[]>();

  for (let i = 0; i < hourlyTime.length; i++) {
    const date = hourlyTime[i].split('T')[0];
    if (!dailyTempMap.has(date)) dailyTempMap.set(date, []);
    if (!dailyPresMap.has(date)) dailyPresMap.set(date, []);
    dailyTempMap.get(date)!.push(hourlyTemp2m[i] ?? 0);
    dailyPresMap.get(date)!.push(hourlyPressure[i] ?? 0);
  }

  const temperatureMean = Array.from(dailyTempMap.values()).map(
    arr => arr.reduce((a, b) => a + b, 0) / arr.length
  );
  const pressureMean = Array.from(dailyPresMap.values()).map(
    arr => arr.reduce((a, b) => a + b, 0) / arr.length
  );

  return { temperatureMean, pressureMean };
}

/**
 * Pobierz bieżącą pogodę, prognozę godzinową i dane dzienne.
 */
export async function fetchWeatherData(
  latitude: number,
  longitude: number
): Promise<OpenMeteoResponse> {
  const url = `${BASE_URL}/forecast?${COMMON_PARAMS}&latitude=${latitude}&longitude=${longitude}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Open-Meteo API zwróciło błąd: ${response.status}`);
    }

    const data = await response.json();

    // Parse current weather
    data.current = {
      time: data.current.time,
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      relativeHumidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      cloudCover: data.current.cloud_cover,
      pressure: data.current.pressure_msl,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      windGusts: data.current.wind_gusts_10m,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day,
      sunrise: data.daily?.sunrise?.[0] ?? '--',
      sunset: data.daily?.sunset?.[0] ?? '--',
    };

    // Parse hourly forecast
    if (data.hourly?.time) {
      data.hourly = {
        time: data.hourly.time,
        temperature: data.hourly.temperature_2m,
        feelsLike: data.hourly.apparent_temperature,
        precipitation: data.hourly.precipitation,
        windSpeed: data.hourly.wind_speed_10m,
        windDirection: data.hourly.wind_direction_10m,
        pressure: data.hourly.pressure_msl,
        cloudCover: data.hourly.cloud_cover,
        weatherCode: data.hourly.weather_code,
        relativeHumidity: data.hourly.relative_humidity_2m,
      };
    }

    // Parse daily data
    if (data.daily?.time) {
      // Open-Meteo nie udostępnia dziennych średnich temperatury i ciśnienia,
      // więc wyliczamy je z godzinowych wartości.
      const { temperatureMean, pressureMean } = data.hourly?.time && data.hourly?.temperature_2m && data.hourly?.pressure_msl
        ? computeDailyFromHourly(
            data.hourly.time,
            data.hourly.temperature_2m,
            data.hourly.pressure_msl
          )
        : { temperatureMean: [] as number[], pressureMean: [] as number[] };

      data.daily = {
        time: data.daily.time,
        temperatureMax: data.daily.temperature_2m_max,
        temperatureMin: data.daily.temperature_2m_min,
        temperatureMean,
        precipitationSum: data.daily.precipitation_sum,
        windSpeedMax: data.daily.wind_speed_10m_max,
        windDirectionDominant: data.daily.wind_direction_10m_dominant,
        pressureMean,
        weatherCode: data.daily.weather_code,
      };
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pobierz dane historyczne (zarchiwizowane).
 */
export async function fetchHistoricalData(
  latitude: number,
  longitude: number
): Promise<OpenMeteoResponse> {
  // Use start_date and end_date to get last 3 days
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 3);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Dane godzinowe są potrzebne do obliczenia dziennych średnich.
  const url = `${ARCHIVE_URL}/archive?`
    + `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code`
    + `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,weather_code`
    + `&start_date=${startDateStr}&end_date=${endDate}`
    + `&timezone=Europe%2FWarsaw`
    + `&latitude=${latitude}&longitude=${longitude}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Open-Meteo Historical API zwróciło błąd: ${response.status}`);
    }

    const data = await response.json();

    if (data.daily?.time) {
      const { temperatureMean, pressureMean } = data.hourly?.time && data.hourly?.temperature_2m && data.hourly?.pressure_msl
        ? computeDailyFromHourly(
            data.hourly.time,
            data.hourly.temperature_2m,
            data.hourly.pressure_msl
          )
        : { temperatureMean: [] as number[], pressureMean: [] as number[] };

      data.daily = {
        time: data.daily.time,
        temperatureMax: data.daily.temperature_2m_max,
        temperatureMin: data.daily.temperature_2m_min,
        temperatureMean,
        precipitationSum: data.daily.precipitation_sum,
        windSpeedMax: data.daily.wind_speed_10m_max,
        windDirectionDominant: data.daily.wind_direction_10m_dominant,
        pressureMean,
        weatherCode: data.daily.weather_code,
      };
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pobierz dane z ostatnich 3 pełnych dni (bez dzisiejszego dnia i prognozy).
 * Używa Forecast API z past_days=3, forecast_days=0.
 * Zwraca tylko obiekt { daily: ... } — bez current/hourly.
 */
export async function fetchTrendData(
  latitude: number,
  longitude: number
): Promise<OpenMeteoResponse> {
  const url = `${BASE_URL}/forecast?`
    + `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code`
    + `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,weather_code`
    + `&past_days=3`
    + `&forecast_days=0`
    + `&timezone=Europe%2FWarsaw`
    + `&latitude=${latitude}&longitude=${longitude}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Open-Meteo Trend API zwróciło błąd: ${response.status}`);
    }

    const data = await response.json();

    if (data.daily?.time) {
      const { temperatureMean, pressureMean } = data.hourly?.time && data.hourly?.temperature_2m && data.hourly?.pressure_msl
        ? computeDailyFromHourly(
            data.hourly.time,
            data.hourly.temperature_2m,
            data.hourly.pressure_msl
          )
        : { temperatureMean: [] as number[], pressureMean: [] as number[] };

      data.daily = {
        time: data.daily.time,
        temperatureMax: data.daily.temperature_2m_max,
        temperatureMin: data.daily.temperature_2m_min,
        temperatureMean,
        precipitationSum: data.daily.precipitation_sum,
        windSpeedMax: data.daily.wind_speed_10m_max,
        windDirectionDominant: data.daily.wind_direction_10m_dominant,
        pressureMean,
        weatherCode: data.daily.weather_code,
      };
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pobierz dane morskie (fale, temperatura wody).
 */
export async function fetchMarineData(
  latitude: number,
  longitude: number
): Promise<MarineResponse> {
  const url = `${MARINE_URL}/marine?`
    + `current=wave_height,wave_direction,sea_surface_temperature`
    + `&hourly=wave_height,wave_direction,sea_surface_temperature`
    + `&timezone=Europe%2FWarsaw`
    + `&latitude=${latitude}&longitude=${longitude}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Open-Meteo Marine API zwróciło błąd: ${response.status}`);
    }

    const data = await response.json();

    // API zwraca pola w snake_case, a reszta aplikacji działa na camelCase.
    return {
      timezone: data.timezone,
      current: data.current ? {
        waveHeight: data.current.wave_height,
        waveDirection: data.current.wave_direction,
        waterTemperature: data.current.sea_surface_temperature,
      } : undefined,
      hourly: data.hourly ? {
        time: data.hourly.time,
        waveHeight: data.hourly.wave_height,
        waveDirection: data.hourly.wave_direction,
        waterTemperature: data.hourly.sea_surface_temperature,
      } : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}
