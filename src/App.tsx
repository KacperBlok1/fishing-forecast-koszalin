import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppStatus, Spot, SpeciesId, TabId, WeatherBundle } from './types';
import { OfflineError, fetchWeatherBundle } from './services/openMeteo';
import { readCachedBundle, writeCachedBundle } from './services/cache';
import {
  createSpotId,
  loadAllSpots,
  loadCustomSpots,
  loadLastResult,
  loadSelectedSpotId,
  loadSpeciesId,
  loadTab,
  saveCustomSpots,
  saveLastResult,
  saveSelectedSpotId,
  saveSpeciesId,
  saveTab,
} from './services/storage';
import { buildPlannerResult } from './utils/planner';
import { isoDate } from './utils/time';
import { DEFAULT_SPOTS } from './data/spots';

import TopBar from './components/TopBar';
import SpeciesBar from './components/SpeciesBar';
import TabBar from './components/TabBar';
import ScoreHero from './components/ScoreHero';
import FactorList from './components/FactorList';
import TrendCard from './components/TrendCard';
import WindowList from './components/WindowList';
import HourlyChart from './components/HourlyChart';
import DayList from './components/DayList';
import MarinePanel from './components/MarinePanel';
import WhyTab from './components/WhyTab';
import SpotPicker from './components/SpotPicker';
import StatusNotice from './components/StatusNotice';
import Footer from './components/Footer';
import { IconAlert } from './components/Icons';

function App() {
  const [spots, setSpots] = useState<Spot[]>(() => loadAllSpots());
  const [selectedId, setSelectedId] = useState<string>(() => loadSelectedSpotId());
  const [speciesId, setSpeciesId] = useState<SpeciesId>(() => loadSpeciesId());
  const [tab, setTab] = useState<TabId>(() => loadTab());
  const [pickerOpen, setPickerOpen] = useState(false);

  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [status, setStatus] = useState<AppStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  const lastSnapshot = useMemo(() => loadLastResult(), []);

  const spot = useMemo(
    () => spots.find((s) => s.id === selectedId) ?? spots[0] ?? DEFAULT_SPOTS[0],
    [spots, selectedId]
  );

  // ---------- pobieranie danych ----------

  const load = useCallback(
    async (force = false) => {
      const cached = readCachedBundle(spot.latitude, spot.longitude, spot.type);

      if (cached) {
        setBundle(cached.bundle);
        setStatus('success');
        setError(null);
      } else {
        setBundle(null);
        setStatus('loading');
      }

      if (cached?.fresh && !force) {
        setStaleNote(null);
        return;
      }

      setRefreshing(true);
      setStaleNote(null);
      try {
        const fresh = await fetchWeatherBundle(spot.latitude, spot.longitude, spot.type === 'morze');
        writeCachedBundle(spot.latitude, spot.longitude, spot.type, fresh);
        setBundle(fresh);
        setStatus('success');
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof OfflineError
            ? 'Brak połączenia z internetem.'
            : err instanceof Error
              ? err.message
              : 'Nieznany błąd pobierania danych.';
        if (cached) {
          setStaleNote(message);
        } else {
          setStatus('error');
          setError(message);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [spot]
  );

  // Pobranie danych przy starcie i przy każdej zmianie łowiska.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- stan ustawiany asynchronicznie po zakończeniu fetchu, nie w ciele efektu.
  useEffect(() => {
    load();
  }, [load]);

  // ---------- online / offline ----------

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ---------- trwałe ustawienia ----------

  useEffect(() => {
    saveSelectedSpotId(selectedId);
  }, [selectedId]);
  useEffect(() => {
    saveSpeciesId(speciesId);
  }, [speciesId]);
  useEffect(() => {
    saveTab(tab);
  }, [tab]);

  // ---------- wynik ----------

  const result = useMemo(
    () => (bundle ? buildPlannerResult(bundle, spot, speciesId) : null),
    [bundle, spot, speciesId]
  );

  useEffect(() => {
    if (!result) return;
    saveLastResult({
      spotId: result.spotId,
      spotName: result.spotName,
      speciesId: result.speciesId,
      score: result.now.score,
      label: result.now.label,
      savedAt: Date.now(),
    });
  }, [result]);

  const today = bundle ? isoDate(bundle.current.time) : null;

  const todayScores = useMemo(
    () => (result && today ? result.hourly.filter((h) => isoDate(h.time) === today) : []),
    [result, today]
  );

  const todayHours = useMemo(
    () => (bundle && today ? bundle.hours.filter((h) => isoDate(h.time) === today) : []),
    [bundle, today]
  );

  // ---------- zarządzanie łowiskami ----------

  const handleAddSpot = (draft: Omit<Spot, 'id'>) => {
    const id = createSpotId(draft.name, spots);
    const custom = loadCustomSpots();
    const next: Spot = { ...draft, id, custom: true };
    saveCustomSpots([...custom, next]);
    setSpots([...DEFAULT_SPOTS, ...custom, next]);
    setSelectedId(id);
    setPickerOpen(false);
  };

  const handleRemoveSpot = (id: string) => {
    const custom = loadCustomSpots().filter((s) => s.id !== id);
    saveCustomSpots(custom);
    const nextSpots = [...DEFAULT_SPOTS, ...custom];
    setSpots(nextSpots);
    if (selectedId === id) setSelectedId(nextSpots[0].id);
  };

  const handleSelectSpot = (next: Spot) => {
    setSelectedId(next.id);
    setPickerOpen(false);
  };

  // ---------- widok ----------

  const showSkeleton = status === 'loading' && !result;

  return (
    <div className="app">
      <TopBar
        spot={spot}
        fetchedAt={result?.fetchedAt ?? null}
        refreshing={refreshing}
        offline={offline}
        onOpenPicker={() => setPickerOpen(true)}
        onRefresh={() => load(true)}
      />

      <SpeciesBar value={speciesId} locationType={spot.type} onChange={setSpeciesId} />
      <TabBar active={tab} onChange={setTab} />

      <main className="content" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {offline && (
          <StatusNotice
            kind="offline"
            title="Jesteś offline"
            message={
              result
                ? 'Pokazuję ostatnie zapisane dane. Prognoza odświeży się, gdy wróci internet.'
                : 'Nie mam zapisanych danych dla tego łowiska. Połącz się z siecią, żeby pobrać prognozę.'
            }
            onRetry={() => load(true)}
            retryLabel="Sprawdź ponownie"
          />
        )}

        {staleNote && !offline && (
          <StatusNotice
            kind="stale"
            title="Nie udało się odświeżyć danych"
            message={`${staleNote} Pokazuję ostatnią poprawną odpowiedź z pamięci urządzenia.`}
            onRetry={() => load(true)}
          />
        )}

        {showSkeleton && (
          <div className="skeleton-wrap" aria-busy="true" aria-live="polite">
            <div className="skeleton skeleton-hero" />
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
            <p className="muted center">Pobieram prognozę dla: {spot.name}…</p>
            {lastSnapshot && (
              <p className="muted center">
                Ostatnio zapisany wynik: {lastSnapshot.spotName} — {lastSnapshot.score}/100 ({lastSnapshot.label}).
              </p>
            )}
          </div>
        )}

        {status === 'error' && !result && (
          <StatusNotice
            kind="error"
            title="Nie udało się pobrać prognozy"
            message={`${error ?? 'Nieznany błąd.'} Sprawdź połączenie i spróbuj ponownie — dane pobierane są bezpośrednio z Open-Meteo przez Twoją przeglądarkę.`}
            onRetry={() => load(true)}
          />
        )}

        {result && tab === 'teraz' && (
          <>
            <ScoreHero
              spot={spot}
              score={result.now}
              hour={result.nowHour}
              sunrise={result.today?.sunrise ?? ''}
              sunset={result.today?.sunset ?? ''}
            />

            {result.now.warnings.map((warning) => (
              <div key={warning} className="notice notice-warn">
                <IconAlert size={18} />
                <div>
                  <p>{warning}</p>
                </div>
              </div>
            ))}

            <FactorList score={result.now} />
            {spot.type === 'morze' && (
              <MarinePanel
                marine={result.marine}
                marineRequested={result.marineRequested}
                marineError={result.marineError}
              />
            )}
            <TrendCard trend={result.trend} />
          </>
        )}

        {result && tab === 'dzis' && (
          <>
            <section className="card highlight">
              <h2 className="card-title">Najlepsze dziś</h2>
              {result.today && result.today.windows.length > 0 ? (
                <p className="best-today">
                  Ocena dzisiejszego dnia: <strong>{result.today.score}/100</strong> ({result.today.label}).
                  Najlepsze okno ma <strong>{result.today.bestWindowScore}/100</strong> — celuj w{' '}
                  <strong>
                    {result.today.windows[0].start.slice(11, 16)}–{result.today.windows[0].end.slice(11, 16)}
                  </strong>
                  .
                </p>
              ) : (
                <p className="muted">Na dziś nie ma już pełnych godzin do zaplanowania — sprawdź zakładkę „7 dni”.</p>
              )}
            </section>

            <WindowList windows={result.today?.windows ?? []} />
            <HourlyChart scores={todayScores} hours={todayHours} currentTime={result.nowHour.time} />
            {spot.type === 'morze' && (
              <MarinePanel
                marine={result.marine}
                marineRequested={result.marineRequested}
                marineError={result.marineError}
              />
            )}
          </>
        )}

        {result && tab === 'tydzien' && <DayList days={result.days} today={today ?? ''} />}

        {tab === 'dlaczego' && <WhyTab />}
      </main>

      <Footer />

      {pickerOpen && (
        <SpotPicker
          spots={spots}
          selectedId={spot.id}
          onSelect={handleSelectSpot}
          onAdd={handleAddSpot}
          onRemove={handleRemoveSpot}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
