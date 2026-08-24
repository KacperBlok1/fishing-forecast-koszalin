export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', weekday: 'short' });
}

export function formatTemp(t: number): string {
  return (t > 0 ? '+' : '') + Math.round(t) + '°C';
}

export function formatWind(speed: number): string {
  return Math.round(speed) + ' km/h';
}

export function formatPrecip(p: number): string {
  return p.toFixed(1) + ' mm/h';
}

export function formatPressure(p: number): string {
  return Math.round(p) + ' hPa';
}

export function formatWave(h: number): string {
  return h.toFixed(1) + ' m';
}

export function getWeatherCodeIcon(code: number): string {
  const m: Record<number, string> = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
    71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
    80: '🌦️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '🌨️',
    95: '⛈️', 96: '⛈️', 99: '⛈️',
  };
  return m[code] || '🌡️';
}

export function getVerdictColor(score: number): string {
  if (score >= 75) return '#2ecc71';
  if (score >= 45) return '#f39c12';
  return '#e74c3c';
}
