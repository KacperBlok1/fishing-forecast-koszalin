import type { FishingLocationType, SpeciesId } from '../types';
import { SPECIES } from '../data/species';

interface SpeciesBarProps {
  value: SpeciesId;
  /** Typ akwenu wybranego łowiska — gatunki spoza niego są wyszarzone. */
  locationType: FishingLocationType;
  onChange: (id: SpeciesId) => void;
}

export default function SpeciesBar({ value, locationType, onChange }: SpeciesBarProps) {
  return (
    <div className="species-bar">
      <span className="species-bar-label" id="species-label">
        Gatunek
      </span>
      <div className="species-chips" role="radiogroup" aria-labelledby="species-label">
        {SPECIES.map((species) => {
          const fits = species.habitats.includes(locationType);
          return (
            <button
              key={species.id}
              type="button"
              role="radio"
              aria-checked={value === species.id}
              className={`chip ${value === species.id ? 'is-active' : ''} ${fits ? '' : 'is-offhabitat'}`}
              onClick={() => onChange(species.id)}
              title={fits ? species.summary : `${species.summary} Nietypowy dla akwenu „${locationType}" — wynik dostanie karę.`}
            >
              <span aria-hidden="true">{species.icon}</span>
              {species.name}
              {!fits && <span className="chip-flag" aria-hidden="true">!</span>}
              {!fits && <span className="sr-only">nietypowy dla tego akwenu</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
