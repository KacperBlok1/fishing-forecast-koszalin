import { describe, it, expect } from 'vitest';
import { DAY_BEST_WEIGHT, MAX_WINDOW_HOURS, buildPlannerResult, findWindows } from './planner';
import { ratingLabel } from './scoring';
import { addHours, formatDayShort, formatHour, isoDate, minutesOfDay } from './time';
import { moonForDate } from './moon';
import { parseCoordinates } from './coordinates';
import type { DayPoint, HourPoint, Spot, WeatherBundle } from '../types';

const LAKE: Spot = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Jezioro testowe',
  latitude: 54.2833,
  longitude: 16.1667,
  type: 'jezioro',
  note: null,
  sortOrder: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const SEA: Spot = { ...LAKE, id: '22222222-2222-4222-8222-222222222222', name: 'Morze testowe', type: 'morze' };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Generuje przewidywalny, syntetyczny zestaw danych: 3 dni wstecz + 7 dni prognozy. */
function makeBundle(options: { withMarine?: boolean } = {}): WeatherBundle {
  const hours: HourPoint[] = [];
  const days: DayPoint[] = [];
  const startDay = 8; // 2026-09-08 → 3 dni przed "dziś" (2026-09-11)

  for (let d = 0; d < 10; d++) {
    const date = `2026-09-${pad(startDay + d)}`;
    days.push({
      date,
      sunrise: `${date}T06:00`,
      sunset: `${date}T19:00`,
      temperatureMax: 20,
      temperatureMin: 12,
      precipitationSum: 1,
      windSpeedMax: 18,
      windGustsMax: 26,
      weatherCode: 2,
    });
    for (let h = 0; h < 24; h++) {
      hours.push({
        time: `${date}T${pad(h)}:00`,
        temperature: 12 + 8 * Math.sin(((h - 4) / 24) * Math.PI),
        apparentTemperature: 15,
        humidity: 72,
        precipitation: h === 14 ? 2 : 0,
        precipitationProbability: 20,
        cloudCover: 55,
        pressure: 1014 + (h % 5) * 0.2,
        windSpeed: 9 + (h % 6),
        windDirection: 250,
        windGusts: 14 + (h % 6),
        weatherCode: 2,
        isDay: h >= 6 && h <= 19 ? 1 : 0,
      });
    }
  }

  const marine = options.withMarine
    ? {
        time: hours.map((h) => h.time),
        waveHeight: hours.map(() => 0.4),
        waveDirection: hours.map(() => 300),
        wavePeriod: hours.map(() => 4.2),
        seaSurfaceTemperature: hours.map(() => 17),
      }
    : null;

  return {
    fetchedAt: Date.parse('2026-09-11T12:00:00Z'),
    stale: false,
    timezone: 'Europe/Warsaw',
    current: hours.find((h) => h.time === '2026-09-11T12:00')!,
    hours,
    days,
    marine,
    marineRequested: Boolean(options.withMarine),
    marineError: options.withMarine ? null : null,
  };
}

describe('findWindows', () => {
  const base: HourPoint = {
    time: '2026-09-11T06:00',
    temperature: 15,
    apparentTemperature: 15,
    humidity: 70,
    precipitation: 0,
    precipitationProbability: 0,
    cloudCover: 50,
    pressure: 1015,
    windSpeed: 10,
    windDirection: 270,
    windGusts: 12,
    weatherCode: 2,
    isDay: 1,
  };

  it('znajduje ciągłe serie godzin powyżej progu', () => {
    const entries = [70, 80, 40, 90, 95, 92].map((score, index) => ({
      hour: { ...base, time: `2026-09-11T${pad(6 + index)}:00` },
      score,
    }));
    const windows = findWindows(entries, 55);
    expect(windows.length).toBe(2);
    expect(windows[0].start).toBe('2026-09-11T09:00');
    expect(windows[0].end).toBe('2026-09-11T12:00');
    expect(windows[0].score).toBe(92);
  });

  it('pomija pojedyncze godziny', () => {
    const entries = [80, 10, 80].map((score, index) => ({
      hour: { ...base, time: `2026-09-11T${pad(6 + index)}:00` },
      score,
    }));
    expect(findWindows(entries, 55)).toHaveLength(1);
  });

  it('dzieli długą serię na okna nie dłuższe niż MAX_WINDOW_HOURS', () => {
    const scores = [60, 62, 70, 88, 92, 90, 75, 64, 58];
    const entries = scores.map((score, index) => ({
      hour: { ...base, time: `2026-09-11T${pad(6 + index)}:00` },
      score,
    }));
    const windows = findWindows(entries, 55);
    expect(windows.length).toBeGreaterThan(1);
    for (const window of windows) {
      const hours = Number(window.end.slice(11, 13)) - Number(window.start.slice(11, 13));
      expect(hours).toBeLessThanOrEqual(MAX_WINDOW_HOURS);
      expect(hours).toBeGreaterThanOrEqual(2);
    }
    expect(windows[0].start).toBe('2026-09-11T09:00');
    expect(windows[0].end).toBe('2026-09-11T13:00');
  });

  it('gdy nic nie przekracza progu, zwraca najlepsze okno zastępcze', () => {
    const entries = [20, 30, 25].map((score, index) => ({
      hour: { ...base, time: `2026-09-11T${pad(6 + index)}:00` },
      score,
    }));
    const windows = findWindows(entries, 55);
    expect(windows).toHaveLength(1);
    expect(windows[0].score).toBe(28);
  });
});

describe('buildPlannerResult', () => {
  it('liczy wynik "teraz", prognozę 7-dniową i oceny godzinowe', () => {
    const result = buildPlannerResult(makeBundle(), LAKE, 'szczupak');
    expect(result.now.score).toBeGreaterThanOrEqual(0);
    expect(result.now.score).toBeLessThanOrEqual(100);
    expect(result.days).toHaveLength(7);
    expect(result.days[0].date).toBe('2026-09-11');
    expect(result.today).not.toBe(null);
    expect(result.hourly.length).toBeGreaterThan(100);
    expect(result.hourly.every((h) => h.label === ratingLabel(h.score))).toBe(true);
  });

  it('nie planuje godzin, które już minęły', () => {
    const result = buildPlannerResult(makeBundle(), LAKE, 'szczupak');
    const todayWindows = result.today?.windows ?? [];
    for (const window of todayWindows) {
      expect(window.end >= '2026-09-11T12:00').toBe(true);
    }
  });

  it('ocena dnia łączy najlepsze okno ze średnią dnia', () => {
    const result = buildPlannerResult(makeBundle(), LAKE, 'szczupak');
    const tomorrow = result.days[1];
    const expected = Math.round(
      DAY_BEST_WEIGHT * tomorrow.bestWindowScore + (1 - DAY_BEST_WEIGHT) * tomorrow.averageScore
    );
    expect(tomorrow.score).toBe(expected);
    expect(tomorrow.label).toBe(ratingLabel(tomorrow.score));
    // najlepsze okno nigdy nie jest lepsze niż najlepsza godzina tego dnia
    const tomorrowHours = result.hourly.filter((h) => isoDate(h.time) === tomorrow.date);
    expect(tomorrow.bestWindowScore).toBeLessThanOrEqual(Math.max(...tomorrowHours.map((h) => h.score)));
  });

  it('liczy trend na podstawie trzech poprzednich dni', () => {
    const result = buildPlannerResult(makeBundle(), LAKE, 'szczupak');
    expect(result.trend.hasData).toBe(true);
    expect(Number.isFinite(result.trend.temperatureChange)).toBe(true);
    expect(result.trend.rainLast3Days).toBeGreaterThan(0);
  });

  it('dla morza bez danych Marine API nie wymyśla fali', () => {
    const result = buildPlannerResult(makeBundle(), SEA, 'dorsz');
    expect(result.marine).not.toBe(null);
    expect(result.marine?.waveHeight).toBe(null);
    expect(result.marine?.safetyLevel).toBe('brak danych');
    expect(result.now.marineIncluded).toBe(false);
  });

  it('dla morza z danymi Marine API dolicza komponent fali', () => {
    const result = buildPlannerResult(makeBundle({ withMarine: true }), SEA, 'dorsz');
    expect(result.marine?.waveHeight).toBe(0.4);
    expect(result.marine?.safetyLevel).toBe('bezpiecznie');
    expect(result.now.marineIncluded).toBe(true);
  });

  it('daje ten sam wynik przy powtórnym wywołaniu', () => {
    const bundle = makeBundle();
    const a = buildPlannerResult(bundle, LAKE, 'okon');
    const b = buildPlannerResult(bundle, LAKE, 'okon');
    expect(a.now.score).toBe(b.now.score);
    expect(a.days.map((d) => d.score)).toEqual(b.days.map((d) => d.score));
  });
});

describe('narzędzia czasu', () => {
  it('czyta godzinę z lokalnego ISO bez udziału strefy przeglądarki', () => {
    expect(formatHour('2026-09-11T07:30')).toBe('07:30');
    expect(minutesOfDay('2026-09-11T07:30')).toBe(450);
    expect(isoDate('2026-09-11T07:30')).toBe('2026-09-11');
  });

  it('dodaje godziny z przejściem przez północ', () => {
    expect(addHours('2026-09-11T23:00', 1)).toBe('2026-09-12T00:00');
    expect(addHours('2026-09-30T23:00', 2)).toBe('2026-10-01T01:00');
  });

  it('formatuje skrót dnia tygodnia', () => {
    expect(formatDayShort('2026-09-11')).toBe('pt 11.09');
  });
});

describe('faza księżyca', () => {
  it('jest deterministyczna i mieści się w zakresie', () => {
    const moon = moonForDate('2026-09-11');
    expect(moon.illumination).toBeGreaterThanOrEqual(0);
    expect(moon.illumination).toBeLessThanOrEqual(1);
    expect(moonForDate('2026-09-11').phase).toBe(moon.phase);
  });

  it('dla daty referencyjnego nowiu zwraca nów', () => {
    expect(moonForDate('2000-01-07').phase).toBe('nów');
  });

  it('około 14,8 doby po nowiu wypada pełnia', () => {
    expect(moonForDate('2000-01-21').illumination).toBeGreaterThan(0.95);
  });
});

describe('parseCoordinates', () => {
  it('rozumie typowe zapisy współrzędnych', () => {
    expect(parseCoordinates('54.1943, 16.2207')).toEqual({ latitude: 54.1943, longitude: 16.2207 });
    expect(parseCoordinates('54,1943 16,2207')).toEqual({ latitude: 54.1943, longitude: 16.2207 });
    expect(parseCoordinates('54.19 N 16.22 E')).toEqual({ latitude: 54.19, longitude: 16.22 });
  });

  it('odrzuca bzdury i wartości poza zakresem', () => {
    expect(parseCoordinates('gdzieś nad wodą')).toBe(null);
    expect(parseCoordinates('123.0, 16.0')).toBe(null);
    expect(parseCoordinates('54.0')).toBe(null);
  });
});
