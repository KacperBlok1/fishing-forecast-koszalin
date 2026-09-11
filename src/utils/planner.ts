import type {
  DayOutlook,
  DayPoint,
  FishingWindow,
  HourPoint,
  HourScore,
  MarineSnapshot,
  MoonInfo,
  PlannerResult,
  Spot,
  SpeciesId,
  TrendSummary,
  WeatherBundle,
} from '../types';
import { moonForDate } from './moon';
import {
  WINDOW_MIN_SCORE,
  computeScore,
  ratingLabel,
  scoreStability,
  waveSafety,
} from './scoring';
import type { ScoreContext } from './scoring';
import { addHours, isoDate, minutesOfDay } from './time';

/** Ile dni prognozy pokazujemy w zakładce "7 dni". */
export const OUTLOOK_DAYS = 7;

/** Szerokość okna (w godzinach w każdą stronę) używanego do oceny stabilności. */
const STABILITY_WINDOW = 12;

/** Udział najlepszego okna w ocenie całego dnia; reszta to średnia z godzin dziennych. */
export const DAY_BEST_WEIGHT = 0.65;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}

function range(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  return Math.max(...finite) - Math.min(...finite);
}

/** Maksymalna długość jednego okna połowowego (godziny). */
export const MAX_WINDOW_HOURS = 4;

type ScoredHour = { hour: HourPoint; score: number };

function averageScore(run: ScoredHour[]): number {
  return run.reduce((sum, entry) => sum + entry.score, 0) / run.length;
}

/**
 * Dzieli długą serię dobrych godzin na okna o praktycznej długości.
 * "Od 18:00 do północy" nie jest użyteczną wskazówką — bierzemy więc
 * najlepszy fragment o długości MAX_WINDOW_HOURS, a resztę serii
 * przetwarzamy tak samo, o ile zostały w niej co najmniej dwie godziny.
 */
function splitRun(run: ScoredHour[]): FishingWindow[] {
  if (run.length <= MAX_WINDOW_HOURS) return [toWindow(run)];

  let bestIndex = 0;
  let bestAverage = -1;
  for (let i = 0; i + MAX_WINDOW_HOURS <= run.length; i++) {
    const average = averageScore(run.slice(i, i + MAX_WINDOW_HOURS));
    if (average > bestAverage) {
      bestAverage = average;
      bestIndex = i;
    }
  }

  const before = run.slice(0, bestIndex);
  const after = run.slice(bestIndex + MAX_WINDOW_HOURS);
  return [
    toWindow(run.slice(bestIndex, bestIndex + MAX_WINDOW_HOURS)),
    ...(before.length >= 2 ? splitRun(before) : []),
    ...(after.length >= 2 ? splitRun(after) : []),
  ];
}

/**
 * Wyszukuje ciągłe "okna połowowe" — serie godzin o wyniku >= progu,
 * dzielone na fragmenty nie dłuższe niż MAX_WINDOW_HOURS.
 * Gdy żadna godzina nie przekracza progu, zwracamy najlepsze dostępne
 * okno dwugodzinne, żeby użytkownik zawsze widział, kiedy jest najmniej źle.
 */
export function findWindows(
  entries: ScoredHour[],
  minScore: number = WINDOW_MIN_SCORE
): FishingWindow[] {
  const windows: FishingWindow[] = [];
  let run: ScoredHour[] = [];

  const flush = () => {
    if (run.length >= 2) windows.push(...splitRun(run));
    run = [];
  };

  for (const entry of entries) {
    if (entry.score >= minScore) run.push(entry);
    else flush();
  }
  flush();

  if (windows.length === 0 && entries.length >= 2) {
    let best: FishingWindow | null = null;
    for (let i = 0; i <= entries.length - 2; i++) {
      const candidate = toWindow(entries.slice(i, i + 2));
      if (!best || candidate.score > best.score) best = candidate;
    }
    if (best) windows.push(best);
  }

  return windows.sort((a, b) => b.score - a.score).slice(0, 3);
}

function toWindow(run: ScoredHour[]): FishingWindow {
  const scores = run.map((r) => r.score);
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const middle = run[Math.floor(run.length / 2)];
  return {
    start: run[0].hour.time,
    end: addHours(run[run.length - 1].hour.time, 1),
    score,
    label: ratingLabel(score),
    averageTemperature: round1(mean(run.map((r) => r.hour.temperature)) ?? 0),
    averageWind: round1(mean(run.map((r) => r.hour.windSpeed)) ?? 0),
    maxPrecipitation: round1(Math.max(...run.map((r) => r.hour.precipitation))),
    weatherCode: middle.hour.weatherCode,
  };
}

/** Buduje komplet wyników dla wybranego łowiska i gatunku. */
export function buildPlannerResult(bundle: WeatherBundle, spot: Spot, speciesId: SpeciesId): PlannerResult {
  const today = isoDate(bundle.current.time);
  const dayByDate = new Map<string, DayPoint>();
  for (const day of bundle.days) dayByDate.set(day.date, day);

  const moonCache = new Map<string, MoonInfo>();
  const moonFor = (date: string): MoonInfo => {
    const cached = moonCache.get(date);
    if (cached) return cached;
    const info = moonForDate(date);
    moonCache.set(date, info);
    return info;
  };

  // ---- Baza porównawcza: trzy pełne dni przed dzisiejszym ----
  const pastDays = bundle.days.filter((d) => d.date < today).slice(-3);
  const baselineTemperature = mean(
    pastDays.map((d) => (d.temperatureMax + d.temperatureMin) / 2)
  );
  const rainLast3Days = pastDays.reduce((sum, d) => sum + (Number.isFinite(d.precipitationSum) ? d.precipitationSum : 0), 0);

  // ---- Dane morskie po czasie ----
  const waveByTime = new Map<string, number>();
  const waterTempByTime = new Map<string, number>();
  const wavePeriodByTime = new Map<string, number>();
  const waveDirectionByTime = new Map<string, number>();
  if (bundle.marine) {
    const m = bundle.marine;
    for (let i = 0; i < m.time.length; i++) {
      const t = m.time[i];
      const h = m.waveHeight[i];
      if (typeof h === 'number' && Number.isFinite(h)) waveByTime.set(t, h);
      const w = m.seaSurfaceTemperature[i];
      if (typeof w === 'number' && Number.isFinite(w)) waterTempByTime.set(t, w);
      const p = m.wavePeriod[i];
      if (typeof p === 'number' && Number.isFinite(p)) wavePeriodByTime.set(t, p);
      const d = m.waveDirection[i];
      if (typeof d === 'number' && Number.isFinite(d)) waveDirectionByTime.set(t, d);
    }
  }

  const hours = bundle.hours;

  const contextFor = (index: number, override?: HourPoint): ScoreContext => {
    const hour = override ?? hours[index];
    const date = isoDate(hour.time);
    const day = dayByDate.get(date);
    const sunriseMinutes = day ? minutesOfDay(day.sunrise) : 5 * 60;
    const sunsetMinutes = day ? minutesOfDay(day.sunset) : 20 * 60;

    const previous = index >= 24 ? hours[index - 24] : null;
    const pressureChange24h =
      previous && Number.isFinite(previous.pressure) && Number.isFinite(hour.pressure)
        ? round1(hour.pressure - previous.pressure)
        : null;

    const temperatureChange =
      baselineTemperature !== null && Number.isFinite(hour.temperature)
        ? round1(hour.temperature - baselineTemperature)
        : null;

    const from = Math.max(0, index - STABILITY_WINDOW);
    const to = Math.min(hours.length, index + STABILITY_WINDOW + 1);
    const slice = hours.slice(from, to);

    return {
      hour,
      locationType: spot.type,
      sunriseMinutes,
      sunsetMinutes,
      moon: moonFor(date),
      pressureChange24h,
      temperatureChange,
      pressureRange: range(slice.map((h) => h.pressure)),
      windRange: range(slice.map((h) => h.windSpeed)),
      waveHeight: spot.type === 'morze' ? (waveByTime.get(hour.time) ?? null) : null,
    };
  };

  // ---- Wynik "teraz" ----
  const currentHourKey = `${isoDate(bundle.current.time)}T${bundle.current.time.slice(11, 13)}:00`;
  let nowIndex = hours.findIndex((h) => h.time === currentHourKey);
  if (nowIndex === -1) {
    nowIndex = hours.findIndex((h) => h.time >= bundle.current.time);
  }
  if (nowIndex === -1) nowIndex = Math.max(0, hours.length - 1);

  const nowContext = contextFor(nowIndex, { ...bundle.current, time: bundle.current.time });
  const now = computeScore(nowContext, speciesId);

  // ---- Oceny godzinowe od dziś w przód ----
  const hourly: HourScore[] = [];
  const scoredByDate = new Map<string, { hour: HourPoint; score: number }[]>();

  for (let i = 0; i < hours.length; i++) {
    const hour = hours[i];
    const date = isoDate(hour.time);
    if (date < today) continue;
    const score = computeScore(contextFor(i), speciesId).score;
    hourly.push({ time: hour.time, score, label: ratingLabel(score) });
    const list = scoredByDate.get(date) ?? [];
    list.push({ hour, score });
    scoredByDate.set(date, list);
  }

  // ---- Prognoza dzienna ----
  const days: DayOutlook[] = [];
  const futureDates = Array.from(scoredByDate.keys()).sort().slice(0, OUTLOOK_DAYS);

  for (const date of futureDates) {
    const day = dayByDate.get(date);
    const entries = scoredByDate.get(date) ?? [];
    if (!day || entries.length === 0) continue;

    // Dla dzisiaj planujemy tylko to, co jeszcze przed nami.
    const relevant =
      date === today ? entries.filter((e) => e.hour.time >= currentHourKey) : entries;
    const planning = relevant.length >= 2 ? relevant : entries;

    const sunriseMinutes = minutesOfDay(day.sunrise);
    const sunsetMinutes = minutesOfDay(day.sunset);
    const daylight = entries.filter((e) => {
      const m = minutesOfDay(e.hour.time);
      return m >= sunriseMinutes - 60 && m <= sunsetMinutes + 60;
    });

    const windows = findWindows(planning);
    const bestWindowScore = windows.length
      ? Math.max(...windows.map((w) => w.score))
      : Math.max(...planning.map((e) => e.score));
    const averageScore = Math.round(mean((daylight.length ? daylight : entries).map((e) => e.score)) ?? 0);
    const score = Math.round(
      DAY_BEST_WEIGHT * bestWindowScore + (1 - DAY_BEST_WEIGHT) * averageScore
    );

    days.push({
      date,
      sunrise: day.sunrise,
      sunset: day.sunset,
      temperatureMax: day.temperatureMax,
      temperatureMin: day.temperatureMin,
      precipitationSum: day.precipitationSum,
      windSpeedMax: day.windSpeedMax,
      weatherCode: day.weatherCode,
      moon: moonFor(date),
      score,
      label: ratingLabel(score),
      bestWindowScore,
      averageScore,
      windows,
    });
  }

  // ---- Trend ----
  const todayEntries = scoredByDate.get(today) ?? [];
  const todayMeanTemperature = mean(todayEntries.map((e) => e.hour.temperature));
  const stabilityScore =
    nowContext.pressureRange !== null && nowContext.windRange !== null
      ? scoreStability(nowContext.pressureRange, nowContext.windRange)
      : 65;

  const trend: TrendSummary = {
    temperatureChange:
      baselineTemperature !== null && todayMeanTemperature !== null
        ? round1(todayMeanTemperature - baselineTemperature)
        : 0,
    pressureChange24h: nowContext.pressureChange24h ?? 0,
    rainLast3Days: round1(rainLast3Days),
    stable: stabilityScore >= 72,
    stabilityScore,
    hasData: baselineTemperature !== null && pastDays.length >= 2,
  };

  // ---- Migawka morska ----
  let marine: MarineSnapshot | null = null;
  if (spot.type === 'morze') {
    const waveHeight = waveByTime.get(currentHourKey) ?? null;
    const safety = waveSafety(waveHeight);
    marine = {
      waveHeight,
      wavePeriod: wavePeriodByTime.get(currentHourKey) ?? null,
      waveDirection: waveDirectionByTime.get(currentHourKey) ?? null,
      waterTemperature: waterTempByTime.get(currentHourKey) ?? null,
      safetyLevel: safety.level,
      safetyNote: safety.note,
    };
  }

  return {
    spotId: spot.id,
    spotName: spot.name,
    locationType: spot.type,
    speciesId,
    fetchedAt: bundle.fetchedAt,
    now,
    nowHour: bundle.current,
    today: days.find((d) => d.date === today) ?? null,
    days,
    hourly,
    trend,
    marine,
    marineRequested: bundle.marineRequested,
    marineError: bundle.marineError,
  };
}
