import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, X, ArrowRight } from 'lucide-react';
import type { FishingLocationType, GeoLocation } from '../types';
import { searchCity } from '../services/geocoding';

interface SearchControlsProps {
  locationType: FishingLocationType;
  onChangeLocation: (name: string, lat: number, lng: number) => void;
  onChangeType: (type: FishingLocationType) => void;
  onRefresh: () => void;
}

const LOCATION_TYPES: { value: FishingLocationType; label: string }[] = [
  { value: 'jezioro', label: 'Jezioro' },
  { value: 'rzeka', label: 'Rzeka' },
  { value: 'morze', label: 'Morze' },
];

export default function SearchControls({ locationType, onChangeLocation, onChangeType, onRefresh }: SearchControlsProps) {
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<GeoLocation[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [prevSr, setPrevSr] = useState(sr);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset podświetlenia listy przy każdej nowej liście wyników — zrobione w trakcie
  // renderu (a nie w useEffect), zgodnie z zaleceniem React dot. resetowania stanu
  // pochodnego, żeby uniknąć dodatkowego, zbędnego przebiegu renderowania.
  if (sr !== prevSr) {
    setPrevSr(sr);
    setActiveIndex(-1);
  }

  useEffect(() => {
    const handler = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [showDropdown]);

  const handleSearch = useCallback(async () => {
    if (sq.trim().length < 2) { setSr([]); return; }
    setSearching(true);
    try {
      setSr(await searchCity(sq));
    } catch {
      setSr([]);
    } finally {
      setSearching(false);
    }
  }, [sq]);

  useEffect(() => {
    const timer = setTimeout(() => { if (sq.trim().length >= 2) handleSearch(); else setSr([]); }, 400);
    return () => clearTimeout(timer);
  }, [sq, handleSearch]);

  const selectLocation = (g: GeoLocation) => {
    onChangeLocation(g.name, g.latitude, g.longitude);
    setSq('');
    setSr([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || sr.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % sr.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? sr.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < sr.length) {
        e.preventDefault();
        selectLocation(sr[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="search-bar">
      <div className="search-box-wrapper">
        <div className="search-box">
          <MapPin size={16} className="search-icon" />
          <input
            type="text"
            value={sq}
            onChange={(e) => { setSq(e.target.value); setShowDropdown(true); }}
            onFocus={() => sq.trim().length >= 2 && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj miasta..."
            aria-label="Szukaj miasta"
            role="combobox"
            aria-expanded={showDropdown && sr.length > 0}
            aria-controls="search-results-list"
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
            aria-autocomplete="list"
          />
          {sq && (
            <button className="search-clear" onClick={() => { setSq(''); setSr([]); setShowDropdown(false); }} aria-label="Wyczyść">
              <X size={14} />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="search-dropdown">
            {searching && <div className="searching">Wyszukiwanie...</div>}
            {!searching && sr.length > 0 && (
              <ul id="search-results-list" role="listbox" ref={listRef}>
                {sr.map((g, i) => (
                  <li
                    key={g.id}
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={i === activeIndex ? 'active' : ''}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => selectLocation(g)}
                  >
                    <ArrowRight size={14} />
                    <span>{g.name}{g.admin1 ? `, ${g.admin1}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            {!searching && sr.length === 0 && sq.trim().length >= 2 && (
              <div className="search-empty">Brak wyników w Polsce</div>
            )}
          </div>
        )}
      </div>

      <div className="search-actions">
        <div className="type-selector">
          {LOCATION_TYPES.map((t) => (
            <button
              key={t.value}
              className={`type-btn ${locationType === t.value ? 'active' : ''}`}
              onClick={() => onChangeType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button className="refresh-btn" onClick={onRefresh} aria-label="Odśwież dane">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
