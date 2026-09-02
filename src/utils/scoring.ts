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
  const t = WIND_THRESHOLDS[lt]; let s = MAX_SCORE;
  if (w <= t.c) s = 45;
  else if (w <= t.g) s = lerp(85, 95, (w - t.c) / (t.g - t.c));
  else if (w <= t.m) s = lerp(80, 60, (w - t.g) / (t.m - t.g));
  else if (w <= t.s) s = lerp(55, 30, (w - t.m) / (t.s - t.m));
  else s = lerp(25, 5, (w - t.s) / (t.sv - t.s));
  if (g > 0) { const r = g / w; if (r > 2.5) s -= 15; else if (r > 1.8) s -= 8; else if (r > 1.4) s -= 3; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcPressureScore(p: number, hd: HistoricalDaily | null): number {
  let s = MAX_SCORE; const d = Math.abs(p - 1013);
  if (d < 5) s = 90; else if (d < 15) s = 75; else if (d < 30) s = 60; else if (d < 50) s = 45; else s = 30;
  if (hd && hd.time.length >= 2) { const c = Math.abs(p - hd.pressureMean[hd.pressureMean.length - 1]); if (c < 3) s = Math.min(s, 90); else if (c < 8) s = Math.min(s, 75); else if (c < 15) s -= 10; else s -= 20; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcRainScore(cp: number, hd: HistoricalDaily | null): number {
  let s = MAX_SCORE;
  if (cp === 0) s = 90; else if (cp <= RAIN_THRESHOLDS.l) s = 75; else if (cp <= RAIN_THRESHOLDS.m) s = 55;
  else if (cp <= RAIN_THRESHOLDS.h) s = 35; else s = 15;
  if (hd && hd.precipitationSum) { const tr = hd.precipitationSum.slice(-3).reduce((a: number, b: number) => a + b, 0); if (tr > 30) s -= 15; else if (tr > 15) s -= 8; else if (tr > 5) s -= 3; }
  return r1(clamp(s, 0, MAX_SCORE));
}
function calcTempScore(temp: number, fl: number, hd: HistoricalDaily | null): number {
  let s = MAX_SCORE;
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
  let s = MAX_SCORE;
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
function getCloudDesc(c: number): string { if (c >= 30 && c <= 70) return 'Częściowe zachmurzenie.'; if (c >= 15 && c <= 85) return 'Umierkowane zachmurzenie.'; if (c === 0) return 'Czyste niebo.'; return 'Całkowite zachmurzenie.'; }
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
    ws += calcTempScore(at, at, null); ws += calcWindScore(aw, aw * 1.3, lt); ws += calcRainScore(ap, null); ws += calcCloudScore(w[1]?.cc ?? 50); ws += calcTimeScore(1, new Date(w[1].time).getHours()); ws = r1(ws / 5);
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

// ---------- TESTY computeTrendChange (wywołane przy starcie modułu) ----------
// Dane poprawne: 3 wartości
const _t1 = computeTrendChange([10, 12, 15]);
console.assert(_t1.change === 5 && _t1.hasData === true, 'computeTrendChange(valid) = { change: 5, hasData: true }, got: ' + JSON.stringify(_t1));

// Dane puste
const _t2 = computeTrendChange([]);
console.assert(_t2.change === 0 && _t2.hasData === false, 'computeTrendChange(empty) = { change: 0, hasData: false }, got: ' + JSON.stringify(_t2));

// Dane z NaN / Infinity
const _t3 = computeTrendChange([10, NaN, Infinity, -Infinity, 12]);
console.assert(_t3.change === 2 && _t3.hasData === true, 'computeTrendChange(naN) = { change: 2, hasData: true }, got: ' + JSON.stringify(_t3));

// Pojedyncza wartość → za mało
const _t4 = computeTrendChange([7]);
console.assert(_t4.change === 0 && _t4.hasData === false, 'computeTrendChange(single) = { change: 0, hasData: false }, got: ' + JSON.stringify(_t4));

// Wszystkie niepoprawne
const _t5 = computeTrendChange([NaN, Infinity, -Infinity]);
console.assert(_t5.change === 0 && _t5.hasData === false, 'computeTrendChange(all-invalid) = { change: 0, hasData: false }, got: ' + JSON.stringify(_t5));

// ---------------------------------------------------------------------------
// FUNKCJA filterTrendDays — filtruje dzisiejszy dzień i dni przyszłe
// Zwraca tylko pełne, zakończone dni przed bieżącym.
// ---------------------------------------------------------------------------

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

// ---------- TESTY filterTrendDays (wywoływane przy starcie modułu) ----------

function createMockDaily(dates: string[], temps: number[][]): HistoricalDaily {
  const n = dates.length;
  return {
    time: dates,
    temperatureMax: temps.map(t => t[0] ?? 25),
    temperatureMin: temps.map(t => t[1] ?? 12),
    temperatureMean: temps.map(t => t[2] ?? 18),
    precipitationSum: Array(n).fill(0),
    windSpeedMax: Array(n).fill(10),
    windDirectionDominant: Array(n).fill(180),
    pressureMean: temps.map(t => t[3] ?? 1015),
    weatherCode: Array(n).fill(2),
  };
}

const _f1 = createMockDaily(
  ['2024-08-18', '2024-08-19', '2024-08-20', '2024-08-21', '2024-08-22', new Date().toISOString().split('T')[0]],
  [[22,12,17,1010],[24,13,18,1012],[20,11,15,1008],[26,14,20,1014],[21,10,15,1006],[28,15,21,1016]]
);
const _filtered1 = filterTrendDays(_f1);
console.assert(_filtered1 !== null, 'TEST1: filterTrendDays(6dni z dziś) ≠ null');
console.assert(_filtered1!.time.length === 5, 'TEST1: 6dni → 5 (bez dziś), got: ' + _filtered1!.time.length);
console.assert(!_filtered1!.time.includes(new Date().toISOString().split('T')[0]), 'TEST1: nie zawiera dziś');
console.assert(_filtered1!.time[0] === '2024-08-18', 'TEST1: pierwszy: 2024-08-18, got: ' + _filtered1!.time[0]);

const _f2 = createMockDaily(['2024-08-21', '2024-08-22', '2024-08-23'], [[22,12,17,1010],[24,13,18,1012],[20,11,15,1008]]);
const _filtered2 = filterTrendDays(_f2);
console.assert(_filtered2 !== null, 'TEST2: filterTrendDays(3dni) ≠ null');
console.assert(_filtered2!.time.length === 3, 'TEST2: 3dni → 3 dni, got: ' + _filtered2!.time.length);
console.assert(!_filtered2!.time.includes(new Date().toISOString().split('T')[0]), 'TEST2: nie zawiera dziś');

const _f3 = createMockDaily(['2024-08-21', '2024-08-22', new Date().toISOString().split('T')[0]], [[22,12,17,1010],[24,13,18,1012],[28,15,21,1016]]);
const _filtered3 = filterTrendDays(_f3);
console.assert(_filtered3 === null, 'TEST3: 2dni+dzisiaj → null, got: ' + JSON.stringify(_filtered3));
console.assert(filterTrendDays(null) === null, 'TEST4: null → null');

// Test: poprawne obliczenie trendu z filtrowanych danych
const _f5 = createMockDaily(['2024-08-21', '2024-08-22', '2024-08-23'], [[20,10,15,1010],[23,11,17,1013],[25,12,18,1008]]);
const _filtered5 = filterTrendDays(_f5);
const _trend5 = calcTrend(_filtered5);
console.assert(_trend5.temperatureChange === 3, 'TEST5: zmiana temp = 3 (18-15), got: ' + _trend5.temperatureChange);
console.assert(_trend5.pressureChange === -2, 'TEST5: zmiana ciśn = -2 (1008-1010), got: ' + _trend5.pressureChange);
console.assert(_trend5.totalRain === 0, 'TEST5: suma opadów = 0, got: ' + _trend5.totalRain);
console.assert(_trend5.improvement === true, 'TEST5: improvement = true');

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function calcTrend(hd: HistoricalDaily | null): TrendData {
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
}export function calculateFishingScore(current: CurrentWeather, hourly: ForecastHourly, historicalDaily: HistoricalDaily | null, marineData: MarineData | null, locationType: FishingLocationType): ForecastResult {
  const now = new Date();
  const ws = calcWindScore(current.windSpeed, current.windGusts, locationType);
  const ps = calcPressureScore(current.pressure, historicalDaily);
  const rs = calcRainScore(current.precipitation, historicalDaily);
  const ts = calcTempScore(current.temperature, current.feelsLike, historicalDaily);
  const cs = calcCloudScore(current.cloudCover);
  const tis = calcTimeScore(current.isDay, now.getHours());
  const ms = locationType === "morze" && marineData?.current ? calcMarineScore(marineData.current.waveHeight, marineData.current.waveDirection, marineData.current.waterTemperature, current.windSpeed) : 0;
  let totalScore = ws * WIND_WEIGHT + ps * PRESSURE_WEIGHT + rs * RAIN_WEIGHT + ts * TEMP_WEIGHT + cs * CLOUD_WEIGHT + tis * TIME_WEIGHT + ms * MARINE_WEIGHT;
  totalScore = Math.round(totalScore);
  let verdict: FishingVerdict, verdictLabel: string, verdictIcon: string;
  if (totalScore >= 75) { verdict = "go"; verdictLabel = "Idź na ryby!"; verdictIcon = "\u{1F7E2}"; }
  else if (totalScore >= 45) { verdict = "conditional"; verdictLabel = "Warunkowo"; verdictIcon = "\u{1F7E1}"; }
  else { verdict = "skip"; verdictLabel = "Lepiej odpuść"; verdictIcon = "\u{1F534}"; }
  const components: ScoreComponent[] = [
    { name: "Wiatr", weight: WIND_WEIGHT, score: ws, maxScore: MAX_SCORE, details: ["Prędkość: " + current.windSpeed + " km/h", "Porywy: " + current.windGusts + " km/h", "Kierunek: " + getWD(current.windDirection)] },
    { name: "Ciśnienie", weight: PRESSURE_WEIGHT, score: ps, maxScore: MAX_SCORE, details: ["Ciśnienie: " + current.pressure + " hPa"] },
    { name: "Opady", weight: RAIN_WEIGHT, score: rs, maxScore: MAX_SCORE, details: ["Aktualnie: " + current.precipitation + " mm/h", "Typ: " + getWCD(current.weatherCode)] },
    { name: "Temperatura", weight: TEMP_WEIGHT, score: ts, maxScore: MAX_SCORE, details: ["Aktualna: " + current.temperature + "\u00B0C", "Odczuwalna: " + current.feelsLike + "\u00B0C"] },
    { name: "Zachmurzenie", weight: CLOUD_WEIGHT, score: cs, maxScore: MAX_SCORE, details: ["Chmury: " + current.cloudCover + "%"] },
    { name: "Pora dnia", weight: TIME_WEIGHT, score: tis, maxScore: MAX_SCORE, details: [current.isDay === 1 ? "Dzień" : "Noc"] },
  ];
  if (locationType === "morze" && marineData?.current) components.push({ name: "Dane morskie", weight: MARINE_WEIGHT, score: ms, maxScore: MAX_SCORE, details: ["Fala: " + marineData.current.waveHeight + " m", "Woda: " + marineData.current.waterTemperature + "\u00B0C"] });  const factors: WeatherFactor[] = [];
  const addF = (n: string, ic: string, v: string, imp: WeatherFactor["impact"], ds: string) => factors.push({ name: n, icon: ic, value: v, impact: imp, description: ds });
  addF("Wiatr", "\u{1F4A8}", current.windSpeed + " km/h", ws >= 70 ? "positive" : ws >= 45 ? "neutral" : "negative", getWindDesc(current.windSpeed, locationType));
  addF("Ciśnienie", "\u{1F771}", current.pressure + " hPa", ps >= 75 ? "positive" : ps >= 60 ? "neutral" : "negative", getPresDesc(current.pressure));
  addF("Opady", "\u{1F327}\uFE0F", current.precipitation > 0 ? current.precipitation + " mm/h" : "Brak opadów", rs >= 75 ? "positive" : rs >= 55 ? "neutral" : "negative", getRainDesc(current.precipitation));
  addF("Temperatura", "\u{1F771}", current.temperature + "\u00B0C (odczuwalna: " + current.feelsLike + "\u00B0C)", ts >= 75 ? "positive" : ts >= 60 ? "neutral" : "negative", getTempDesc(current.temperature));
  addF("Zachmurzenie", "\u2601", current.cloudCover + "%", cs >= 75 ? "positive" : cs >= 60 ? "neutral" : "negative", getCloudDesc(current.cloudCover));
  addF("Pora dnia", current.isDay === 1 ? "\u2600" : "\u{1F319}", now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }), tis >= 80 ? "positive" : "neutral", tis >= 80 ? "Przygoty aktywności ryb." : "Nieidealna pora.");
  if (locationType === "morze" && marineData?.current) {
    const msc = calcMarineScore(marineData.current.waveHeight, marineData.current.waveDirection, marineData.current.waterTemperature, current.windSpeed);
    addF("Fale (morze)", "\u{1F30A}", marineData.current.waveHeight + " m", msc >= 70 ? "positive" : msc >= 45 ? "neutral" : "negative", getWaveDesc(marineData.current.waveHeight));
    addF("Temperatura morza", "\u{1F30A}", marineData.current.waterTemperature + "\u00B0C", "neutral", "Woda: " + marineData.current.waterTemperature + "\u00B0C");
  }
  const keyFactors = factors.filter(f => f.impact !== "neutral").sort((a, b) => ({ positive: 1, negative: -1, neutral: 0 }[b.impact] - { positive: 1, negative: -1, neutral: 0 }[a.impact])).slice(0, 4).map(f => f.icon + " " + f.name + ": " + f.description);
  const bestWindows = findBestWindows(hourly, current.time, marineData, locationType);
  const trend = calcTrend(historicalDaily);
  const calculationNotes: string[] = [];
  if (totalScore >= 75) calculationNotes.push("\u{1F7E2} Warunki bardzo sprzyjające!");
  else if (totalScore >= 45) calculationNotes.push("\u{1F7E1} Warunki umiarkowane.");
  else calculationNotes.push("\u{1F534} Warunki niezbyt sprzyjające.");
  if (locationType === "morze" && marineData?.current && marineData.current.waveHeight > WAVE_THRESHOLDS.l) calculationNotes.push("\u26A0\uFE0F Fale powyżej 2m!");
  if (locationType === "morze" && !marineData?.current) calculationNotes.push("\u26A0\uFE0F Brak danych morskich — wynik uwzględnia to ostrożnościowo.");
  if (current.windGusts > current.windSpeed * 2) calculationNotes.push("\u{1F4A8} Zmienny wiatr z podmuchami.");
  if (current.pressure < 990) calculationNotes.push("\u{1F327}\uFE0F Niskie ciśnienie.");
  return { score: totalScore, verdict, verdictLabel, verdictIcon, components, factors, bestWindows, trend, keyFactors, calculationNotes };
}
