import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { FishingLocationType, GeoLocation, Spot } from '../types';
import type { SpotInput, User } from '../api';
import { weatherApi } from '../api';
import { parseCoordinates } from '../utils/coordinates';
import { IconClose, IconPin, IconPlus, IconSearch, IconTrash } from './Icons';

interface SpotPanelProps {
  spots: Spot[];
  selectedId: string | null;
  user: User | null;
  /** Steruje szufladą na wąskich ekranach; na desktopie panel jest zawsze widoczny. */
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSelect: (spot: Spot) => void;
  onCreate: (input: SpotInput) => Promise<void>;
  onDelete: (spot: Spot) => Promise<void>;
  onLogout: () => void;
}

const TYPES: { value: FishingLocationType; label: string }[] = [
  { value: 'jezioro', label: 'Jezioro' },
  { value: 'rzeka', label: 'Rzeka' },
  { value: 'morze', label: 'Morze' },
];

const GROUP_TITLES: Record<FishingLocationType, string> = {
  jezioro: 'Jeziora',
  rzeka: 'Rzeki',
  morze: 'Morze',
};

export default function SpotPanel({
  spots,
  selectedId,
  user,
  open,
  busy,
  onClose,
  onSelect,
  onCreate,
  onDelete,
  onLogout,
}: SpotPanelProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<FishingLocationType>('jezioro');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [coordsInput, setCoordsInput] = useState('');
  const [picked, setPicked] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      weatherApi
        .geocode(query)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const resetForm = () => {
    setName('');
    setQuery('');
    setResults([]);
    setCoordsInput('');
    setPicked(null);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError(null);

    const trimmedName = name.trim();
    let coords = picked;

    if (coordsInput.trim().length > 0) {
      const parsed = parseCoordinates(coordsInput);
      if (!parsed) {
        setError('Nie rozpoznałem współrzędnych. Wpisz je np. tak: 54.1943, 16.2207');
        return;
      }
      coords = parsed;
    }
    if (!coords) {
      setError('Wybierz miejsce z wyszukiwarki albo wpisz współrzędne.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Podaj nazwę łowiska (min. 2 znaki).');
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        name: trimmedName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        type,
        note: null,
      });
      resetForm();
      setAdding(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać łowiska.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (spot: Spot) => {
    if (pendingDelete !== spot.id) {
      setPendingDelete(spot.id);
      window.setTimeout(() => setPendingDelete((current) => (current === spot.id ? null : current)), 4000);
      return;
    }
    setPendingDelete(null);
    await onDelete(spot);
  };

  const grouped = TYPES.map((entry) => ({
    type: entry.value,
    items: spots.filter((spot) => spot.type === entry.value),
  }));

  return (
    <>
      <div className={`panel-scrim ${open ? 'is-open' : ''}`} onClick={onClose} role="presentation" />

      <aside className={`spot-panel ${open ? 'is-open' : ''}`} aria-label="Twoje łowiska">
        <div className="spot-panel-head">
          <div className="brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 14c3-4 7-6 11-6 3 0 5 2 6 3-1 1-3 3-6 3-4 0-8-2-11-6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="10" r="0.9" fill="currentColor" />
            </svg>
            <span>Na ryby?</span>
          </div>
          <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Zamknij listę łowisk">
            <IconClose size={18} />
          </button>
        </div>

        <div className="spot-panel-body">
          {spots.length === 0 && !busy && (
            <p className="muted">Nie masz jeszcze żadnych łowisk. Dodaj pierwsze poniżej.</p>
          )}

          {grouped.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.type} className="spot-group">
                <h3>{GROUP_TITLES[group.type]}</h3>
                <ul className="spot-list">
                  {group.items.map((spot) => (
                    <li key={spot.id} className={spot.id === selectedId ? 'is-selected' : ''}>
                      <button type="button" className="spot-btn" onClick={() => onSelect(spot)}>
                        <IconPin size={15} />
                        <span className="spot-name">{spot.name}</span>
                        <span className="spot-note">
                          {spot.note ?? `${spot.latitude.toFixed(3)}, ${spot.longitude.toFixed(3)}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`icon-btn danger ${pendingDelete === spot.id ? 'is-armed' : ''}`}
                        onClick={() => void confirmDelete(spot)}
                        aria-label={
                          pendingDelete === spot.id
                            ? `Potwierdź usunięcie łowiska ${spot.name}`
                            : `Usuń łowisko ${spot.name}`
                        }
                        title={pendingDelete === spot.id ? 'Kliknij ponownie, aby usunąć' : 'Usuń łowisko'}
                      >
                        <IconTrash size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}

          {!adding ? (
            <button type="button" className="btn full" onClick={() => setAdding(true)}>
              <IconPlus size={17} /> Dodaj łowisko
            </button>
          ) : (
            <form className="spot-form" onSubmit={submit}>
              <div className="spot-form-head">
                <h3>Nowe łowisko</h3>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setAdding(false);
                    resetForm();
                  }}
                  aria-label="Anuluj dodawanie"
                >
                  <IconClose size={16} />
                </button>
              </div>

              <label className="field">
                <span>Nazwa</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                  placeholder="np. Staw przy leśniczówce"
                  autoComplete="off"
                  maxLength={80}
                />
              </label>

              <fieldset className="field">
                <legend>Typ akwenu</legend>
                <div className="segmented">
                  {TYPES.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      className={`segmented-btn ${type === entry.value ? 'is-active' : ''}`}
                      onClick={() => setType(entry.value)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="field">
                <span>Znajdź po nazwie</span>
                <span className="input-with-icon">
                  <IconSearch size={15} />
                  <input
                    type="text"
                    value={query}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setQuery(event.target.value);
                      setPicked(null);
                    }}
                    placeholder="np. Mielno"
                    autoComplete="off"
                  />
                </span>
              </label>

              {searching && <p className="muted">Szukam…</p>}
              {results.length > 0 && (
                <ul className="geo-results">
                  {results.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        className={
                          picked && picked.latitude === result.latitude && picked.longitude === result.longitude
                            ? 'is-picked'
                            : ''
                        }
                        onClick={() => {
                          setPicked({ latitude: result.latitude, longitude: result.longitude });
                          setCoordsInput('');
                          if (name.trim().length === 0) setName(result.name);
                        }}
                      >
                        <span>
                          {result.name}
                          {result.admin1 ? `, ${result.admin1}` : ''}
                        </span>
                        <span className="muted">
                          {result.latitude.toFixed(3)}, {result.longitude.toFixed(3)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="muted">Brak wyników w Polsce — podaj współrzędne poniżej.</p>
              )}

              <label className="field">
                <span>…albo współrzędne</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={coordsInput}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setCoordsInput(event.target.value);
                    setPicked(null);
                  }}
                  placeholder="54.1943, 16.2207"
                  autoComplete="off"
                />
              </label>

              {picked && (
                <p className="picked-info">
                  Punkt: {picked.latitude.toFixed(4)}, {picked.longitude.toFixed(4)}
                </p>
              )}
              {error && <p className="form-error">{error}</p>}

              <button type="submit" className="btn btn-primary full" disabled={saving}>
                {saving ? 'Zapisuję…' : 'Zapisz łowisko'}
              </button>
            </form>
          )}
        </div>

        {user && (
          <footer className="spot-panel-foot">
            <div className="account">
              <span className="account-name">{user.displayName}</span>
              <span className="account-email">{user.email}</span>
            </div>
            <button type="button" className="btn btn-small" onClick={onLogout}>
              Wyloguj
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
