import type { MarineSnapshot } from '../types';
import { formatWave, windDirectionName } from '../utils/formatting';
import { IconAlert, IconWaves } from './Icons';

interface MarinePanelProps {
  marine: MarineSnapshot | null;
  marineRequested: boolean;
  marineError: string | null;
}

const SAFETY_CLASS: Record<string, string> = {
  bezpiecznie: 'safety-ok',
  ostrożnie: 'safety-warn',
  'trudne warunki': 'safety-bad',
  niebezpiecznie: 'safety-danger',
  'brak danych': 'safety-unknown',
};

/**
 * Tryb morski. Niczego tu nie zmyślamy — jeżeli Marine API nie zwróciło
 * wartości, piszemy to wprost zamiast pokazywać wymyśloną liczbę.
 */
export default function MarinePanel({ marine, marineRequested, marineError }: MarinePanelProps) {
  if (!marineRequested) return null;

  return (
    <section className="card">
      <h2 className="card-title">
        <IconWaves size={18} /> Morze — fala i bezpieczeństwo
      </h2>

      {!marine || marine.waveHeight === null ? (
        <div className="notice notice-warn">
          <IconAlert size={18} />
          <div>
            <strong>Brak danych o fali dla tego punktu.</strong>
            <p>
              {marineError ??
                'Marine API nie zwróciło wartości dla wybranych współrzędnych. Punkt może leżeć poza siatką modelu falowego — spróbuj wskazać miejsce bliżej otwartej wody.'}
            </p>
            <p>Ocena nie zawiera komponentu morskiego i nie zastępuje sprawdzenia warunków na miejscu.</p>
          </div>
        </div>
      ) : (
        <>
          <div className={`safety ${SAFETY_CLASS[marine.safetyLevel] ?? 'safety-unknown'}`}>
            <span className="safety-level">{marine.safetyLevel}</span>
            <p>{marine.safetyNote}</p>
          </div>

          <dl className="marine-facts">
            <div>
              <dt>Wysokość fali</dt>
              <dd>{formatWave(marine.waveHeight)}</dd>
            </div>
            <div>
              <dt>Okres fali</dt>
              <dd>{marine.wavePeriod === null ? 'brak danych' : `${marine.wavePeriod.toFixed(1)} s`}</dd>
            </div>
            <div>
              <dt>Kierunek fali</dt>
              <dd>{marine.waveDirection === null ? 'brak danych' : windDirectionName(marine.waveDirection)}</dd>
            </div>
            <div>
              <dt>Temperatura wody</dt>
              <dd>
                {marine.waterTemperature === null ? 'brak danych' : `${Math.round(marine.waterTemperature)} °C`}
              </dd>
            </div>
          </dl>
        </>
      )}

      <p className="fineprint">
        Dane falowe pochodzą z modelu Open-Meteo Marine i są prognozą dla punktu siatki, nie pomiarem z boi.
        Przed wejściem na falochron, ostrogę lub pokład zawsze sprawdź warunki na miejscu i ostrzeżenia IMGW.
      </p>
    </section>
  );
}
