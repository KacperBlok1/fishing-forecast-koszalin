import type { TabId } from '../types';

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'teraz', label: 'Teraz' },
  { id: 'dzis', label: 'Dziś' },
  { id: 'tydzien', label: '7 dni' },
  { id: 'dlaczego', label: 'Dlaczego?' },
];

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Widoki prognozy">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          className={`tabbar-btn ${active === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
