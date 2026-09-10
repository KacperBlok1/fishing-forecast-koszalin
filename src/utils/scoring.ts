import type {
  FishingLocationType, FishingVerdict, ForecastResult, ScoreComponent, WeatherFactor,
  BestWindow, TrendData, CurrentWeather, ForecastHourly,
  HistoricalDaily, MarineData,
} from '../types';

const MAX_SCORE = 100;
const WIND_WEIGHT = 0.25, PRESSURE_WEIGHT = 0.15, RAIN_WEIGHT = 0.15;
const TEMP_WEIGHT = 0.10, CLOUD_WEIGHT = 0.10, TIME_WEIGHT = 0.10;
const MARINE_WEIGHT = 0.15;
const WIND_THRESHOLDS: Record<FishingLocationType, { c: number; g: number; m: number; s: number; sv: number }> = {
  jezioro: { c: 5, g: 12, m: 20, s: 30, sv: 50 },
  rzeka: { c: 8, g: 15, m: 25, s: 35, sv: 55 },
  morze: { c: 10, g: 18, m: 28, s: 40, sv: 60 },
};
const WAVE_THRESHOLDS = { s: 0.5, m: 1.0, l: 2.0, d: 3.0 };
const RAIN_THRESHOLDS = { l: 0.5, m: 2.0, h: 5.0, t: 10.0 };
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function r1(n: number) { return Math.round(n * 10) / 10; }
function calcWindScore(w: number, g: number, lt: FishingLocationType): number {
  const t = WIND_THRESHOLDS[lt]; let s: number;
  if (w <= t.c) s = 45;
  else if (w <= t.g) s = lerp(85, 95, (w - t.c) / (t.g - t.c));
  else if (w <= t.m) s = lerp(80, 60, (w - t.g) / (t.m - t.g));
  else if (w <= t.s) s = lerp(55, 30, (w - t.m) / (t.s - t.m));
  else s = lerp(25, 5, (w - t.s) / (t.sv - t.s));
  if (g > 0) { const r = g / w; if (r > 2.5) s -= 15; else if (r > 1.8) s -= 8; else if (r > 1.4) s -= 3; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcPressureScore(p: number, hd: HistoricalDaily | null): number {
  let s: number; const d = Math.abs(p - 1013);
  if (d < 5) s = 90; else if (d < 15) s = 75; else if (d < 30) s = 60; else if (d < 50) s = 45; else s = 30;
  if (hd && hd.time.length >= 2) { const c = Math.abs(p - hd.pressureMean[hd.pressureMean.length - 1]); if (c < 3) s = Math.min(s, 90); else if (c < 8) s = Math.min(s, 75); else if (c < 15) s -= 10; else s -= 20; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcRainScore(cp: number, hd: HistoricalDaily | null): number {
  let s: number;
  if (cp === 0) s = 90; else if (cp <= RAIN_THRESHOLDS.l) s = 75; else if (cp <= RAIN_THRESHOLDS.m) s = 55;
  else if (cp <= RAIN_THRESHOLDS.h) s = 35; else s = 15;
  if (hd && hd.precipitationSum) { const tr = hd.precipitationSum.slice(-3).reduce((a: number, b: number) => a + b, 0); if (tr > 30) s -= 15; else if (tr > 15) s -= 8; else if (tr > 5) s -= 3; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcTempScore(temp: number, fl: number, hd: HistoricalDaily | null): number {
  let s: number;
  if (temp >= 10 && temp <= 20) s = 90; else if (temp >= 5 && temp <= 25) s = 75;
  else if (temp >= 0 && temp <= 30) s = 60; else if (temp >= -5 && temp <= 35) s = 40; else s = 25;
  const f = Math.abs(temp - fl); if (f > 10) s -= 10; else if (f > 5) s -= 5;
  if (hd && hd.temperatureMean.length >= 3) { const tr = hd.temperatureMean.slice(-3); const t = tr[tr.length - 1] - tr[0]; if (Math.abs(t) > 10) s -= 10; else if (Math.abs(t) > 5) s -= 5; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcCloudScore(cc: number): number {
  if (cc >= 30 && cc <= 70) return 90; if (cc >= 15 && cc <= 85) return 75;
  if (cc >= 0 && cc <= 100) return r1(clamp(90 - Math.abs(cc - 50) * 0.5, 50, 85));
  return 60;
}
function calcTimeScore(isDay: number, h: number): number {
  if ((h >= 5 && h <= 7) || (h >= 18 && h <= 21)) return 95;
  if (h >= 7 && h <= 9) return 85; if (h >= 16 && h <= 18) return 80;
  if (isDay === 1) return 65; return 35;
}
function calcMarineScore(wh: number, _wd: number, wt: number, _ws: number): number {
  let s: number;
  if (wh <= WAVE_THRESHOLDS.s) s = 90; else if (wh <= WAVE_THRESHOLDS.m) s = 70;
  else if (wh <= WAVE_THRESHOLDS.l) s = 45; else if (wh <= WAVE_THRESHOLDS.d) s = 25; else s = 10;
  if (wt >= 15 && wt <= 22) s = Math.min(s, 90); else if (wt >= 10 && wt <= 25) s = Math.min(s, 80); else s = Math.min(s, 60);
  return r1(clamp(s, 0, MAX_SCORE));
}
function getWD(d: number): string { const p = ['płn.', 'płn.-wsch.', 'wsch.', 'poł.-wsch.', 'poł.', 'poł.-zach.', 'zach.', 'płn.-zach.']; return p[Math.round(d / 45) % 8]; }
function getWCD(c: number): string { const m: Record<number, string> = { 0: 'Bez chmur', 1: 'Głównie bezchmurnie', 2: 'Częściowe zachmurzenie', 3: 'Pochmurno', 45: 'Mgła', 51: 'Lekka mżawka', 53: 'Mżawka', 55: 'Mżawka intensywna', 61: 'Lekki deszcz', 63: 'Deszcz', 65: 'Deszcz nawalny', 71: 'Lekki śnieg', 73: 'Śnieg', 80: 'Opady przelotne', 95: 'Burza' }; return m[c] || 'Nieznany'; }
function getWindDesc(sp: number, lt: FishingLocationType): string { const t = WIND_THRESHOLDS[lt]; if (sp <= t.c) return 'Zerowy wiatr.'; if (sp <= t.g) return 'Lekki wiatr - pomaga.'; if (sp <= t.m) return 'Umiarkowany wiatr.'; if (sp <= t.s) return 'Silny wiatr.'; return 'Bardzo silny wiatr!'; }
function getPresDesc(p: number): string { if (p > 1018) return 'Wysokie ciśnienie.'; if (p > 1005) return 'Ciśnienie w normie.'; if (p > 990) return 'Obniżone ciśnienie.'; return 'Bardzo niskie ciśnienie!'; }
function getRainDesc(p: number): string { if (p === 0) return 'Brak opadów.'; if (p <= RAIN_THRESHOLDS.l) return 'Lekka mżawka.'; if (p <= RAIN_THRESHOLDS.m) return 'Umiarkowane opady.'; if (p <= RAIN_THRESHOLDS.h) return 'Silne opady.'; return 'Ulewa!'; }
function getTempDesc(t: number): string { if (t >= 15 && t <= 22) return 'Idealna temperatura.'; if (t >= 10 && t <= 25) return 'Dobra temperatura.'; if (t >= 5 && t <= 30) return 'Umiarkowana temperatura.'; return 'Ekstremalna temperatura.'; }
function getCloudDesc(c: number): string { if (c >= 30 && c <= 70) return 'Częściowe zachmurzenie.'; if (c >= 15 && c <= 85) return 'Umiarkowane zachmurzenie.'; if (c === 0) return 'Czyste niebo.'; return 'Całkowite zachmurzenie.'; }
function getWaveDesc(h: number): string { if (h <= WAVE_THRESHOLDS.s) return 'Małe fale.'; if (h <= WAVE_THRESHOLDS.m) return 'Umiarkowane fale.'; if (h <= WAVE_THRESHOLDS.l) return 'Duże fale.'; return 'Bardzo duże fale!'; }

/** Dodaje godzinę do ISO-time stringa (np. "2024-08-20T14:00" → "2024-08-20T15:00"). */
function addOneHour(iso: string): string {
  const [datePart, timePart] = iso.split('T');
  const [h, m] = timePart.split(':');
  const totalMin = parseInt(h, 10) * 60 + parseInt(m, 10) + 60;
  const nh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const nm = String(totalMin % 60).padStart(2, '0');
  return `${datePart}T${nh}:${nm}`;
}

/**
 * Wyciąga godzinę i minutę bezpośrednio z tekstu ISO zwróconego przez Open-Meteo
 * (już w strefie czasowej wybranej lokalizacji, np. Europe/Warsaw), zamiast
 * odczytywać czas z zegara przeglądarki użytkownika. Dzięki temu ocena "pory dnia"
 * jest poprawna również wtedy, gdy urządzenie użytkownika ma ustawioną inną strefę
 * czasową niż lokalizacja łowiska (np. w trakcie podróży).
 */
function getIsoHourMinute(iso: string): { hour: number; minute: number } {
  const timePart = iso?.split('T')[1];
  if (!timePart) { const d = new Date(); return { hour: d.getHours(), minute: d.getMinutes() }; }
  const [hh, mm] = timePart.split(':');
  const hour = parseInt(hh, 10);
  const minute = parseInt(mm ?? '0', 10);
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function findBestWindows(h: ForecastHourly, currentTime: string, _m: MarineData | null, lt: FishingLocationType): BestWindow[] {
  const wins: BestWindow[] = [];
  const fd = h.time.map((t, i) => ({ time: t, temp: h.temperature[i], precip: h.precipitation[i], wind: h.windSpeed[i], cc: h.cloudCover[i], wc: h.weatherCode[i] }));
  // Czas z Open-Meteo jest już w strefie Europe/Warsaw; porównujemy jego
  // tekstową reprezentację ISO, zamiast mieszać ją ze strefą przeglądarki.
  const fh = fd.filter(x => x.time >= currentTime);
  for (let i = 0; i <= fh.length - 3; i++) {
    const w = fh.slice(i, i + 3);
    const at = w.reduce((a, b) => a + b.temp, 0) / w.length;
    const ap = w.reduce((a, b) => a + b.precip, 0) / w.length;
    const aw = w.reduce((a, b) => a + b.wind, 0) / w.length;
    const mp = Math.max(...w.map(x => x.precip));
    let ws = 0;
    ws += calcTempScore(at, at, null); ws += calcWindScore(aw, aw * 1.3, lt); ws += calcRainScore(ap, null); ws += calcCloudScore(w[1]?.cc ?? 50); ws += calcTimeScore(1, getIsoHourMinute(w[1].time).hour); ws = r1(ws / 5);
    if (ws > 50 && mp < RAIN_THRESHOLDS.h) {
      wins.push({ start: w[0].time, end: addOneHour(w[2].time), score: Math.round(ws), temperature: r1(at), windSpeed: r1(aw), precipitation: r1(ap), weatherCode: w[1].wc });
    }
  }
  return wins.sort((a, b) => b.score - a.score).slice(0, 3);
}
/**
 * Oblicza zmianę wartości na podstawie dwóch poprawnych (skończonych) liczb.
 * Zwraca obiekt z { change: liczba; hasData: true } gdy >= 2 wartości,
 * lub { change: 0; hasData: false } gdy < 2 wartości.
 */
export function computeTrendChange(values: number[]): { change: number; hasData: boolean } {
  const finite = values.filter(v => Number.isFinite(v));
  if (finite.length < 2) return { change: 0, hasData: false };
  return { change: r1(finite[finite.length - 1] - finite[0]), hasData: true };
}

/**
 * Odfiltruj dzisiejszy dzień i przyszłe daty z danych trendu.
 * Zwraca nowy HistoricalDaily zawierający tylko pełne dni przed dziś.
 * Zwraca null, jeśli nie ma żadnych dni przed dziś.
 */
export function filterTrendDays(hd: HistoricalDaily | null | undefined): HistoricalDaily | null {
  if (!hd || !hd.time) return null;
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find(p => p.type === type)?.value;
  const todayStr = `${part('year')}-${part('month')}-${part('day')}`;
  const indices: number[] = [];
  for (let i = 0; i < hd.time.length; i++) {
    if (hd.time[i] < todayStr) indices.push(i);
  }
  if (indices.length === 0) return null;

  return {
    time: indices.map(i => hd.time[i]),
    temperatureMax: indices.map(i => hd.temperatureMax[i]),
    temperatureMin: indices.map(i => hd.temperatureMin[i]),
    temperatureMean: indices.map(i => hd.temperatureMean[i]),
    precipitationSum: indices.map(i => hd.precipitationSum[i]),
    windSpeedMax: indices.map(i => hd.windSpeedMax[i]),
    windDirectionDominant: indices.map(i => hd.windDirectionDominant[i]),
    pressureMean: indices.map(i => hd.pressureMean[i]),
    weatherCode: indices.map(i => hd.weatherCode[i]),
  };
}

export function calcTrend(hd: HistoricalDaily | null): TrendData {
  if (!hd || hd.time.length < 2) return { temperatureChange: 0, pressureChange: 0, totalRain: 0, windTrend: 'stabilny', improvement: false };
  const tm = hd.temperatureMean.slice(-3), pr = hd.pressureMean.slice(-3);
  const tempResult = computeTrendChange(tm);
  const presResult = computeTrendChange(pr);
  const improvement = tempResult.hasData && presResult.hasData;
  const rn = hd.precipitationSum.slice(-3);
  return {
    temperatureChange: tempResult.change,
    pressureChange: presResult.change,
    totalRain: rn.reduce((a: number, b: number) => a + b, 0),
    windTrend: 'stabilny',
    improvement,
  };
}

export function calculateFishingScore(current: CurrentWeather, hourly: ForecastHourly, historicalDaily: HistoricalDaily | null, marineData: MarineData | null, locationType: FishingLocationType): ForecastResult {
  const { hour, minute } = getIsoHourMinute(current.time);
  const ws = calcWindScore(current.windSpeed, current.windGusts, locationType);
  const ps = calcPressureScore(current.pressure, historicalDaily);
  const rs = calcRainScore(current.precipitation, historicalDaily);
  const ts = calcTempScore(current.temperature, current.feelsLike, historicalDaily);
  const cs = calcCloudScore(current.cloudCover);
  const tis = calcTimeScore(current.isDay, hour);
  const marineApplicable = locationType === "morze" && !!marineData?.current;
  const ms = marineApplicable ? calcMarineScore(marineData!.current!.waveHeight, marineData!.current!.waveDirection, marineData!.current!.waterTemperature, current.windSpeed) : 0;
  // Wagi sumują się do 1.0 tylko gdy dostępny jest komponent morski (tryb "morze").
  // Dla jeziora/rzeki (bez danych morskich) trzeba znormalizować przez faktycznie
  // użytą sumę wag, inaczej maksymalny możliwy wynik wynosiłby 85, a nie 100.
  const usedWeightSum = WIND_WEIGHT + PRESSURE_WEIGHT + RAIN_WEIGHT + TEMP_WEIGHT + CLOUD_WEIGHT + TIME_WEIGHT + (marineApplicable ? MARINE_WEIGHT : 0);
  let totalScore = (ws * WIND_WEIGHT + ps * PRESSURE_WEIGHT + rs * RAIN_WEIGHT + ts * TEMP_WEIGHT + cs * CLOUD_WEIGHT + tis * TIME_WEIGHT + ms * MARINE_WEIGHT) / usedWeightSum;
  totalScore = Math.round(clamp(totalScore, 0, MAX_SCORE));
  let verdict: FishingVerdict, verdictLabel: string, verdictIcon: string;
  if (totalScore >= 75) { verdict = "go"; verdictLabel = "Idź na ryby!"; verdictIcon = "\u{1F7E2}"; }
  else if (totalScore >= 45) { verdict = "conditional"; verdictLabel = "Warunkowo"; verdictIcon = "\u{1F7E1}"; }
  else { verdict = "skip"; verdictLabel = "Lepiej odpuść"; verdictIcon = "\u{1F534}"; }
  const components: ScoreComponent[] = [
    { name: "Wiatr", weight: WIND_WEIGHT, score: ws, maxScore: MAX_SCORE, details: ["Prędkość: " + current.windSpeed + " km/h", "Porywy: " + current.windGusts + " km/h", "Kierunek: " + getWD(current.windDirection)] },
    { name: "Ciśnienie", weight: PRESSURE_WEIGHT, score: ps, maxScore: MAX_SCORE, details: ["Ciśnienie: " + current.pressure + " hPa"] },
    { name: "Opady", weight: RAIN_WEIGHT, score: rs, maxScore: MAX_SCORE, details: ["Aktualnie: " + current.precipitation + " mm/h", "Typ: " + getWCD(current.weatherCode)] },
    { name: "Temperatura", weight: TEMP_WEIGHT, score: ts, maxScore: MAX_SCORE, details: ["Aktualna: " + current.temperature + "°C", "Odczuwalna: " + current.feelsLike + "°C"] },
    { name: "Zachmurzenie", weight: CLOUD_WEIGHT, score: cs, maxScore: MAX_SCORE, details: ["Chmury: " + current.cloudCover + "%"] },
    { name: "Pora dnia", weight: TIME_WEIGHT, score: tis, maxScore: MAX_SCORE, details: [current.isDay === 1 ? "Dzień" : "Noc"] },
  ];
  if (marineApplicable) components.push({ name: "Dane morskie", weight: MARINE_WEIGHT, score: ms, maxScore: MAX_SCORE, details: ["Fala: " + marineData!.current!.waveHeight + " m", "Woda: " + marineData!.current!.waterTemperature + "°C"] });
  const factors: WeatherFactor[] = [];
  const addF = (n: string, ic: string, v: string, imp: WeatherFactor["impact"], ds: string) => factors.push({ name: n, icon: ic, value: v, impact: imp, description: ds });
  addF("Wiatr", "\u{1F4A8}", current.windSpeed + " km/h", ws >= 70 ? "positive" : ws >= 45 ? "neutral" : "negative", getWindDesc(current.windSpeed, locationType));
  addF("Ciśnienie", "\u{1F771}", current.pressure + " hPa", ps >= 75 ? "positive" : ps >= 60 ? "neutral" : "negative", getPresDesc(current.pressure));
  addF("Opady", "\u{1F327}️", current.precipitation > 0 ? current.precipitation + " mm/h" : "Brak opadów", rs >= 75 ? "positive" : rs >= 55 ? "neutral" : "negative", getRainDesc(current.precipitation));
  addF("Temperatura", "\u{1F771}", current.temperature + "°C (odczuwalna: " + current.feelsLike + "°C)", ts >= 75 ? "positive" : ts >= 60 ? "neutral" : "negative", getTempDesc(current.temperature));
  addF("Zachmurzenie", "☁", current.cloudCover + "%", cs >= 75 ? "positive" : cs >= 60 ? "neutral" : "negative", getCloudDesc(current.cloudCover));
  addF("Pora dnia", current.isDay === 1 ? "☀" : "\u{1F319}", String(hour).padStart(2, '0') + ":" + String(minute).padStart(2, '0'), tis >= 80 ? "positive" : "neutral", tis >= 80 ? "Sprzyjająca pora aktywności ryb." : "Nieidealna pora.");
  if (marineApplicable) {
    const msc = ms;
    addF("Fale (morze)", "\u{1F30A}", marineData!.current!.waveHeight + " m", msc >= 70 ? "positive" : msc >= 45 ? "neutral" : "negative", getWaveDesc(marineData!.current!.waveHeight));
    addF("Temperatura morza", "\u{1F30A}", marineData!.current!.waterTemperature + "°C", "neutral", "Woda: " + marineData!.current!.waterTemperature + "°C");
  }
  const keyFactors = factors.filter(f => f.impact !== "neutral").sort((a, b) => ({ positive: 1, negative: -1, neutral: 0 }[b.impact] - { positive: 1, negative: -1, neutral: 0 }[a.impact])).slice(0, 4).map(f => f.icon + " " + f.name + ": " + f.description);
  const bestWindows = findBestWindows(hourly, current.time, marineData, locationType);
  const trend = calcTrend(historicalDaily);
  const calculationNotes: string[] = [];
  if (totalScore >= 75) calculationNotes.push("\u{1F7E2} Warunki bardzo sprzyjające!");
  else if (totalScore >= 45) calculationNotes.push("\u{1F7E1} Warunki umiarkowane.");
  else calculationNotes.push("\u{1F534} Warunki niezbyt sprzyjające.");
  if (locationType === "morze" && marineData?.current && marineData.current.waveHeight > WAVE_THRESHOLDS.l) calculationNotes.push("⚠️ Fale powyżej 2m!");
  if (locationType === "morze" && !marineData?.current) calculationNotes.push("⚠️ Brak danych morskich — wynik uwzględnia to ostrożnościowo.");
  if (current.windGusts > current.windSpeed * 2) calculationNotes.push("\u{1F4A8} Zmienny wiatr z podmuchami.");
  if (current.pressure < 990) calculationNotes.push("\u{1F327}️ Niskie ciśnienie.");
  return { score: totalScore, verdict, verdictLabel, verdictIcon, components, factors, bestWindows, trend, keyFactors, calculationNotes };
}
