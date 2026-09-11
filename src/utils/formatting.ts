import type { RatingLabel } from '../types';

const WIND_DIRECTIONS = ['płn.', 'płn.-wsch.', 'wsch.', 'poł.-wsch.', 'poł.', 'poł.-zach.', 'zach.', 'płn.-zach.'];

/** Kierunek wiatru w stopniach → skrót po polsku (kierunek, z którego wieje). */
export function windDirectionName(degrees: number): string {
  if (!Number.isFinite(degrees)) return '—';
  const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return WIND_DIRECTIONS[index];
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Bezchmurnie',
  1: 'Głównie bezchmurnie',
  2: 'Częściowe zachmurzenie',
  3: 'Pochmurno',
  45: 'Mgła',
  48: 'Mgła osadzająca szadź',
  51: 'Lekka mżawka',
  53: 'Mżawka',
  55: 'Gęsta mżawka',
  56: 'Marznąca mżawka',
  57: 'Gęsta marznąca mżawka',
  61: 'Słaby deszcz',
  63: 'Deszcz',
  65: 'Ulewny deszcz',
  66: 'Marznący deszcz',
  67: 'Silny marznący deszcz',
  71: 'Słaby śnieg',
  73: 'Śnieg',
  75: 'Intensywny śnieg',
  77: 'Śnieg ziarnisty',
  80: 'Przelotny deszcz',
  81: 'Silne przelotne opady',
  82: 'Nawalne przelotne opady',
  85: 'Przelotny śnieg',
  86: 'Silny przelotny śnieg',
  95: 'Burza',
  96: 'Burza z gradem',
  99: 'Silna burza z gradem',
};

export function weatherCodeDescription(code: number): string {
  return WEATHER_CODES[code] ?? 'Warunki mieszane';
}

const WEATHER_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export function weatherCodeIcon(code: number): string {
  return WEATHER_ICONS[code] ?? '🌡️';
}

/** Kolor przypisany etykiecie oceny — używany w wykresach i odznakach. */
export function ratingColor(label: RatingLabel): string {
  switch (label) {
    case 'bardzo dobrze':
      return 'var(--rate-great)';
    case 'dobrze':
      return 'var(--rate-good)';
    case 'średnio':
      return 'var(--rate-mid)';
    case 'słabo':
    default:
      return 'var(--rate-poor)';
  }
}

export function formatTemperature(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} °C`;
}

export function formatWind(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} km/h`;
}

export function formatPrecipitation(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} mm`;
}

export function formatPressure(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} hPa`;
}

export function formatWave(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'brak danych';
  return `${value.toFixed(1)} m`;
}

export function formatSigned(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded} ${unit}`;
}
