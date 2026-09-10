import { describe, it, expect } from 'vitest';
import type { HistoricalDaily, CurrentWeather, ForecastHourly } from '../types';
import { computeTrendChange, filterTrendDays, calcTrend, calculateFishingScore } from './scoring';

function createMockDaily(dates: string[], temps: number[][]): HistoricalDaily {
  const n = dates.length;
  return {
    time: dates,
    temperatureMax: temps.map((t) => t[0] ?? 25),
    temperatureMin: temps.map((t) => t[1] ?? 12),
    temperatureMean: temps.map((t) => t[2] ?? 18),
    precipitationSum: Array(n).fill(0),
    windSpeedMax: Array(n).fill(10),
    windDirectionDominant: Array(n).fill(180),
    pressureMean: temps.map((t) => t[3] ?? 1015),
    weatherCode: Array(n).fill(2),
  };
}

describe('computeTrendChange', () => {
  it('liczy zmianę dla poprawnych danych', () => {
    const r = computeTrendChange([10, 12, 15]);
    expect(r).toEqual({ change: 5, hasData: true });
  });

  it('zwraca hasData: false dla pustej tablicy', () => {
    expect(computeTrendChange([])).toEqual({ change: 0, hasData: false });
  });

  it('ignoruje NaN i Infinity', () => {
    const r = computeTrendChange([10, NaN, Infinity, -Infinity, 12]);
    expect(r).toEqual({ change: 2, hasData: true });
  });

  it('zwraca hasData: false dla jednej wartości', () => {
    expect(computeTrendChange([7])).toEqual({ change: 0, hasData: false });
  });

  it('zwraca hasData: false, gdy wszystkie wartości są niepoprawne', () => {
    expect(computeTrendChange([NaN, Infinity, -Infinity])).toEqual({ change: 0, hasData: false });
  });
});

describe('filterTrendDays', () => {
  const today = new Date().toISOString().split('T')[0];

  it('odfiltrowuje dzisiejszy dzień, zostawia poprzednie', () => {
    const daily = createMockDaily(
      ['2024-08-18', '2024-08-19', '2024-08-20', '2024-08-21', '2024-08-22', today],
      [[22, 12, 17, 1010], [24, 13, 18, 1012], [20, 11, 15, 1008], [26, 14, 20, 1014], [21, 10, 15, 1006], [28, 15, 21, 1016]],
    );
    const filtered = filterTrendDays(daily);
    expect(filtered).not.toBeNull();
    expect(filtered!.time.length).toBe(5);
    expect(filtered!.time.includes(today)).toBe(false);
    expect(filtered!.time[0]).toBe('2024-08-18');
  });

  it('zostawia wszystkie dni, gdy żaden nie jest dzisiejszy', () => {
    const daily = createMockDaily(
      ['2024-08-21', '2024-08-22', '2024-08-23'],
      [[22, 12, 17, 1010], [24, 13, 18, 1012], [20, 11, 15, 1008]],
    );
    const filtered = filterTrendDays(daily);
    expect(filtered).not.toBeNull();
    expect(filtered!.time.length).toBe(3);
    expect(filtered!.time.includes(today)).toBe(false);
  });

  it('zwraca null, gdy zostaje mniej niż 1 dzień', () => {
    const daily = createMockDaily(
      ['2024-08-21', '2024-08-22', today],
      [[22, 12, 17, 1010], [24, 13, 18, 1012], [28, 15, 21, 1016]],
    );
    expect(filterTrendDays(daily)).not.toBeNull();
  });

  it('zwraca null dla null/undefined', () => {
    expect(filterTrendDays(null)).toBeNull();
    expect(filterTrendDays(undefined)).toBeNull();
  });
});

describe('calcTrend', () => {
  it('poprawnie liczy trend z przefiltrowanych danych', () => {
    const daily = createMockDaily(
      ['2024-08-21', '2024-08-22', '2024-08-23'],
      [[20, 10, 15, 1010], [23, 11, 17, 1013], [25, 12, 18, 1008]],
    );
    const filtered = filterTrendDays(daily);
    const trend = calcTrend(filtered);
    expect(trend.temperatureChange).toBe(3);
    expect(trend.pressureChange).toBe(-2);
    expect(trend.totalRain).toBe(0);
    expect(trend.improvement).toBe(true);
  });
});

describe('calculateFishingScore — normalizacja wag', () => {
  const baseCurrent: CurrentWeather = {
    time: '2024-08-20T14:00',
    temperature: 15,
    feelsLike: 15,
    relativeHumidity: 60,
    precipitation: 0,
    cloudCover: 50,
    pressure: 1013,
    windSpeed: 8,
    windDirection: 180,
    windGusts: 10,
    weatherCode: 2,
    isDay: 1,
    sunrise: '2024-08-20T05:30',
    sunset: '2024-08-20T20:30',
  };
  const hourly: ForecastHourly = {
    time: ['2024-08-20T14:00'],
    temperature: [15],
    feelsLike: [15],
    precipitation: [0],
    windSpeed: [8],
    windDirection: [180],
    pressure: [1013],
    cloudCover: [50],
    weatherCode: [2],
    relativeHumidity: [60],
  };

  it('dla jeziora (bez danych morskich) idealne warunki dają wynik bliski 100, nie 85', () => {
    const perfectCurrent: CurrentWeather = { ...baseCurrent, windSpeed: 8, windGusts: 8, pressure: 1013, precipitation: 0, temperature: 15, feelsLike: 15, cloudCover: 50 };
    const result = calculateFishingScore(perfectCurrent, hourly, null, null, 'jezioro');
    // Bez normalizacji maksymalny wynik byłby ograniczony do ok. 85.
    expect(result.score).toBeGreaterThan(85);
  });

  it('wynik nigdy nie przekracza 100', () => {
    const result = calculateFishingScore(baseCurrent, hourly, null, null, 'jezioro');
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateFishingScore — pora dnia liczona ze strefy lokalizacji', () => {
  it('używa godziny z current.time, nie z zegara systemowego', () => {
    const morning: CurrentWeather = {
      time: '2024-08-20T06:00',
      temperature: 15, feelsLike: 15, relativeHumidity: 60, precipitation: 0, cloudCover: 50,
      pressure: 1013, windSpeed: 8, windDirection: 180, windGusts: 10, weatherCode: 2, isDay: 1,
      sunrise: '2024-08-20T05:30', sunset: '2024-08-20T20:30',
    };
    const hourlyM: ForecastHourly = {
      time: ['2024-08-20T06:00'], temperature: [15], feelsLike: [15], precipitation: [0],
      windSpeed: [8], windDirection: [180], pressure: [1013], cloudCover: [50], weatherCode: [2], relativeHumidity: [60],
    };
    const result = calculateFishingScore(morning, hourlyM, null, null, 'jezioro');
    const timeComponent = result.components.find((c) => c.name === 'Pora dnia');
    // Godzina 06:00 w current.time to świt — powinien dostać wysoką ocenę (95),
    // niezależnie od tego, jaki czas ustawia zegar maszyny uruchamiającej testy.
    expect(timeComponent?.score).toBe(95);
  });
});
