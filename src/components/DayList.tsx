import { useState } from 'react';
import type { DayOutlook } from '../types';
import { formatDayShort, formatHour } from '../utils/time';
import { weatherCodeDescription, weatherCodeIcon } from '../utils/formatting';
import WindowList from './WindowList';
import { IconChevron } from './Icons';

interface DayListProps {
  days: DayOutlook[];
  today: string;
}

/** Prognoza na 7 dni — każdy dzień można rozwinąć, żeby zobaczyć okna czasowe. */
export default function DayList({ days, today }: DayListProps) {
  const [expanded, setExpanded] = useState<string | null>(days[0]?.date ?? null);

  if (days.length === 0) {
    return (
      <section className="card">
        <h2 className="card-title">Prognoza 7-dniowa</h2>
        <p className="muted">Brak danych prognozy.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="card-title">Prognoza 7-dniowa</h2>
      <p className="card-sub">
        Ocena dnia łączy <strong>najlepsze okno połowowe</strong> (65 %) ze <strong>średnią z godzin dziennych</strong> (35 %) —
        jedna dobra godzina o świcie nie wystarczy, żeby cały dzień był wart wyjazdu.
      </p>

      <ul className="day-list">
        {days.map((day) => {
          const isOpen = expanded === day.date;
          return (
            <li key={day.date} className={`day rate-${day.label.replace(/\s/g, '-')}`}>
              <button
                type="button"
                className="day-head"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : day.date)}
              >
                <span className="day-name">
                  {day.date === today ? 'dziś' : formatDayShort(day.date)}
                </span>
                <span className="day-weather" aria-hidden="true">
                  {weatherCodeIcon(day.weatherCode)}
                </span>
                <span className="day-temps">
                  {Math.round(day.temperatureMax)}° / {Math.round(day.temperatureMin)}°
                </span>
                <span className="day-score">
                  <strong>{day.score}</strong>
                  <span className="rate-badge small">{day.label}</span>
                </span>
                <IconChevron size={16} className={`day-chevron ${isOpen ? 'is-open' : ''}`} />
              </button>

              {isOpen && (
                <div className="day-body">
                  <dl className="day-facts">
                    <div>
                      <dt>Pogoda</dt>
                      <dd>{weatherCodeDescription(day.weatherCode)}</dd>
                    </div>
                    <div>
                      <dt>Wiatr max</dt>
                      <dd>{Math.round(day.windSpeedMax)} km/h</dd>
                    </div>
                    <div>
                      <dt>Opady</dt>
                      <dd>{day.precipitationSum.toFixed(1)} mm</dd>
                    </div>
                    <div>
                      <dt>Słońce</dt>
                      <dd>
                        ↑ {formatHour(day.sunrise)} ↓ {formatHour(day.sunset)}
                      </dd>
                    </div>
                    <div>
                      <dt>Księżyc</dt>
                      <dd>
                        {day.moon.icon} {day.moon.phase}
                      </dd>
                    </div>
                    <div>
                      <dt>Najlepsze okno</dt>
                      <dd>{day.bestWindowScore}/100</dd>
                    </div>
                    <div>
                      <dt>Średnia dnia</dt>
                      <dd>{day.averageScore}/100</dd>
                    </div>
                  </dl>
                  <WindowList windows={day.windows} compact emptyText="Brak wyraźnych okien tego dnia." />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
