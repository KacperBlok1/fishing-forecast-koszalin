import type { FishingScore } from '../types';
import { getSpecies } from '../data/species';

interface FactorListProps {
  score: FishingScore;
}

/** Rozkład wyniku na czynniki — odpowiedź na pytanie "dlaczego akurat tyle?". */
export default function FactorList({ score }: FactorListProps) {
  const species = getSpecies(score.speciesId);

  return (
    <section className="card">
      <h2 className="card-title">Z czego wynika ocena</h2>

      <ul className="factor-list">
        {score.factors.map((factor) => (
          <li key={factor.key} className={`factor impact-${factor.impact}`}>
            <div className="factor-head">
              <span className="factor-label">{factor.label}</span>
              <span className="factor-weight">waga {factor.weight}</span>
              <span className="factor-score">{Math.round(factor.score)}</span>
            </div>
            <div className="factor-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(2, Math.min(100, factor.score))}%` }} />
            </div>
            <div className="factor-value">{factor.value}</div>
            <p className="factor-desc">{factor.description}</p>
          </li>
        ))}
      </ul>

      <div className="species-adjust">
        <h3>
          Korekta dla gatunku: {species.icon} {species.name}
        </h3>
        <p className="species-adjust-sum">
          Wynik bazowy <strong>{score.baseScore}</strong>
          {score.speciesDelta === 0 ? ' bez zmian' : score.speciesDelta > 0 ? ` +${score.speciesDelta}` : ` ${score.speciesDelta}`}
          {' = '}
          <strong>{score.score}</strong>
        </p>
        {score.speciesReasons.length > 0 ? (
          <ul className="reason-list">
            {score.speciesReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Żadna reguła gatunkowa nie zmieniła wyniku w tych warunkach.</p>
        )}
        {species.notes.length > 0 && (
          <ul className="note-list">
            {species.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
