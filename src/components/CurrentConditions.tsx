import { Wind, Droplets, CloudSun, Gauge, Thermometer, Sunrise } from 'lucide-react';
import type { CurrentWeather } from '../types';
import { formatTime, formatTemp } from '../utils/formatting';

interface CurrentConditionsProps {
  current: CurrentWeather | null;
}

function getWeatherEmoji(code: number): string {
  const map: Record<number, string> = {
    0: '\u2600\uFE0F', 1: '\u2600\uFE0F \u00B7\u00B7', 2: '\u26C5', 3: '\u2601\uFE0F',
    45: '\u{1F32B}\uFE0F', 48: '\u{1F32B}\uFE0F',
    51: '\u{1F326}\uFE0F', 53: '\u{1F326}\uFE0F', 55: '\u{1F327}\uFE0F',
    61: '\u{1F327}\uFE0F', 63: '\u{1F327}\uFE0F', 65: '\u{1F327}\uFE0F',
    71: '\u{1F7CB}\uFE0F', 73: '\u{1F7CB}\uFE0F', 75: '\u{1F7CB}\uFE0F',
    95: '\u26C8\uFE0F',
  };
  return map[code] || '';
}

export default function CurrentConditions({ current }: CurrentConditionsProps) {
  if (!current) return null;

  const conditions = [
    {
      icon: <Thermometer size={20} />,
      label: 'Temperatura',
      value: formatTemp(current.temperature),
      detail: `Odczuwalna: ${formatTemp(current.feelsLike)}`,
    },
    {
      icon: <Wind size={20} />,
      label: 'Wiatr',
      value: `${Math.round(current.windSpeed)} km/h`,
      detail: `Podmuchy: ${Math.round(current.windGusts)} km/h`,
    },
    {
      icon: <Gauge size={20} />,
      label: 'Ciśnienie',
      value: `${Math.round(current.pressure)} hPa`,
      detail: current.pressure > 1020 ? 'Wysokie' : current.pressure > 1010 ? 'Normalne' : 'Niskie',
    },
    {
      icon: <Droplets size={20} />,
      label: 'Wilgotność',
      value: `${current.relativeHumidity}%`,
      detail: current.precipitation > 0 ? `${current.precipitation} mm/h opadów` : 'Brak opadów',
    },
    {
      icon: <CloudSun size={20} />,
      label: 'Zachmurzenie',
      value: `${current.cloudCover}%`,
      detail: getWeatherEmoji(current.weatherCode),
    },
    {
      icon: <Sunrise size={20} />,
      label: 'Wschód / Zachód',
      value: formatTime(current.sunrise),
      detail: formatTime(current.sunset),
    },
  ];

  return (
    <div className="card card-conditions reveal">
      <div className="card-header">
        <h2>Warunki bieżące</h2>
      </div>
      <div className="conditions-grid">
        {conditions.map((c, i) => (
          <div key={i} className="condition-item">
            <div className="condition-icon">{c.icon}</div>
            <div className="condition-info">
              <span className="condition-label">{c.label}</span>
              <span className="condition-value">{c.value}</span>
              <span className="condition-detail">{c.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
