import type { CurrentWeather, ForecastHourly } from '../types';
import { formatTime } from '../utils/formatting';

interface ForecastChartProps {
  hourly: ForecastHourly | null;
  current: CurrentWeather | null;
}

export default function ForecastChart({ hourly, current }: ForecastChartProps) {
  if (!hourly || hourly.time.length < 24) return null;

  const startIndex = current ? hourly.time.findIndex(time => time >= current.time) : 0;
  if (startIndex < 0) return null;

  const data = hourly.time.slice(startIndex, startIndex + 24).map((t, index) => {
    const i = startIndex + index;
    return {
    time: t,
    temp: hourly.temperature[i],
    precip: hourly.precipitation[i],
    wind: hourly.windSpeed[i],
    pressure: hourly.pressure[i],
    };
  });

  const maxTemp = Math.max(...data.map(d => d.temp));
  const minTemp = Math.min(...data.map(d => d.temp));
  const tempRange = maxTemp - minTemp || 1;

  const w = 720;
  const h = 200;
  const padL = 40;
  const padB = 30;
  const chartH = h - padB;
  const stepX = (w - padL) / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padB + chartH * (1 - (d.temp - minTemp) / tempRange),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;

  const maxPrecip = Math.max(...data.map(d => d.precip), 1);
  const totalPrecip = Math.round(data.reduce((a, d) => a + d.precip, 0) * 10) / 10;
  const chartTitle = 'Prognoza temperatury i opadów na najbliższe 24 godziny';
  const chartDesc = `Temperatura od ${Math.round(minTemp)}°C do ${Math.round(maxTemp)}°C.` +
    (totalPrecip > 0 ? ` Łączne przewidywane opady: ${totalPrecip} mm.` : ' Bez opadów.');

  return (
    <div className="card card-chart reveal reveal-delay-2">
      <div className="card-header">
        <h2>Prognoza 24h</h2>
      </div>
      <div className="chart-container">
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="forecast-chart-title forecast-chart-desc">
          <title id="forecast-chart-title">{chartTitle}</title>
          <desc id="forecast-chart-desc">{chartDesc}</desc>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green-light)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--green-light)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--green-accent)" />
              <stop offset="100%" stopColor="var(--green-light)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
            <line
              key={i}
              x1={padL}
              y1={padB + chartH * (1 - frac)}
              x2={w}
              y2={padB + chartH * (1 - frac)}
              stroke="var(--border-subtle)"
              strokeWidth="0.5"
            />
          ))}

          {/* Area */}
          <path d={areaPath} fill="url(#tempGrad)" />

          {/* Temperature line */}
          <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Precipitation bars */}
          {data.map((d, i) => {
            const x = padL + i * stepX;
            const barH = (d.precip / maxPrecip) * 30;
            return (
              <rect
                key={`p${i}`}
                x={x - 4}
                y={h - barH}
                width={8}
                height={barH}
                fill="var(--green-primary)"
                opacity={d.precip > 0 ? 0.3 : 0}
                rx="2"
              />
            );
          })}

          {/* Data points */}
          {points.map((p, i) => (
            <circle key={`pt${i}`} cx={p.x} cy={p.y} r="3" fill="var(--bg-deep)" stroke="var(--green-light)" strokeWidth="1.5" />
          ))}

          {/* Time labels */}
          {data.map((d, i) => {
            if (i % 3 !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={`t${i}`}
                x={padL + i * stepX}
                y={h - 4}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {formatTime(d.time)}
              </text>
            );
          })}

          {/* Temperature labels */}
          <text x={8} y={padB + 4} fontSize="10" fill="var(--text-muted)">
            {Math.round(maxTemp)}°C
          </text>
          <text x={8} y={h - 4} fontSize="10" fill="var(--text-muted)">
            {Math.round(minTemp)}°C
          </text>
        </svg>
      </div>
      <table className="sr-only">
        <caption>Dane godzinowe prognozy — temperatura, opady i wiatr</caption>
        <thead>
          <tr><th scope="col">Godzina</th><th scope="col">Temperatura</th><th scope="col">Opady</th><th scope="col">Wiatr</th></tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{formatTime(d.time)}</td>
              <td>{Math.round(d.temp)}°C</td>
              <td>{d.precip > 0 ? `${d.precip} mm` : 'brak'}</td>
              <td>{Math.round(d.wind)} km/h</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="chart-labels">
        <span>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <line x1="0" y1="6" x2="12" y2="6" stroke="var(--green-light)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Temperatura
        </span>
        <span>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <rect x="2" y="2" width="8" height="8" rx="2" fill="var(--green-primary)" opacity="0.5" />
          </svg>
          Opady
        </span>
        <span>{Math.round(minTemp)}°C — {Math.round(maxTemp)}°C</span>
      </div>
    </div>
  );
}
