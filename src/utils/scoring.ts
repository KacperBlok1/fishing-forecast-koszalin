import type {
  DayPhase,
  FactorImpact,
  FishingLocationType,
  FishingScore,
  HourPoint,
  MoonInfo,
  RatingLabel,
  ScoreFactor,
  SpeciesAdjustment,
  SpeciesId,
} from '../types';
import { getSpecies } from '../data/species';
import type { SpeciesProfile } from '../data/species';
import { windDirectionName, weatherCodeDescription } from './formatting';

// ============================================================
// Stałe algorytmu — jawne, żeby dało się je opisać w zakładce "Dlaczego?"
// ============================================================

/** Wagi czynników bazowych. Sumują się do 100. */
export const WEIGHTS = {
  wind: 18,
  pressure: 18,
  temperature: 16,
  light: 16,
  precipitation: 12,
  cloud: 10,
  moon: 6,
  stability: 4,
} as const;

/** Waga komponentu morskiego — doliczana tylko dla łowisk typu "morze" z danymi Marine API. */
export const MARINE_WEIGHT = 15;

/** Maksymalna korekta gatunkowa (w punktach, w obie strony). */
export const SPECIES_DELTA_LIMIT = 12;

/** Progi etykiet 0-100. */
export const RATING_THRESHOLDS = {
  srednio: 35,
  dobrze: 55,
  bardzoDobrze: 75,
} as const;

/** Minimalny wynik godzinowy, żeby godzina weszła do "okna połowowego". */
export const WINDOW_MIN_SCORE = 55;

/** Progi wiatru (km/h) zależne od akwenu. */
export const WIND_THRESHOLDS: Record<
  FishingLocationType,
  { calm: number; optimalFrom: number; optimalTo: number; strong: number; severe: number }
> = {
  jezioro: { calm: 3, optimalFrom: 6, optimalTo: 14, strong: 30, severe: 50 },
  rzeka: { calm: 3, optimalFrom: 6, optimalTo: 18, strong: 35, severe: 55 },
  morze: { calm: 4, optimalFrom: 8, optimalTo: 20, strong: 40, severe: 60 },
};

/** Progi wysokości fali (m) dla trybu morskiego. */
export const WAVE_THRESHOLDS = { calm: 0.3, low: 0.6, moderate: 1.0, high: 1.5, severe: 2.5 } as const;

// ============================================================
// Pomocnicze
// ============================================================

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Etykieta słowna dla wyniku 0-100. */
export function ratingLabel(score: number): RatingLabel {
  if (score >= RATING_THRESHOLDS.bardzoDobrze) return 'bardzo dobrze';
  if (score >= RATING_THRESHOLDS.dobrze) return 'dobrze';
  if (score >= RATING_THRESHOLDS.srednio) return 'średnio';
  return 'słabo';
}

function impactFor(score: number): FactorImpact {
  if (score >= 70) return 'positive';
  if (score >= 50) return 'neutral';
  return 'negative';
}

// ============================================================
// Oceny cząstkowe (każda zwraca 0-100)
// ============================================================

/**
 * Wiatr. Zupełny bezruch jest gorszy od lekkiej fali (mniejsze natlenienie,
 * ryba ostrożniejsza), bardzo silny wiatr obniża wynik i utrudnia łowienie.
 * Dodatkowo karzemy porywistość (stosunek porywów do średniej prędkości).
 */
export function scoreWind(speed: number, gusts: number, type: FishingLocationType): number {
  const t = WIND_THRESHOLDS[type];
  const w = Math.max(0, speed);
  let score: number;

  if (w <= t.calm) {
    score = 46;
  } else if (w < t.optimalFrom) {
    score = lerp(55, 92, (w - t.calm) / (t.optimalFrom - t.calm));
  } else if (w <= t.optimalTo) {
    score = 92;
  } else if (w <= t.strong) {
    score = lerp(88, 26, (w - t.optimalTo) / (t.strong - t.optimalTo));
  } else if (w <= t.severe) {
    score = lerp(24, 4, (w - t.strong) / (t.severe - t.strong));
  } else {
    score = 2;
  }

  if (isNum(gusts) && w > 1) {
    const ratio = gusts / w;
    if (ratio > 2.2) score -= 12;
    else if (ratio > 1.7) score -= 6;
  }

  return round1(clamp(score, 0, 100));
}

/**
 * Ciśnienie: 60 % oceny to sam poziom, 40 % to zmiana z ostatnich 24 h.
 * Łagodny spadek ciśnienia (nadchodzący front) bywa korzystny, gwałtowna
 * zmiana w dowolną stronę zwykle wyłącza żerowanie.
 */
export function scorePressure(pressure: number, change24h: number | null): number {
  let level: number;
  if (pressure >= 1008 && pressure <= 1024) level = 90;
  else if (pressure >= 1000 && pressure <= 1030) level = 68;
  else if (pressure >= 990 && pressure <= 1036) level = 44;
  else level = 20;

  if (change24h === null || !isNum(change24h)) {
    return round1(clamp(level, 0, 100));
  }

  const d = change24h;
  let change: number;
  if (Math.abs(d) <= 1) change = 92;
  else if (d < 0 && d >= -4) change = 82;
  else if (d > 0 && d <= 4) change = 70;
  else if (Math.abs(d) <= 8) change = 40;
  else change = 12;

  return round1(clamp(level * 0.6 + change * 0.4, 0, 100));
}

/**
 * Opady. Delikatna mżawka bywa lepsza od zupełnie suchej pogody,
 * ulewa i burza wynik mocno obniżają.
 */
export function scorePrecipitation(precipitation: number, weatherCode: number): number {
  const p = Math.max(0, precipitation);
  let score: number;
  if (p === 0) score = 80;
  else if (p <= 0.3) score = 88;
  else if (p <= 1) score = 70;
  else if (p <= 3) score = 46;
  else if (p <= 6) score = 22;
  else score = 6;

  // Kody 95-99 to burze — niezależnie od sumy opadów jest to warunek odradzający wyjście.
  if (weatherCode >= 95) score = Math.min(score, 12);

  return round1(clamp(score, 0, 100));
}

/**
 * Temperatura: 60 % to sam poziom, 40 % to zmiana względem średniej
 * z trzech poprzednich dni. Stabilna temperatura jest lepsza niż skok.
 */
export function scoreTemperature(temperature: number, changeVs3Days: number | null): number {
  let level: number;
  if (temperature >= 12 && temperature <= 22) level = 92;
  else if (temperature >= 8 && temperature <= 26) level = 74;
  else if (temperature >= 3 && temperature <= 30) level = 52;
  else if (temperature >= -2 && temperature <= 34) level = 26;
  else level = 8;

  if (changeVs3Days === null || !isNum(changeVs3Days)) {
    return round1(clamp(level, 0, 100));
  }

  const d = changeVs3Days;
  let change: number;
  if (Math.abs(d) <= 1.5) change = 90;
  else if (d > 1.5 && d <= 4) change = 76;
  else if (d < -1.5 && d >= -4) change = 58;
  else if (Math.abs(d) <= 8) change = 36;
  else change = 12;

  return round1(clamp(level * 0.6 + change * 0.4, 0, 100));
}

/** Zachmurzenie: rozproszone światło sprzyja drapieżnikom, pełne słońce i całkowity zwał mniej. */
export function scoreCloud(cloudCover: number): number {
  const c = clamp(cloudCover, 0, 100);
  if (c >= 30 && c <= 75) return 90;
  if (c >= 15 && c < 30) return 70;
  if (c > 75 && c <= 90) return 66;
  if (c < 15) return 38;
  return 46;
}

/** Pora dnia względem wschodu i zachodu słońca. */
export function dayPhase(minutes: number, sunriseMinutes: number, sunsetMinutes: number): DayPhase {
  const toSunrise = minutes - sunriseMinutes;
  const toSunset = minutes - sunsetMinutes;
  if (Math.abs(toSunrise) <= 60) return 'świt';
  if (Math.abs(toSunset) <= 60) return 'zmierzch';
  if (minutes < sunriseMinutes - 60 || minutes > sunsetMinutes + 60) return 'noc';
  if (toSunrise > 60 && toSunrise <= 240) return 'poranek';
  if (toSunset < -60 && toSunset >= -240) return 'popołudnie';
  return 'dzień';
}

/** Ocena pory dnia. Świt i zmierzch to klasyczne szczyty aktywności ryb. */
export function scoreLight(minutes: number, sunriseMinutes: number, sunsetMinutes: number): number {
  switch (dayPhase(minutes, sunriseMinutes, sunsetMinutes)) {
    case 'świt':
    case 'zmierzch':
      return 95;
    case 'poranek':
    case 'popołudnie':
      return 66;
    case 'dzień':
      return 40;
    case 'noc':
    default:
      return 24;
  }
}

/**
 * Księżyc. Przyjmujemy prosty model: nów i pełnia to okresy wzmożonej
 * aktywności, kwadry są neutralne. Waga tego czynnika jest celowo mała (6/100).
 */
export function scoreMoon(illumination: number): number {
  const i = clamp(illumination, 0, 1);
  if (i <= 0.08 || i >= 0.92) return 88;
  if (i <= 0.2 || i >= 0.8) return 72;
  if (i >= 0.4 && i <= 0.6) return 38;
  return 55;
}

/**
 * Stabilność pogody liczona z rozrzutu ciśnienia i wiatru w oknie ±12 h.
 * Ryby źle znoszą gwałtowne zmiany — nawet dobre wartości chwilowe
 * przy rozchwianej pogodzie są mniej warte.
 */
export function scoreStability(pressureRange: number, windRange: number): number {
  if (pressureRange <= 3 && windRange <= 12) return 92;
  if (pressureRange <= 6 && windRange <= 20) return 68;
  if (pressureRange <= 10 && windRange <= 30) return 40;
  return 14;
}

/** Ocena warunków morskich na podstawie wysokości fali. */
export function scoreWave(waveHeight: number): number {
  const h = Math.max(0, waveHeight);
  if (h <= WAVE_THRESHOLDS.calm) return 92;
  if (h <= WAVE_THRESHOLDS.low) return 80;
  if (h <= WAVE_THRESHOLDS.moderate) return 58;
  if (h <= WAVE_THRESHOLDS.high) return 34;
  if (h <= WAVE_THRESHOLDS.severe) return 14;
  return 3;
}

/** Etykieta bezpieczeństwa dla trybu morskiego. */
export function waveSafety(
  waveHeight: number | null
): { level: 'bezpiecznie' | 'ostrożnie' | 'trudne warunki' | 'niebezpiecznie' | 'brak danych'; note: string } {
  if (waveHeight === null || !isNum(waveHeight)) {
    return {
      level: 'brak danych',
      note: 'Marine API nie zwróciło wysokości fali dla tego punktu. Oceń warunki na miejscu.',
    };
  }
  if (waveHeight <= 0.5) {
    return { level: 'bezpiecznie', note: 'Spokojna woda. Standardowa ostrożność na brzegu i pomoście.' };
  }
  if (waveHeight <= 1.0) {
    return { level: 'ostrożnie', note: 'Wyraźna fala. Uważaj na śliskie ostrogi i falochrony.' };
  }
  if (waveHeight <= 2.0) {
    return {
      level: 'trudne warunki',
      note: 'Wysoka fala — wyjście małą łodzią i łowienie z falochronu są ryzykowne.',
    };
  }
  return {
    level: 'niebezpiecznie',
    note: 'Sztormowa fala. Nie wchodź na falochrony ani ostrogi, nie wypływaj.',
  };
}

// ============================================================
// Korekta gatunkowa
// ============================================================

export interface SpeciesContext {
  locationType: FishingLocationType;
  temperature: number;
  phase: DayPhase;
  cloudCover: number;
  windSpeed: number;
  pressureChange24h: number | null;
}

/**
 * Korekta gatunkowa — zestaw jawnych, deterministycznych reguł.
 * Każda reguła dokłada albo odejmuje punkty i zostawia po sobie zdanie
 * wyjaśnienia. Suma jest przycinana do ±SPECIES_DELTA_LIMIT.
 */
export function speciesAdjustment(species: SpeciesProfile, ctx: SpeciesContext): SpeciesAdjustment {
  const reasons: string[] = [];
  let delta = 0;

  // 1. Akwen
  if (!species.habitats.includes(ctx.locationType)) {
    delta -= 12;
    reasons.push(`${species.name} nie jest typowym gatunkiem dla akwenu „${ctx.locationType}” (-12).`);
  }

  // 2. Temperatura
  const [tMin, tMax] = species.temperatureRange;
  if (ctx.temperature >= tMin && ctx.temperature <= tMax) {
    delta += 4;
    reasons.push(`Temperatura ${Math.round(ctx.temperature)} °C mieści się w zakresie ${tMin}–${tMax} °C (+4).`);
  } else if (ctx.temperature >= tMin - 4 && ctx.temperature <= tMax + 4) {
    reasons.push(`Temperatura ${Math.round(ctx.temperature)} °C jest tuż obok zakresu ${tMin}–${tMax} °C (0).`);
  } else {
    delta -= 8;
    reasons.push(`Temperatura ${Math.round(ctx.temperature)} °C jest poza zakresem ${tMin}–${tMax} °C (-8).`);
  }

  // 3. Światło / pora dnia
  const twilight = ctx.phase === 'świt' || ctx.phase === 'zmierzch';
  const night = ctx.phase === 'noc';
  const bright = ctx.phase === 'dzień';
  if (species.light === 'przyćmione') {
    if (twilight) { delta += 6; reasons.push('Szczyt aktywności o świcie i zmierzchu (+6).'); }
    else if (bright && ctx.cloudCover < 30) { delta -= 5; reasons.push('Ostre światło w środku dnia gatunkowi nie służy (-5).'); }
    else if (night) { delta += 2; reasons.push('Noc bywa produktywna (+2).'); }
  } else if (species.light === 'jasne') {
    if (bright) { delta += 4; reasons.push('Poluje wzrokiem — pełne światło dnia pomaga (+4).'); }
    else if (twilight) { delta += 2; reasons.push('Świt i zmierzch nadal dobre (+2).'); }
    else if (night) { delta -= 6; reasons.push('Po zmroku praktycznie nie żeruje (-6).'); }
  } else if (species.light === 'nocne') {
    if (night) { delta += 6; reasons.push('Gatunek nocny — ciemność działa na jego korzyść (+6).'); }
    else if (twilight) { delta += 4; reasons.push('Świt i zmierzch to klasyczne okno (+4).'); }
    else if (bright) { delta -= 5; reasons.push('W pełnym słońcu schodzi głębiej i przestaje żerować (-5).'); }
  }

  // 4. Wiatr i falowanie
  const windThresholds = WIND_THRESHOLDS[ctx.locationType];
  if (species.wind === 'lubi') {
    if (ctx.windSpeed >= windThresholds.optimalFrom && ctx.windSpeed <= windThresholds.optimalTo) {
      delta += 3;
      reasons.push('Robocza fala przy brzegu sprzyja temu gatunkowi (+3).');
    } else if (ctx.windSpeed <= windThresholds.calm) {
      delta -= 3;
      reasons.push('Całkowita cisza — woda zbyt przejrzysta, ryba ostrożna (-3).');
    }
  } else if (species.wind === 'nie lubi') {
    if (ctx.windSpeed > windThresholds.strong) {
      delta -= 5;
      reasons.push('Silny wiatr utrudnia prezentację przynęty temu gatunkowi (-5).');
    } else if (ctx.windSpeed <= windThresholds.calm) {
      delta += 3;
      reasons.push('Spokojna woda to dobre warunki dla tego gatunku (+3).');
    }
  }

  // 5. Wrażliwość na ciśnienie
  if (species.pressureSensitive && ctx.pressureChange24h !== null && Math.abs(ctx.pressureChange24h) > 5) {
    delta -= 5;
    reasons.push(`Skok ciśnienia o ${round1(ctx.pressureChange24h)} hPa/24 h mocno wyłącza brania (-5).`);
  }

  // 6. Zachmurzenie
  if (species.likesClouds && ctx.cloudCover >= 40 && ctx.cloudCover <= 90) {
    delta += 2;
    reasons.push('Zachmurzenie rozprasza światło i wydłuża żerowanie (+2).');
  }

  const clamped = clamp(delta, -SPECIES_DELTA_LIMIT, SPECIES_DELTA_LIMIT);
  if (clamped !== delta) {
    reasons.push(`Suma korekt przycięta do ±${SPECIES_DELTA_LIMIT} pkt.`);
  }
  return { delta: Math.round(clamped), reasons };
}

// ============================================================
// Wynik dla jednej godziny
// ============================================================

export interface ScoreContext {
  hour: HourPoint;
  locationType: FishingLocationType;
  sunriseMinutes: number;
  sunsetMinutes: number;
  moon: MoonInfo;
  /** Zmiana ciśnienia względem tej samej godziny 24 h wcześniej. */
  pressureChange24h: number | null;
  /** Zmiana temperatury względem średniej z 3 poprzednich dni. */
  temperatureChange: number | null;
  /** Rozrzut ciśnienia i wiatru w oknie ±12 h. */
  pressureRange: number | null;
  windRange: number | null;
  /** Wysokość fali (m) — tylko tryb morski, null gdy brak danych. */
  waveHeight: number | null;
}

/** Pełna ocena warunków dla jednej godziny, z rozbiciem na czynniki. */
export function computeScore(ctx: ScoreContext, speciesId: SpeciesId): FishingScore {
  const { hour, locationType } = ctx;
  const species = getSpecies(speciesId);
  const minutes = (() => {
    const timePart = hour.time.includes('T') ? hour.time.split('T')[1] : '00:00';
    return Number.parseInt(timePart.slice(0, 2), 10) * 60 + Number.parseInt(timePart.slice(3, 5), 10);
  })();

  const phase = dayPhase(minutes, ctx.sunriseMinutes, ctx.sunsetMinutes);

  const windScore = scoreWind(hour.windSpeed, hour.windGusts, locationType);
  const pressureScore = scorePressure(hour.pressure, ctx.pressureChange24h);
  const temperatureScore = scoreTemperature(hour.temperature, ctx.temperatureChange);
  const lightScore = scoreLight(minutes, ctx.sunriseMinutes, ctx.sunsetMinutes);
  const precipitationScore = scorePrecipitation(hour.precipitation, hour.weatherCode);
  const cloudScore = scoreCloud(hour.cloudCover);
  const moonScore = scoreMoon(ctx.moon.illumination);
  const stabilityScore =
    ctx.pressureRange !== null && ctx.windRange !== null
      ? scoreStability(ctx.pressureRange, ctx.windRange)
      : 55;

  const factors: ScoreFactor[] = [
    {
      key: 'wind',
      label: 'Wiatr',
      weight: WEIGHTS.wind,
      score: windScore,
      value: `${Math.round(hour.windSpeed)} km/h ${windDirectionName(hour.windDirection)} (porywy ${Math.round(hour.windGusts)})`,
      impact: impactFor(windScore),
      description: describeWind(hour.windSpeed, hour.windGusts, locationType),
    },
    {
      key: 'pressure',
      label: 'Ciśnienie',
      weight: WEIGHTS.pressure,
      score: pressureScore,
      value:
        ctx.pressureChange24h === null
          ? `${Math.round(hour.pressure)} hPa`
          : `${Math.round(hour.pressure)} hPa (${ctx.pressureChange24h > 0 ? '+' : ''}${round1(ctx.pressureChange24h)} / 24 h)`,
      impact: impactFor(pressureScore),
      description: describePressure(hour.pressure, ctx.pressureChange24h),
    },
    {
      key: 'temperature',
      label: 'Temperatura',
      weight: WEIGHTS.temperature,
      score: temperatureScore,
      value:
        ctx.temperatureChange === null
          ? `${Math.round(hour.temperature)} °C`
          : `${Math.round(hour.temperature)} °C (${ctx.temperatureChange > 0 ? '+' : ''}${round1(ctx.temperatureChange)} vs 3 dni)`,
      impact: impactFor(temperatureScore),
      description: describeTemperature(hour.temperature, ctx.temperatureChange),
    },
    {
      key: 'light',
      label: 'Pora dnia',
      weight: WEIGHTS.light,
      score: lightScore,
      value: phase,
      impact: impactFor(lightScore),
      description: describePhase(phase),
    },
    {
      key: 'precipitation',
      label: 'Opady',
      weight: WEIGHTS.precipitation,
      score: precipitationScore,
      value:
        hour.precipitation > 0
          ? `${round1(hour.precipitation)} mm/h — ${weatherCodeDescription(hour.weatherCode)}`
          : weatherCodeDescription(hour.weatherCode),
      impact: impactFor(precipitationScore),
      description: describePrecipitation(hour.precipitation, hour.weatherCode),
    },
    {
      key: 'cloud',
      label: 'Zachmurzenie',
      weight: WEIGHTS.cloud,
      score: cloudScore,
      value: `${Math.round(hour.cloudCover)} %`,
      impact: impactFor(cloudScore),
      description: describeCloud(hour.cloudCover),
    },
    {
      key: 'moon',
      label: 'Faza księżyca',
      weight: WEIGHTS.moon,
      score: moonScore,
      value: `${ctx.moon.icon} ${ctx.moon.phase} (${Math.round(ctx.moon.illumination * 100)} %)`,
      impact: impactFor(moonScore),
      description: describeMoon(ctx.moon),
    },
    {
      key: 'stability',
      label: 'Stabilność pogody',
      weight: WEIGHTS.stability,
      score: stabilityScore,
      value: stabilityScore >= 72 ? 'stabilnie' : stabilityScore >= 52 ? 'umiarkowanie' : 'rozchwiana',
      impact: impactFor(stabilityScore),
      description: describeStability(stabilityScore, ctx.pressureRange, ctx.windRange),
    },
  ];

  const warnings: string[] = [];
  let marineIncluded = false;

  if (locationType === 'morze') {
    if (ctx.waveHeight !== null && isNum(ctx.waveHeight)) {
      const waveScore = scoreWave(ctx.waveHeight);
      const safety = waveSafety(ctx.waveHeight);
      factors.push({
        key: 'wave',
        label: 'Fala',
        weight: MARINE_WEIGHT,
        score: waveScore,
        value: `${round1(ctx.waveHeight)} m — ${safety.level}`,
        impact: impactFor(waveScore),
        description: safety.note,
      });
      marineIncluded = true;
      if (ctx.waveHeight > WAVE_THRESHOLDS.high) {
        warnings.push(`Fala ${round1(ctx.waveHeight)} m — ${safety.note}`);
      }
    } else {
      warnings.push(
        'Marine API nie zwróciło danych o fali dla tej lokalizacji. Wynik liczony jest wyłącznie z pogody — nie zastępuje oceny bezpieczeństwa nad wodą.'
      );
    }
  }

  const weightSum = factors.reduce((sum, f) => sum + f.weight, 0);
  const weighted = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const baseScore = Math.round(clamp(weighted / weightSum, 0, 100));

  const adjustment = speciesAdjustment(species, {
    locationType,
    temperature: hour.temperature,
    phase,
    cloudCover: hour.cloudCover,
    windSpeed: hour.windSpeed,
    pressureChange24h: ctx.pressureChange24h,
  });

  const score = Math.round(clamp(baseScore + adjustment.delta, 0, 100));

  if (hour.weatherCode >= 95) {
    warnings.push('Prognozowana burza — nie łów z odsłoniętego brzegu ani z łodzi.');
  }
  if (hour.windGusts >= 60) {
    warnings.push(`Porywy do ${Math.round(hour.windGusts)} km/h — uważaj na drzewa i wysoką falę.`);
  }

  return {
    score,
    label: ratingLabel(score),
    baseScore,
    speciesId,
    speciesDelta: adjustment.delta,
    speciesReasons: adjustment.reasons,
    factors,
    warnings,
    marineIncluded,
    phase,
    moon: ctx.moon,
  };
}

// ============================================================
// Opisy słowne
// ============================================================

function describeWind(speed: number, gusts: number, type: FishingLocationType): string {
  const t = WIND_THRESHOLDS[type];
  const gusty = speed > 1 && gusts / speed > 1.7 ? ' Wiatr jest porywisty.' : '';
  if (speed <= t.calm) return 'Niemal bezwietrznie — woda przejrzysta, ryby bardziej ostrożne.' + gusty;
  if (speed <= t.optimalTo) return 'Lekki, roboczy wiatr — dotlenia wodę i maskuje żyłkę.' + gusty;
  if (speed <= t.strong) return 'Umiarkowany do silnego wiatr — łowienie możliwe, ale wymaga osłoniętego brzegu.' + gusty;
  if (speed <= t.severe) return 'Silny wiatr — trudna prezentacja przynęty i niewygodne warunki.' + gusty;
  return 'Wichura — wyjście nad wodę jest niebezpieczne.' + gusty;
}

function describePressure(pressure: number, change: number | null): string {
  const level =
    pressure >= 1008 && pressure <= 1024
      ? 'Ciśnienie w komfortowym zakresie.'
      : pressure > 1024
        ? 'Wysokie ciśnienie — ryby często stoją głębiej.'
        : 'Niskie ciśnienie.';
  if (change === null) return level;
  if (Math.abs(change) <= 1) return `${level} Utrzymuje się stabilnie od doby.`;
  if (change < 0 && change >= -4) return `${level} Powoli spada — często zwiastuje dobre żerowanie przed frontem.`;
  if (change > 0 && change <= 4) return `${level} Powoli rośnie — pogoda się układa.`;
  return `${level} Zmiana o ${round1(change)} hPa na dobę to gwałtowny skok, który zwykle wyłącza brania.`;
}

function describeTemperature(temperature: number, change: number | null): string {
  const level =
    temperature >= 12 && temperature <= 22
      ? 'Temperatura w optymalnym przedziale.'
      : temperature < 3
        ? 'Zimno — metabolizm ryb mocno spowolniony.'
        : temperature > 28
          ? 'Upał — ryby schodzą w chłodniejsze warstwy.'
          : 'Temperatura umiarkowana.';
  if (change === null) return level;
  if (Math.abs(change) <= 1.5) return `${level} Bez zmian względem ostatnich trzech dni.`;
  if (change > 0) return `${level} Cieplej o ${round1(change)} °C niż średnio przez ostatnie trzy dni.`;
  return `${level} Chłodniej o ${round1(Math.abs(change))} °C niż średnio przez ostatnie trzy dni.`;
}

function describePrecipitation(precipitation: number, weatherCode: number): string {
  if (weatherCode >= 95) return 'Burza — warunek odradzający wyjście niezależnie od reszty prognozy.';
  if (precipitation === 0) return 'Bez opadów.';
  if (precipitation <= 0.3) return 'Mżawka — delikatny deszcz często poprawia żerowanie.';
  if (precipitation <= 1) return 'Słaby deszcz, do przeżycia pod parasolem.';
  if (precipitation <= 3) return 'Wyraźny deszcz — woda się mąci, komfort łowienia spada.';
  if (precipitation <= 6) return 'Silny deszcz — gwałtowny przybór i mętna woda.';
  return 'Ulewa — łowienie praktycznie wykluczone.';
}

function describeCloud(cloudCover: number): string {
  if (cloudCover < 15) return 'Czyste niebo — ostre światło, ryby ostrożniejsze na płyciznach.';
  if (cloudCover <= 75) return 'Rozproszone światło — najlepszy wariant dla większości gatunków.';
  if (cloudCover <= 90) return 'Duże zachmurzenie — światło miękkie, dzień wydłużony dla drapieżników.';
  return 'Całkowity zwał chmur.';
}

function describePhase(phase: DayPhase): string {
  switch (phase) {
    case 'świt':
      return 'Świt — klasyczne okno żerowania.';
    case 'zmierzch':
      return 'Zmierzch — drugie okno żerowania w ciągu doby.';
    case 'poranek':
      return 'Poranek — aktywność wciąż podwyższona.';
    case 'popołudnie':
      return 'Późne popołudnie — aktywność zaczyna rosnąć.';
    case 'dzień':
      return 'Środek dnia — zwykle najsłabsza pora.';
    case 'noc':
    default:
      return 'Noc — dobra dla gatunków nocnych, słaba dla wzrokowców.';
  }
}

function describeMoon(moon: MoonInfo): string {
  if (moon.illumination <= 0.08) return 'Nów — ciemne noce, częściej notowana wzmożona aktywność.';
  if (moon.illumination >= 0.92) return 'Pełnia — jasne noce i silniejsze pływy, ryby żerują też po zmroku.';
  if (moon.illumination >= 0.4 && moon.illumination <= 0.6) return 'Kwadra — wpływ księżyca neutralny.';
  return 'Faza pośrednia — wpływ księżyca umiarkowany.';
}

function describeStability(score: number, pressureRange: number | null, windRange: number | null): string {
  if (pressureRange === null || windRange === null) return 'Brak pełnych danych do oceny stabilności — przyjęto wartość neutralną.';
  const detail = `Ciśnienie waha się o ${round1(pressureRange)} hPa, wiatr o ${Math.round(windRange)} km/h w oknie ±12 h.`;
  if (score >= 72) return `Pogoda stabilna. ${detail}`;
  if (score >= 52) return `Pogoda umiarkowanie zmienna. ${detail}`;
  return `Pogoda rozchwiana — to najczęstszy powód słabych brań. ${detail}`;
}
