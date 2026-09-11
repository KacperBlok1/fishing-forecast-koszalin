import type { FishingLocationType, Spot } from '../types';
import { formatAge } from '../utils/time';
import { IconChevron, IconOffline, IconPin, IconRefresh } from './Icons';

interface TopBarProps {
  spot: Spot | null;
  fetchedAt: number | null;
  refreshing: boolean;
  offline: boolean;
  onOpenPanel: () => void;
  onRefresh: () => void;
}

const TYPE_LABEL: Record<FishingLocationType, string> = {
  jezioro: 'jezioro',
  rzeka: 'rzeka',
  morze: 'morze',
};

export default function TopBar({ spot, fetchedAt, refreshing, offline, onOpenPanel, onRefresh }: TopBarProps) {
  return (
    <header className="topbar">
      <button type="button" className="topbar-spot" onClick={onOpenPanel}>
        <IconPin size={17} />
        <span className="topbar-spot-text">
          <strong>{spot?.name ?? 'Wybierz łowisko'}</strong>
          <small>{spot ? TYPE_LABEL[spot.type] : 'brak zapisanych miejsc'}</small>
        </span>
        <IconChevron size={16} />
      </button>

      <div className="topbar-right">
        {offline ? (
          <span className="topbar-offline" title="Brak połączenia z serwerem">
            <IconOffline size={16} />
            offline
          </span>
        ) : (
          fetchedAt !== null && (
            <span className="topbar-age" title="Kiedy serwer pobrał te dane z Open-Meteo">
              dane: {formatAge(fetchedAt)}
            </span>
          )
        )}
        <button
          type="button"
          className={`icon-btn ${refreshing ? 'is-spinning' : ''}`}
          onClick={onRefresh}
          disabled={refreshing || !spot}
          aria-label="Odśwież prognozę"
        >
          <IconRefresh size={18} />
        </button>
      </div>
    </header>
  );
}
