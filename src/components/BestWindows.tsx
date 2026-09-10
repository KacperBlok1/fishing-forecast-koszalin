import { Clock } from 'lucide-react';
import type { BestWindow } from '../types';
import { formatTime, formatTemp } from '../utils/formatting';
import { getWeatherCodeIcon } from '../utils/formatting';

interface BestWindowsProps {
  windows: BestWindow[] | null;
}

export default function BestWindows({ windows }: BestWindowsProps) {
  if (!windows || windows.length === 0) return null;

  const topWindows = windows.slice(0, 4);

  return (
    <div className="card card-windows reveal">
      <div className="card-header">
        <h2>Najlepsze okna czasowe</h2>
      </div>
      <div className="windows-grid">
        {topWindows.map((w, i) => (
          <div key={i} className="window-card">
            <div className="window-time">
              <Clock size={14} />
              <span>{formatTime(w.start)} — {formatTime(w.end)}</span>
            </div>
            <div className="window-score">
              <span className={`window-score-value score-${w.score >= 75 ? 'good' : w.score >= 45 ? 'mid' : 'bad'}`}>
                {w.score}
              </span>
            </div>
            <div className="window-details">
              <span className="window-temp">{formatTemp(w.temperature)}</span>
              <span className="window-wind">{Math.round(w.windSpeed)} km/h</span>
              <span className="window-precip">
                {w.precipitation > 0 ? `${w.precipitation} mm` : '—'}
              </span>
              <span className="window-icon">{getWeatherCodeIcon(w.weatherCode)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
