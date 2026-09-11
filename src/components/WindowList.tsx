import type { FishingWindow } from '../types';
import { formatHour } from '../utils/time';
import { weatherCodeDescription, weatherCodeIcon } from '../utils/formatting';
import { IconClock } from './Icons';

interface WindowListProps {
  windows: FishingWindow[];
  title?: string;
  emptyText?: string;
  compact?: boolean;
}

/** Lista najlepszych okien czasowych na połów. */
export default function WindowList({
  windows,
  title = 'Najlepsze okna na połów',
  emptyText = 'Brak danych godzinowych dla tego dnia.',
  compact = false,
}: WindowListProps) {
  if (windows.length === 0) {
    return (
      <section className="card">
        <h2 className="card-title">{title}</h2>
        <p className="muted">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className={compact ? 'window-block' : 'card'}>
      {!compact && <h2 className="card-title">{title}</h2>}
      <ul className="window-list">
        {windows.map((window) => (
          <li key={window.start} className={`window rate-${window.label.replace(/\s/g, '-')}`}>
            <div className="window-time">
              <IconClock size={15} />
              <strong>
                {formatHour(window.start)}–{formatHour(window.end)}
              </strong>
            </div>
            <div className="window-score">
              <span className="window-score-value">{window.score}</span>
              <span className="rate-badge small">{window.label}</span>
            </div>
            <div className="window-meta">
              <span aria-hidden="true">{weatherCodeIcon(window.weatherCode)}</span>
              <span>{weatherCodeDescription(window.weatherCode)}</span>
              <span>{Math.round(window.averageTemperature)} °C</span>
              <span>{Math.round(window.averageWind)} km/h</span>
              {window.maxPrecipitation > 0 && <span>{window.maxPrecipitation.toFixed(1)} mm/h</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
