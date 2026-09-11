// ============================================================
// Typy domenowe aplikacji "Czy warto iść na ryby?" (v2)
// ============================================================

/** Typ akwenu. Decyduje o progach wiatru i o tym, czy używamy Marine API. */
export type FishingLocationType = 'jezioro' | 'rzeka' | 'morze';

/** Identyfikatory obsługiwanych gatunków (bez polskich znaków — używane jako klucze). */
export type SpeciesId =
  | 'szczupak'
  | 'okon'
  | 'sandacz'
  | 'karp'
  | 'leszcz'
  | 'pstrag'
  | 'dorsz';

/** Czterostopniowa etykieta oceny. */
export type RatingLabel = 'słabo' | 'średnio' | 'dobrze' | 'bardzo dobrze';

/** Pora dnia wyznaczana względem wschodu i zachodu słońca. */
export type DayPhase = 'noc' | 'świt' | 'poranek' | 'dzień' | 'popołudnie' | 'zmierzch';

// ------------------------------------------------------------
// Łowiska
// ------------------------------------------------------------

/**
 * Łowisko zapisane na koncie użytkownika. Rekord przychodzi z serwera —
 * dzięki temu miejsce dodane na telefonie jest od razu dostępne na komputerze.
 */
export interface Spot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: FishingLocationType;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

// ------------------------------------------------------------
// Dane pogodowe (znormalizowane z Open-Meteo)
// ------------------------------------------------------------

export interface HourPoint {
  /** ISO lokalny czas łowiska, np. "2026-09-11T14:00". */
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  precipitationProbability: number | null;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  weatherCode: number;
  isDay: number;
}

export interface DayPoint {
  /** Data w formacie YYYY-MM-DD. */
  date: string;
  sunrise: string;
  sunset: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  windSpeedMax: number;
  windGustsMax: number;
  weatherCode: number;
}

export interface MarineSeries {
  time: string[];
  waveHeight: (number | null)[];
  waveDirection: (number | null)[];
  wavePeriod: (number | null)[];
  seaSurfaceTemperature: (number | null)[];
}

export interface WeatherBundle {
  /** Kiedy serwer pobrał te dane z Open-Meteo (ms) — do pokazania wieku danych. */
  fetchedAt: number;
  /** true = Open-Meteo nie odpowiedziało i serwer oddał ostatnią poprawną odpowiedź. */
  stale: boolean;
  timezone: string;
  /** Bieżące warunki z bloku `current` Open-Meteo. */
  current: HourPoint;
  /** Godziny: 3 dni wstecz + 7 dni do przodu. */
  hours: HourPoint[];
  /** Dni: 3 wstecz + 7 do przodu. */
  days: DayPoint[];
  /** Dane morskie — tylko dla typu "morze" i tylko gdy API je zwróciło. */
  marine: MarineSeries | null;
  /** Czy w ogóle próbowaliśmy pobrać dane morskie. */
  marineRequested: boolean;
  /** Komunikat wyjaśniający brak danych morskich (jeśli dotyczy). */
  marineError: string | null;
}

// ------------------------------------------------------------
// Księżyc
// ------------------------------------------------------------

export interface MoonInfo {
  /** Wiek księżyca w dobach (0 = nów). */
  age: number;
  /** Oświetlenie tarczy 0..1. */
  illumination: number;
  /** Nazwa fazy po polsku. */
  phase: string;
  /** Emoji fazy. */
  icon: string;
}

// ------------------------------------------------------------
// Wynik punktacji
// ------------------------------------------------------------

export type FactorImpact = 'positive' | 'neutral' | 'negative';

export interface ScoreFactor {
  key: string;
  label: string;
  /** Waga w punktach (sumują się do 100 dla użytych czynników). */
  weight: number;
  /** Ocena cząstkowa 0-100. */
  score: number;
  /** Wartość do pokazania użytkownikowi, np. "12 km/h, płn.-zach.". */
  value: string;
  impact: FactorImpact;
  /** Jednozdaniowe wyjaśnienie. */
  description: string;
}

export interface SpeciesAdjustment {
  delta: number;
  reasons: string[];
}

export interface FishingScore {
  /** Wynik końcowy 0-100 (po korekcie gatunkowej). */
  score: number;
  label: RatingLabel;
  /** Wynik bazowy, przed korektą gatunkową. */
  baseScore: number;
  speciesId: SpeciesId;
  speciesDelta: number;
  speciesReasons: string[];
  factors: ScoreFactor[];
  /** Ostrzeżenia i informacje o brakach danych. */
  warnings: string[];
  /** Czy w wyniku uwzględniono komponent morski. */
  marineIncluded: boolean;
  phase: DayPhase;
  moon: MoonInfo;
}

export interface HourScore {
  time: string;
  score: number;
  label: RatingLabel;
}

export interface FishingWindow {
  start: string;
  /** Koniec okna (wyłącznie) — godzina następująca po ostatniej godzinie okna. */
  end: string;
  score: number;
  label: RatingLabel;
  averageTemperature: number;
  averageWind: number;
  maxPrecipitation: number;
  weatherCode: number;
}

export interface DayOutlook {
  date: string;
  sunrise: string;
  sunset: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  windSpeedMax: number;
  weatherCode: number;
  moon: MoonInfo;
  /**
   * Ocena dnia: 65 % najlepszego okna + 35 % średniej z godzin dziennych.
   * Sam najlepszy wynik godzinowy byłby mylący — niemal każdy dzień ma jedną
   * dobrą godzinę o świcie, więc wszystkie dni wyglądałyby tak samo.
   */
  score: number;
  label: RatingLabel;
  /** Wynik najlepszego okna połowowego tego dnia. */
  bestWindowScore: number;
  /** Średnia z godzin dziennych (świt–zmierzch). */
  averageScore: number;
  windows: FishingWindow[];
}

export interface TrendSummary {
  /** Zmiana średniej temperatury: dziś vs średnia z 3 poprzednich dni. */
  temperatureChange: number;
  /** Zmiana ciśnienia w ciągu ostatnich 24 h. */
  pressureChange24h: number;
  /** Suma opadów z 3 poprzednich dni. */
  rainLast3Days: number;
  /** Czy pogoda jest stabilna. */
  stable: boolean;
  stabilityScore: number;
  hasData: boolean;
}

export interface MarineSnapshot {
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  waterTemperature: number | null;
  safetyLevel: 'bezpiecznie' | 'ostrożnie' | 'trudne warunki' | 'niebezpiecznie' | 'brak danych';
  safetyNote: string;
}

/** Komplet wyników dla wybranego łowiska i gatunku. */
export interface PlannerResult {
  spotId: string;
  spotName: string;
  locationType: FishingLocationType;
  speciesId: SpeciesId;
  fetchedAt: number;
  now: FishingScore;
  nowHour: HourPoint;
  today: DayOutlook | null;
  days: DayOutlook[];
  hourly: HourScore[];
  trend: TrendSummary;
  marine: MarineSnapshot | null;
  marineRequested: boolean;
  marineError: string | null;
}

// ------------------------------------------------------------
// Stan aplikacji
// ------------------------------------------------------------

export type AppStatus = 'idle' | 'loading' | 'success' | 'error';

export type TabId = 'teraz' | 'dzis' | 'tydzien' | 'dlaczego';
