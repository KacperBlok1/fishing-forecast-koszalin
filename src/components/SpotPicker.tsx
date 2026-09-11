import { useEffect, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { FishingLocationType, GeoLocation, Spot } from '../types';
import { parseCoordinates, searchPlace } from '../services/geocoding';
import { IconClose, IconPin, IconPlus, IconSearch, IconTrash } from './Icons';

interface SpotPickerProps {
  spots: Spot[];
  selectedId: string;
  onSelect: (spot: Spot) => void;
  onAdd: (spot: Omit<Spot, 'id'>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
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

export default function SpotPicker({ spots, selectedId, onSelect, onAdd, onRemove, onClose }: SpotPickerProps) {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [name, setName] = useState('');
  const [type, setType] = useState<FishingLocationType>('jezioro');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [coordsInput, setCoordsInput] = useState('');
  const [picked, setPicked] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const timer = setTimeout(() => {
      searchPlace(query)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSubmit = () => {
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

    onAdd({
      name: trimmedName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      type,
      custom: true,
    });
    setMode('list');
    setName('');
    setQuery('');
    setResults([]);
    setCoordsInput('');
    setPicked(null);
  };

  const grouped = TYPES.map((t) => ({
    type: t.value,
    items: spots.filter((spot) => spot.type === t.value),
  }));

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Wybór łowiska"
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{mode === 'list' ? 'Twoje łowiska' : 'Nowe łowisko'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Zamknij">
            <IconClose size={20} />
          </button>
        </header>

        {mode === 'list' && (
          <div className="modal-body">
            {grouped.map((group) => (
              <div key={group.type} className="spot-group">
                <h3>{GROUP_TITLES[group.type]}</h3>
                <ul className="spot-list">
                  {group.items.map((spot) => (
                    <li key={spot.id} className={spot.id === selectedId ? 'is-selected' : ''}>
                      <button type="button" className="spot-btn" onClick={() => onSelect(spot)}>
                        <IconPin size={16} />
                        <span className="spot-name">{spot.name}</span>
                        <span className="spot-note">
                          {spot.note ?? `${spot.latitude.toFixed(3)}, ${spot.longitude.toFixed(3)}`}
                        </span>
                      </button>
                      {spot.custom && (
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => onRemove(spot.id)}
                          aria-label={`Usuń łowisko ${spot.name}`}
                        >
                          <IconTrash size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                  {group.items.length === 0 && <li className="muted spot-empty">Brak zapisanych miejsc.</li>}
                </ul>
              </div>
            ))}

            <button type="button" className="btn btn-primary full" onClick={() => setMode('add')}>
              <IconPlus size={18} /> Dodaj własne łowisko
            </button>
          </div>
        )}

        {mode === 'add' && (
          <div className="modal-body">
            <label className="field">
              <span>Nazwa łowiska</span>
              <input
                type="text"
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                placeholder="np. Staw przy leśniczówce"
                autoComplete="off"
              />
            </label>

            <fieldset className="field">
              <legend>Typ akwenu</legend>
              <div className="segmented">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`segmented-btn ${type === t.value ? 'is-active' : ''}`}
                    onClick={() => setType(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>Znajdź po nazwie miejscowości</span>
              <span className="input-with-icon">
                <IconSearch size={16} />
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
                      {result.name}
                      {result.admin1 ? `, ${result.admin1}` : ''}
                      <span className="muted">
                        {result.latitude.toFixed(3)}, {result.longitude.toFixed(3)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="muted">Brak wyników w Polsce — możesz podać współrzędne poniżej.</p>
            )}

            <label className="field">
              <span>…albo wpisz współrzędne</span>
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
                Wybrany punkt: {picked.latitude.toFixed(4)}, {picked.longitude.toFixed(4)}
              </p>
            )}
            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setMode('list')}>
                Wróć
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                Zapisz łowisko
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
