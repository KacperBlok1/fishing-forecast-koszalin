import { useState, useEffect, useRef } from 'react';
import type { ScoreComponent } from '../types';

interface ScoreDetailsProps {
  components: ScoreComponent[] | null;
}

export default function ScoreDetails({ components }: ScoreDetailsProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!components || components.length === 0) return null;

  return (
    <div className="card card-scores reveal" ref={ref}>
      <div className="card-header">
        <h2>Szczegóły oceny</h2>
      </div>
      <div className="scores-list">
        {components.map((comp, i) => {
          const pct = Math.round((comp.score / comp.maxScore) * 100);
          const color = pct >= 70 ? 'var(--green-light)' : pct >= 45 ? 'var(--gold-accent)' : 'var(--warm-red)';
          return (
            <div key={i} className="score-detail-item">
              <div className="score-detail-header">
                <span className="score-detail-name">{comp.name}</span>
                <span className="score-detail-weight">({Math.round(comp.weight * 100)}%)</span>
                <span className="score-detail-value">{comp.score}</span>
              </div>
              <div className="score-detail-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: visible ? `${pct}%` : '0%',
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transitionDelay: `${i * 0.1}s`,
                  }}
                />
              </div>
              <div className="score-detail-details">
                {comp.details.map((d, j) => (
                  <span key={j} className="score-detail-tag">{d}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
