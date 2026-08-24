import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HistoricalDaily } from '../types';
import { formatDate, formatTemp } from '../utils/formatting';

interface TrendStripProps {
  historical: HistoricalDaily | null;
}

export default function TrendStrip({ historical }: TrendStripProps) {
  if (!historical || historical.time.length < 3) return null;

  const last3 = {
    temps: historical.temperatureMean.slice(-3),
    rains: historical.precipitationSum.slice(-3),
    wind: historical.windSpeedMax.slice(-3),
    press: historical.pressureMin.slice(-3),
  };

  const tempTrend = last3.temps[last3.temps.length - 1] - last3.temps[0];
  const rainTrend = last3.rains[last3.rains.length - 1] - last3.rains[0];
  const windTrend = last3.wind[last3.wind.length - 1] - last3.wind[0];

  const minTemp = Math.min(...last3.temps);
  const maxTemp = Math.max(...last3.temps);
  const tempRange = maxTemp - minTemp || 1;

  // Mini sparkline for temperature
  const sparkW = 120;
  const sparkH = 32;
  const sparkPoints = last3.temps.map((t, i) => {
    const x = (i / (last3.temps.length - 1)) * sparkW;
    const y = sparkH - ((t - minTemp) / tempRange) * (sparkH - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="card card-trend reveal reveal-delay-1">
      <div className="card-header">
        <h2>Trend 3 dni</h2>
      </div>
      <div className="trend-strip">
        <div className="trend-metric">
          <span className="trend-label">Temperatura</span>
          <div className="trend-sparkline">
            <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`}>
              <polyline
                fill="none"
                stroke="var(--green-accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparkPoints}
              />
              {last3.temps.map((t, i) => {
                const x = (i / (last3.temps.length - 1)) * sparkW;
                const y = sparkH - ((t - minTemp) / tempRange) * (sparkH - 4) - 2;
                return <circle key={i} cx={x} cy={y} r="3" fill="var(--green-light)" />;
              })}
            </svg>
          </div>
          <div className="trend-value">
            {tempTrend > 0 ? <TrendingUp size={14} /> : tempTrend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span>{tempTrend > 0 ? '+' : ''}{Math.round(tempTrend)}°C</span>
          </div>
        </div>

        <div className="trend-metric">
          <span className="trend-label">Opady</span>
          <div className="trend-dots">
            {last3.rains.map((r, i) => (
              <div
                key={i}
                className={`trend-dot ${r > 5 ? 'heavy' : r > 0 ? 'light' : 'none'}`}
                title={`${formatDate(historical.time[historical.time.length - 3 + i])}: ${r} mm`}
              />
            ))}
          </div>
          <div className="trend-value">
            {rainTrend > 0 ? <TrendingUp size={14} /> : rainTrend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span>{rainTrend > 0 ? '+' : ''}{Math.round(rainTrend)} mm</span>
          </div>
        </div>

        <div className="trend-metric">
          <span className="trend-label">Wiatr</span>
          <div className="trend-value">
            {windTrend > 0 ? <TrendingUp size={14} /> : windTrend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span>{windTrend > 0 ? '+' : ''}{Math.round(windTrend)} km/h</span>
          </div>
        </div>
      </div>

      <div className="trend-dates">
        {last3.temps.map((_, i) => (
          <span key={i} className="trend-date">
            {formatDate(historical.time[historical.time.length - 3 + i])}
          </span>
        ))}
      </div>
    </div>
  );
}
