import { useState, useEffect, useCallback } from 'react';
import { MapPin, Search, X, ArrowRight } from 'lucide-react';
import type { FishingLocationType, GeoLocation } from '../types';

interface SearchControlsProps {
  locationName: string;
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

export default function SearchControls({ locationName, locationType, onChangeLocation, onChangeType, onRefresh }: SearchControlsProps) {
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<GeoLocation[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

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
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sq.trim())}&count=5&language=pl&format=json`);
      const data = await res.json();
      const results: GeoLocation[] = (data.results || [])
        .filter((r: any) => r.country === 'Polska')
        .map((r: any) => ({ id: r.id, name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country, admin1: r.admin1 }));
      setSr(results);
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
  };

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
            placeholder="Szukaj miasta..."
            aria-label="Szukaj miasta"
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
              <ul>
                {sr.map((g) => (
                  <li key={g.id} onClick={() => selectLocation(g)}>
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
