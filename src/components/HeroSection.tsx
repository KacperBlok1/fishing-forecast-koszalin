import { useState, useEffect, useRef } from 'react';
import { MapPin, Waves, Anchor } from 'lucide-react';
import type { FishingLocationType, ForecastResult, CurrentWeather } from '../types';

interface HeroSectionProps {
  locationName: string;
  locationType: FishingLocationType;
  result: ForecastResult | null;
  currentWeather: CurrentWeather | null;
}

function getVerdictBadge(result: ForecastResult | null) {
  if (!result) return null;
  const config = {
    go: { label: 'Idź na ryby', color: '#9EBC8A', bg: 'rgba(158,188,138,0.15)', border: 'rgba(158,188,138,0.3)' },
    conditional: { label: 'Warunkowo', color: '#D2D0A0', bg: 'rgba(210,208,160,0.15)', border: 'rgba(210,208,160,0.3)' },
    skip: { label: 'Lepiej odpuść', color: '#C47060', bg: 'rgba(196,112,96,0.15)', border: 'rgba(196,112,96,0.3)' },
  };
  const c = config[result.verdict] || config.conditional;
  return { ...c, verdict: result.verdict };
}

export default function HeroSection({ locationName, locationType, result, currentWeather }: HeroSectionProps) {
  const [score, setScore] = useState(0);
  const targetScore = result?.score ?? 0;
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) return;
    animated.current = true;
    const start = Date.now();
    const duration = 1800;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setScore(Math.round(eased * targetScore));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [targetScore]);

  const verdictBadge = getVerdictBadge(result);
  const typeLabel = locationType === 'jezioro' ? 'Jezioro' : locationType === 'rzeka' ? 'Rzeka' : 'Morze';
  const typeIcon = locationType === 'jezioro' ? <Anchor size={14} /> : locationType === 'rzeka' ? <Waves size={14} /> : <Waves size={14} />;

  const scoreColor = score >= 75 ? '#9EBC8A' : score >= 45 ? '#D2D0A0' : '#C47060';

  // Tło hero dopasowane do typu łowiska (wcześniej zawsze pokazywało to samo jezioro,
  // mimo że w projekcie były już przygotowane osobne zdjęcia dla rzeki i morza).
  const heroImage = locationType === 'morze'
    ? { src: '/images/sea-storm.jpg', webp: '/images/sea-storm.webp', width: 1280, height: 952, alt: 'Fale Bałtyku na polskim wybrzeżu' }
    : locationType === 'rzeka'
      ? { src: '/images/fisherman-silhouette.jpg', webp: '/images/fisherman-silhouette.webp', width: 1400, height: 876, alt: 'Wędkarz na brzegu rzeki o świcie' }
      : { src: '/images/hero-lake-dawn.jpg', webp: '/images/hero-lake-dawn.webp', width: 1920, height: 1232, alt: 'Jezioro o świcie — spokojna tafla wody w porannym świetle' };

  return (
    <section className="hero">
      <div className="hero-bg">
        <picture key={heroImage.src}>
          <source srcSet={heroImage.webp} type="image/webp" />
          <img
            src={heroImage.src}
            width={heroImage.width}
            height={heroImage.height}
            alt={heroImage.alt}
            className="hero-bg-image ken-burns"
            loading="eager"
            fetchPriority="high"
          />
        </picture>
        <div className="hero-gradient" />
        <div className="hero-vignette" />
      </div>

      <div className="hero-content">
        <div className="hero-meta">
          <div className="hero-location">
            <MapPin size={16} />
            <span>{locationName}</span>
          </div>
          <div className="hero-type">
            {typeIcon}
            <span>{typeLabel}</span>
          </div>
        </div>

        <div className="hero-score">
          <div className="hero-score-value" style={{ color: scoreColor }}>
            <span className="score-number">{score}</span>
            <span className="score-max">/ 100</span>
          </div>
          <div className="hero-score-label">Ocena wędkarska</div>
        </div>

        {verdictBadge && (
          <div
            className={`hero-badge badge-pulse ${verdictBadge.verdict}`}
            style={{
              color: verdictBadge.color,
              background: verdictBadge.bg,
              borderColor: verdictBadge.border,
            }}
          >
            {verdictBadge.label}
          </div>
        )}

        {currentWeather && (
          <div className="hero-weather">
            <span>{Math.round(currentWeather.temperature)}°C</span>
            <span className="hero-weather-sep">·</span>
            <span>{currentWeather.windSpeed} km/h wiatr</span>
          </div>
        )}
      </div>
    </section>
  );
}
