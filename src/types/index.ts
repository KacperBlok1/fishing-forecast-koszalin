// ============================================================
// Typy dla danych Open-Meteo
// ============================================================

export interface GeoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  relativeHumidity: number;
  precipitation: number;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  weatherCode: number;
  isDay: number;
  sunrise: string;
  sunset: string;
}

export interface ForecastHourly {
  time: string[];
  temperature: number[];
  feelsLike: number[];
  precipitation: number[];
  windSpeed: number[];
  windDirection: number[];
  pressure: number[];
  cloudCover: number[];
  weatherCode: number[];
  relativeHumidity: number[];
}

export interface HistoricalDaily {
  time: string[];
  temperatureMax: number[];
  temperatureMin: number[];
  temperatureMean: number[];
  precipitationSum: number[];
  windSpeedMax: number[];
  windDirectionDominant: number[];
  pressureMean: number[];
  weatherCode: number[];
}

export interface MarineData {
  current?: {
    waveHeight: number;
    waveDirection: number;
    waterTemperature: number;
  };
  waveHeight?: number[];
  waveDirection?: number[];
  waterTemperature?: number[];
  currentSpeed?: number[];
  currentDirection?: number[];
}

// ============================================================
// Typy dla wyników algorytmu
// ============================================================

export type FishingLocationType = 'jezioro' | 'rzeka' | 'morze';

export type FishingVerdict = 'go' | 'conditional' | 'skip';

export interface WeatherFactor {
  name: string;
  icon: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface ScoreComponent {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  details: string[];
}

export interface BestWindow {
  start: string;
  end: string;
  score: number;
  temperature: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
}

export interface TrendData {
  temperatureChange: number;
  pressureChange: number;
  totalRain: number;
  windTrend: 'stabilny' | 'wzrost' | 'spadek';
  improvement: boolean;
}

export interface ForecastResult {
  score: number;
  verdict: FishingVerdict;
  verdictLabel: string;
  verdictIcon: string;
  components: ScoreComponent[];
  factors: WeatherFactor[];
  bestWindows: BestWindow[];
  trend: TrendData;
  keyFactors: string[];
  calculationNotes: string[];
}

// ============================================================
// Typy dla stanu aplikacji
// ============================================================

export interface LocationState {
  name: string;
  latitude: number;
  longitude: number;
  type: FishingLocationType;
}

export type AppStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AppState {
  status: AppStatus;
  location: LocationState;
  currentWeather: CurrentWeather | null;
  forecastHourly: ForecastHourly | null;
  historicalDaily: HistoricalDaily | null;
  marineData: MarineData | null;
  forecastResult: ForecastResult | null;
  error: string | null;
}

// ============================================================
// Typy dla Open-Meteo responses
// ============================================================

export interface GeocodingResponse {
  results: GeoLocation[];
}

export interface OpenMeteoResponse {
  current?: CurrentWeather;
  hourly?: ForecastHourly;
  daily?: HistoricalDaily;
  timezone: string;
}

export interface MarineResponse {
  current?: {
    waveHeight: number;
    waveDirection: number;
    waterTemperature: number;
  };
  hourly?: {
    time: string[];
    waveHeight: number[];
    waveDirection: number[];
    waterTemperature: number[];
  };
  timezone: string;
}
