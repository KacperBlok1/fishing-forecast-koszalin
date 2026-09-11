import type { TrendSummary } from '../types';
import { formatSigned } from '../utils/formatting';
import { IconGauge, IconThermometer, IconDrop, IconCheck, IconAlert } from './Icons';

interface TrendCardProps {
  trend: TrendSummary;
}

/** Krótkie podsumowanie tego, co działo się z pogodą przez ostatnie 3 dni. */
export default function TrendCard({ trend }: TrendCardProps) {
  if (!trend.hasData) {
    return (
      <section className="card">
        <h2 className="card-title">Trend z ostatnich 3 dni</h2>
        <p className="muted">Brak kompletu danych historycznych dla tego punktu.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="card-title">Trend z ostatnich 3 dni</h2>
      <ul className="trend-grid">
        <li>
          <IconThermometer size={18} />
          <span className="trend-value">{formatSigned(trend.temperatureChange, '°C')}</span>
          <span className="trend-label">temperatura dziś vs średnia z 3 dni</span>
        </li>
        <li>
          <IconGauge size={18} />
          <span className="trend-value">{formatSigned(trend.pressureChange24h, 'hPa')}</span>
          <span className="trend-label">ciśnienie w ciągu 24 h</span>
        </li>
        <li>
          <IconDrop size={18} />
          <span className="trend-value">{trend.rainLast3Days.toFixed(1)} mm</span>
          <span className="trend-label">suma opadów z 3 dni</span>
        </li>
        <li className={trend.stable ? 'is-good' : 'is-bad'}>
          {trend.stable ? <IconCheck size={18} /> : <IconAlert size={18} />}
          <span className="trend-value">{trend.stable ? 'stabilnie' : 'zmiennie'}</span>
          <span className="trend-label">stabilność pogody ({trend.stabilityScore}/100)</span>
        </li>
      </ul>
    </section>
  );
}
