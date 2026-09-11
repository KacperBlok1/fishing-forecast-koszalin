import type { FishingLocationType, FishingScore, HourPoint, Spot } from '../types';
import { getSpecies } from '../data/species';
import { formatHour } from '../utils/time';
import { weatherCodeDescription, weatherCodeIcon, windDirectionName } from '../utils/formatting';
import { IconPin } from './Icons';

interface ScoreHeroProps {
  spot: Spot;
  score: FishingScore;
  hour: HourPoint;
  sunrise: string;
  sunset: string;
}

const TYPE_LABEL: Record<FishingLocationType, string> = {
  jezioro: 'Jezioro',
  rzeka: 'Rzeka',
  morze: 'Morze',
};

const BACKGROUNDS: Record<FishingLocationType, { jpg: string; webp: string; alt: string }> = {
  jezioro: {
    jpg: '/images/hero-lake-dawn.jpg',
    webp: '/images/hero-lake-dawn.webp',
    alt: 'Jezioro o świcie',
  },
  rzeka: {
    jpg: '/images/fisherman-silhouette.jpg',
    webp: '/images/fisherman-silhouette.webp',
    alt: 'Wędkarz nad rzeką',
  },
  morze: {
    jpg: '/images/sea-storm.jpg',
    webp: '/images/sea-storm.webp',
    alt: 'Fale Bałtyku',
  },
};

/** Zdanie podsumowujące — pierwsza rzecz, którą użytkownik czyta. */
function buildSummary(score: FishingScore, spot: Spot): string {
  const species = getSpecies(score.speciesId);
  switch (score.label) {
    case 'bardzo dobrze':
      return `Bardzo dobre warunki na ${species.genitive} — ${spot.name} jest teraz dobrym wyborem.`;
    case 'dobrze':
      return `Dobre warunki na ${species.genitive}. Warto pojechać, zwłaszcza w najlepszym oknie czasowym.`;
    case 'średnio':
      return `Średnie warunki. Na ${species.genitive} da się coś zrobić, ale wybierz najlepsze okno w ciągu dnia.`;
    case 'słabo':
    default:
      return `Słabe warunki na ${species.genitive}. Jeśli możesz — poczekaj na lepszy dzień.`;
  }
}

export default function ScoreHero({ spot, score, hour, sunrise, sunset }: ScoreHeroProps) {
  const image = BACKGROUNDS[spot.type];
  const species = getSpecies(score.speciesId);

  return (
    <section className={`score-hero rate-${score.label.replace(/\s/g, '-')}`} aria-live="polite">
      <div className="score-hero-bg" aria-hidden="true">
        <picture>
          <source srcSet={image.webp} type="image/webp" />
          <img src={image.jpg} alt="" loading="lazy" decoding="async" />
        </picture>
      </div>

      <div className="score-hero-inner">
        <div className="score-hero-place">
          <IconPin size={15} />
          <span>{spot.name}</span>
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <span>{TYPE_LABEL[spot.type]}</span>
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <span>
            {species.icon} {species.name}
          </span>
        </div>

        <div className="score-hero-main">
          <div className="score-hero-number">
            <strong>{score.score}</strong>
            <span>/100</span>
          </div>
          <div className="score-hero-verdict">
            <span className="rate-badge">{score.label}</span>
            <span className="score-hero-time">
              {formatHour(hour.time)} · {weatherCodeIcon(hour.weatherCode)} {weatherCodeDescription(hour.weatherCode)}
            </span>
          </div>
        </div>

        <p className="score-hero-summary">{buildSummary(score, spot)}</p>

        <div className="score-hero-strip">
          <span>{Math.round(hour.temperature)} °C</span>
          <span>
            {Math.round(hour.windSpeed)} km/h {windDirectionName(hour.windDirection)}
          </span>
          <span>{Math.round(hour.pressure)} hPa</span>
          <span>
            ↑ {formatHour(sunrise)} ↓ {formatHour(sunset)}
          </span>
          <span>
            {score.moon.icon} {score.moon.phase}
          </span>
        </div>
      </div>
    </section>
  );
}
