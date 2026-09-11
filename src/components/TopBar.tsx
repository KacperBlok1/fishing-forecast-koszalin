import type { Spot } from '../types';
import { formatAge } from '../utils/time';
import { IconChevron, IconOffline, IconPin, IconRefresh } from './Icons';

interface TopBarProps {
  spot: Spot;
  fetchedAt: number | null;
  refreshing: boolean;
  offline: boolean;
  onOpenPicker: () => void;
  onRefresh: () => void;
}

const TYPE_LABEL: Record<Spot['type'], string> = {
  jezioro: 'jezioro',
  rzeka: 'rzeka',
  morze: 'morze',
};

export default function TopBar({ spot, fetchedAt, refreshing, offline, onOpenPicker, onRefresh }: TopBarProps) {
  return (
    <header className="topbar">
      <button type="button" className="topbar-spot" onClick={onOpenPicker}>
        <IconPin size={17} />
        <span className="topbar-spot-text">
          <strong>{spot.name}</strong>
          <small>{TYPE_LABEL[spot.type]}</small>
        </span>
        <IconChevron size={16} />
      </button>

      <div className="topbar-right">
        {offline && (
          <span className="topbar-offline" title="Brak połączenia">
            <IconOffline size={16} />
            offline
          </span>
        )}
        {!offline && fetchedAt !== null && <span className="topbar-age">{formatAge(fetchedAt)}</span>}
        <button
          type="button"
          className={`icon-btn ${refreshing ? 'is-spinning' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Odśwież dane"
        >
          <IconRefresh size={18} />
        </button>
      </div>
    </header>
  );
}
