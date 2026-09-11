import { useMemo, useState } from 'react';
import type { HourPoint, HourScore } from '../types';
import { formatHour, hourOf, isoDate } from '../utils/time';
import { weatherCodeIcon } from '../utils/formatting';

interface HourlyChartProps {
  /** Oceny godzinowe dla jednego dnia. */
  scores: HourScore[];
  /** Dane pogodowe dla tych samych godzin (do tabeli). */
  hours: HourPoint[];
  /** Bieżąca godzina w formacie ISO — rysujemy znacznik "teraz". */
  currentTime?: string;
}

const CHART_HEIGHT = 132;

function labelClass(label: string): string {
  return `rate-${label.replace(/\s/g, '-')}`;
}

/**
 * Godzinowy rozkład oceny: słupki + opcjonalna tabela z liczbami.
 * Wykres jest rysowany bezpośrednio w SVG — bez bibliotek i bez animacji,
 * żeby na telefonie renderował się natychmiast.
 */
export default function HourlyChart({ scores, hours, currentTime }: HourlyChartProps) {
  const [showTable, setShowTable] = useState(false);

  const hourByTime = useMemo(() => {
    const map = new Map<string, HourPoint>();
    for (const hour of hours) map.set(hour.time, hour);
    return map;
  }, [hours]);

  if (scores.length === 0) {
    return (
      <section className="card">
        <h2 className="card-title">Rozkład godzinowy</h2>
        <p className="muted">Brak danych godzinowych dla tego dnia.</p>
      </section>
    );
  }

  const barWidth = 100 / scores.length;
  const currentHour = currentTime ? hourOf(currentTime) : null;
  const currentDate = currentTime ? isoDate(currentTime) : null;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Rozkład godzinowy</h2>
        <button type="button" className="link-btn" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Pokaż wykres' : 'Pokaż tabelę'}
        </button>
      </div>

      {!showTable && (
        <>
          <div className="chart-wrap">
            <svg
              className="chart"
              viewBox={`0 0 100 ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Wykres oceny warunków w kolejnych godzinach dnia"
            >
              {[25, 50, 75].map((level) => (
                <line
                  key={level}
                  x1="0"
                  x2="100"
                  y1={CHART_HEIGHT - (level / 100) * CHART_HEIGHT}
                  y2={CHART_HEIGHT - (level / 100) * CHART_HEIGHT}
                  className="chart-grid"
                />
              ))}
              {scores.map((entry, index) => {
                const height = Math.max(2, (entry.score / 100) * CHART_HEIGHT);
                const isNow =
                  currentHour !== null && currentDate === isoDate(entry.time) && hourOf(entry.time) === currentHour;
                return (
                  <rect
                    key={entry.time}
                    x={index * barWidth + barWidth * 0.12}
                    y={CHART_HEIGHT - height}
                    width={barWidth * 0.76}
                    height={height}
                    className={`chart-bar ${labelClass(entry.label)} ${isNow ? 'is-now' : ''}`}
                  />
                );
              })}
            </svg>
          </div>
          <div className="chart-axis" aria-hidden="true">
            {scores.map((entry, index) =>
              index % Math.ceil(scores.length / 8) === 0 ? (
                <span key={entry.time} style={{ left: `${(index + 0.5) * barWidth}%` }}>
                  {formatHour(entry.time)}
                </span>
              ) : null
            )}
          </div>
          <p className="chart-legend">
            <span className="swatch rate-bardzo-dobrze" /> bardzo dobrze
            <span className="swatch rate-dobrze" /> dobrze
            <span className="swatch rate-średnio" /> średnio
            <span className="swatch rate-słabo" /> słabo
          </p>
        </>
      )}

      {showTable && (
        <div className="table-wrap">
          <table className="hour-table">
            <thead>
              <tr>
                <th scope="col">Godz.</th>
                <th scope="col">Ocena</th>
                <th scope="col">Temp.</th>
                <th scope="col">Wiatr</th>
                <th scope="col">Opad</th>
                <th scope="col">Niebo</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry) => {
                const hour = hourByTime.get(entry.time);
                return (
                  <tr key={entry.time} className={labelClass(entry.label)}>
                    <th scope="row">{formatHour(entry.time)}</th>
                    <td>
                      <span className="table-score">{entry.score}</span>
                    </td>
                    <td>{hour ? `${Math.round(hour.temperature)} °C` : '—'}</td>
                    <td>{hour ? `${Math.round(hour.windSpeed)} km/h` : '—'}</td>
                    <td>{hour ? `${hour.precipitation.toFixed(1)} mm` : '—'}</td>
                    <td aria-label={hour ? String(hour.weatherCode) : undefined}>
                      {hour ? weatherCodeIcon(hour.weatherCode) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
