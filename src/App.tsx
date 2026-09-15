import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spot, SpeciesId, TabId, WeatherBundle } from './types';
import type { RemotePrefs, SpotInput } from './api';
import { ApiError, prefsApi, spotsApi } from './api';
import { fetchWeatherBundle } from './services/weather';
import {
  cacheBundle,
  cachePrefs,
  cacheSpots,
  cachedBundle,
  cachedPrefs,
  cachedSpots,
} from './services/storage';
import { useSession } from './hooks/useSession';
import { buildPlannerResult } from './utils/planner';
import { isoDate } from './utils/time';

import AuthScreen from './components/AuthScreen';
import SpotPanel from './components/SpotPanel';
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
import StatusNotice from './components/StatusNotice';
import Footer from './components/Footer';
import { IconAlert } from './components/Icons';

/** Po tym czasie od pobrania danych powrót do karty wywołuje odświeżenie. */
const REFRESH_AFTER_MS = 10 * 60 * 1000;

function App() {
  const session = useSession();

  // ---------------------------------------------------------------- stan danych

  const [spots, setSpots] = useState<Spot[]>(() => cachedSpots());
  const [prefs, setPrefs] = useState<RemotePrefs>(
    () => cachedPrefs() ?? { species: 'szczupak', selectedSpotId: null, activeTab: 'teraz' }
  );
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  /** Kiedy ostatnio pobraliśmy prognozę. Nic tego nie renderuje, więc ref, nie stan. */
  const bundleSavedAt = useRef<number | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  const pendingPrefs = useRef<Partial<RemotePrefs>>({});
  const prefsTimer = useRef<number | null>(null);

  const selectedSpot = useMemo(() => {
    if (spots.length === 0) return null;
    return spots.find((spot) => spot.id === prefs.selectedSpotId) ?? spots[0];
  }, [spots, prefs.selectedSpotId]);

  // ---------------------------------------------------------------- ustawienia

  /**
   * Zmiany ustawień zapisujemy z opóźnieniem — przeklikanie czterech gatunków
   * pod rząd ma wysłać jedno żądanie, nie cztery.
   */
  const queuePrefs = useCallback((patch: Partial<RemotePrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      cachePrefs(next);
      return next;
    });
    pendingPrefs.current = { ...pendingPrefs.current, ...patch };
    if (prefsTimer.current !== null) window.clearTimeout(prefsTimer.current);
    prefsTimer.current = window.setTimeout(() => {
      const payload = pendingPrefs.current;
      pendingPrefs.current = {};
      prefsTimer.current = null;
      void prefsApi.save(payload).catch(() => {
        // Ustawienia to nie dane krytyczne — przy braku sieci zostają lokalnie.
      });
    }, 600);
  }, []);

  // ---------------------------------------------------------------- łowiska i ustawienia z serwera

  const loadAccountData = useCallback(async (): Promise<void> => {
    setLoadingSpots(true);
    try {
      const [serverSpots, serverPrefs] = await Promise.all([spotsApi.list(), prefsApi.get()]);
      setSpots(serverSpots);
      cacheSpots(serverSpots);
      setPrefs((current) => {
        // Lokalne zmiany, które jeszcze nie doleciały na serwer, mają pierwszeństwo.
        const merged = { ...serverPrefs, ...pendingPrefs.current };
        const next = merged.selectedSpotId ? merged : { ...merged, selectedSpotId: current.selectedSpotId };
        cachePrefs(next);
        return next;
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.isUnauthorized) {
        await session.recheck();
      }
      // Przy błędzie sieci zostajemy na lokalnym lustrze — nie czyścimy listy.
    } finally {
      setLoadingSpots(false);
    }
    // Zależność to sama funkcja recheck (stabilna), a nie cały obiekt sesji.
  }, [session.recheck]);

  useEffect(() => {
    if (session.status !== 'authenticated') return;
    void loadAccountData();
  }, [session.status, loadAccountData]);

  // ---------------------------------------------------------------- pogoda

  const loadWeather = useCallback(
    async (spot: Spot, species: SpeciesId, force = false): Promise<void> => {
      const local = cachedBundle(spot.id, species);
      if (local) {
        setBundle(local.bundle);
        bundleSavedAt.current = local.savedAt;
        setWeatherError(null);
      } else {
        setBundle(null);
        bundleSavedAt.current = null;
      }

      setLoadingWeather(true);
      setStaleNote(null);
      try {
        const fresh = await fetchWeatherBundle(spot, force);
        setBundle(fresh);
        bundleSavedAt.current = Date.now();
        cacheBundle(spot.id, species, fresh);
        setWeatherError(null);
        setStaleNote(
          fresh.stale
            ? 'Open-Meteo chwilowo nie odpowiada — serwer pokazuje ostatnią poprawną prognozę.'
            : null
        );
      } catch (error: unknown) {
        const message =
          error instanceof ApiError ? error.message : 'Nie udało się pobrać prognozy z serwera.';
        if (error instanceof ApiError && error.isUnauthorized) {
          await session.recheck();
          return;
        }
        if (local) {
          setStaleNote(`${message} Pokazuję ostatnie dane zapisane na tym urządzeniu.`);
        } else {
          setWeatherError(message);
        }
      } finally {
        setLoadingWeather(false);
      }
    },
    [session.recheck]
  );

  // Kluczem są dane łowiska, które realnie wpływają na zapytanie (identyfikator
  // i typ akwenu), a nie tożsamość obiektu: po odświeżeniu listy z serwera
  // dostajemy nowe obiekty o tej samej treści i nie ma powodu pobierać
  // ponownie tej samej prognozy.
  const selectedSpotKey = selectedSpot ? `${selectedSpot.id}:${selectedSpot.type}` : null;

  useEffect(() => {
    if (session.status !== 'authenticated' || !selectedSpot) return;
    void loadWeather(selectedSpot, prefs.species);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zależymy od treści łowiska, nie od tożsamości obiektu
  }, [session.status, selectedSpotKey, prefs.species, loadWeather]);

  // ---------------------------------------------------------------- synchronizacja między urządzeniami

  /**
   * Powrót do karty odświeża listę łowisk i ustawienia. To dzięki temu miejsce
   * dodane na telefonie pojawia się na komputerze bez przeładowania strony.
   */
  const refreshOnFocus = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    if (session.status !== 'authenticated') return;
    void loadAccountData();
    const savedAt = bundleSavedAt.current;
    if (selectedSpot && (savedAt === null || Date.now() - savedAt > REFRESH_AFTER_MS)) {
      void loadWeather(selectedSpot, prefs.species);
    }
  }, [session.status, loadAccountData, selectedSpot, prefs.species, loadWeather]);

  useEffect(() => {
    document.addEventListener('visibilitychange', refreshOnFocus);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [refreshOnFocus]);

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      refreshOnFocus();
    };
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshOnFocus]);

  // ---------------------------------------------------------------- operacje na łowiskach

  const handleCreateSpot = useCallback(
    async (input: SpotInput): Promise<void> => {
      const created = await spotsApi.create(input);
      setSpots((current) => {
        const next = [...current, created];
        cacheSpots(next);
        return next;
      });
      queuePrefs({ selectedSpotId: created.id });
      setPanelOpen(false);
    },
    [queuePrefs]
  );

  const handleDeleteSpot = useCallback(
    async (spot: Spot): Promise<void> => {
      await spotsApi.remove(spot.id);
      setSpots((current) => {
        const next = current.filter((item) => item.id !== spot.id);
        cacheSpots(next);
        if (prefs.selectedSpotId === spot.id) {
          queuePrefs({ selectedSpotId: next[0]?.id ?? null });
        }
        return next;
      });
    },
    [prefs.selectedSpotId, queuePrefs]
  );

  const handleSelectSpot = useCallback(
    (spot: Spot) => {
      queuePrefs({ selectedSpotId: spot.id });
      setPanelOpen(false);
    },
    [queuePrefs]
  );

  // ---------------------------------------------------------------- wynik

  const result = useMemo(
    () => (bundle && selectedSpot ? buildPlannerResult(bundle, selectedSpot, prefs.species) : null),
    [bundle, selectedSpot, prefs.species]
  );

  const today = bundle ? isoDate(bundle.current.time) : null;

  const todayScores = useMemo(
    () => (result && today ? result.hourly.filter((hour) => isoDate(hour.time) === today) : []),
    [result, today]
  );

  const todayHours = useMemo(
    () => (bundle && today ? bundle.hours.filter((hour) => isoDate(hour.time) === today) : []),
    [bundle, today]
  );

  // ---------------------------------------------------------------- render

  if (session.status === 'checking') {
    return (
      <div className="boot">
        <div className="boot-spinner" aria-hidden="true" />
        <p>Sprawdzam sesję…</p>
      </div>
    );
  }

  if (session.status === 'guest' || !session.user) {
    return <AuthScreen onAuthenticated={session.signIn} />;
  }

  const tab = prefs.activeTab;
  const showSkeleton = loadingWeather && !result;

  return (
    <div className="shell">
      <SpotPanel
        spots={spots}
        selectedId={selectedSpot?.id ?? null}
        user={session.user}
        open={panelOpen}
        busy={loadingSpots}
        onClose={() => setPanelOpen(false)}
        onSelect={handleSelectSpot}
        onCreate={handleCreateSpot}
        onDelete={handleDeleteSpot}
        onLogout={() => void session.signOut()}
      />

      <div className="main">
        <TopBar
          spot={selectedSpot}
          fetchedAt={result?.fetchedAt ?? null}
          refreshing={loadingWeather}
          offline={offline || session.offlineIdentity}
          onOpenPanel={() => setPanelOpen(true)}
          onRefresh={() => {
            if (selectedSpot) void loadWeather(selectedSpot, prefs.species, true);
          }}
        />

        <SpeciesBar
          value={prefs.species}
          locationType={selectedSpot?.type ?? 'jezioro'}
          onChange={(species) => queuePrefs({ species })}
        />

        <TabBar active={tab} onChange={(next: TabId) => queuePrefs({ activeTab: next })} />

        <main className="content" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {(offline || session.offlineIdentity) && (
            <StatusNotice
              kind="offline"
              title={session.offlineIdentity ? 'Brak kontaktu z serwerem' : 'Jesteś offline'}
              message={
                result
                  ? 'Pokazuję dane zapisane na tym urządzeniu. Dodawanie i usuwanie łowisk wróci razem z połączeniem.'
                  : 'Nie mam zapisanych danych dla tego łowiska. Połącz się z siecią serwera, żeby pobrać prognozę.'
              }
              onRetry={() => void session.recheck()}
              retryLabel="Sprawdź ponownie"
            />
          )}

          {staleNote && !offline && (
            <StatusNotice
              kind="stale"
              title="Dane mogą być nieaktualne"
              message={staleNote}
              onRetry={() => {
                if (selectedSpot) void loadWeather(selectedSpot, prefs.species, true);
              }}
            />
          )}

          {spots.length === 0 && !loadingSpots && (
            <StatusNotice
              kind="info"
              title="Nie masz jeszcze łowisk"
              message="Dodaj pierwsze miejsce — po nazwie miejscowości albo po współrzędnych. Będzie dostępne na każdym urządzeniu, na którym się zalogujesz."
              onRetry={() => setPanelOpen(true)}
              retryLabel="Dodaj łowisko"
            />
          )}

          {showSkeleton && (
            <div className="skeleton-wrap" aria-busy="true" aria-live="polite">
              <div className="skeleton skeleton-hero" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <p className="muted center">Pobieram prognozę{selectedSpot ? ` dla: ${selectedSpot.name}` : ''}…</p>
            </div>
          )}

          {weatherError && !result && (
            <StatusNotice
              kind="error"
              title="Nie udało się pobrać prognozy"
              message={weatherError}
              onRetry={() => {
                if (selectedSpot) void loadWeather(selectedSpot, prefs.species, true);
              }}
            />
          )}

          {result && selectedSpot && tab === 'teraz' && (
            <>
              <ScoreHero
                spot={selectedSpot}
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

              <div className="grid-2">
                <FactorList score={result.now} />
                <div className="grid-stack">
                  {selectedSpot.type === 'morze' && (
                    <MarinePanel
                      marine={result.marine}
                      marineRequested={result.marineRequested}
                      marineError={result.marineError}
                    />
                  )}
                  <TrendCard trend={result.trend} />
                  <WindowList
                    windows={result.today?.windows ?? []}
                    title="Najbliższe okna"
                    emptyText="Na dziś nie ma już pełnych godzin do zaplanowania."
                  />
                </div>
              </div>
            </>
          )}

          {result && selectedSpot && tab === 'dzis' && (
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
                  <p className="muted">
                    Na dziś nie ma już pełnych godzin do zaplanowania — sprawdź zakładkę „7 dni”.
                  </p>
                )}
              </section>

              <div className="grid-2">
                <WindowList windows={result.today?.windows ?? []} />
                {selectedSpot.type === 'morze' ? (
                  <MarinePanel
                    marine={result.marine}
                    marineRequested={result.marineRequested}
                    marineError={result.marineError}
                  />
                ) : (
                  <TrendCard trend={result.trend} />
                )}
              </div>

              <HourlyChart scores={todayScores} hours={todayHours} currentTime={result.nowHour.time} />
            </>
          )}

          {result && tab === 'tydzien' && <DayList days={result.days} today={today ?? ''} />}

          {tab === 'dlaczego' && <WhyTab />}
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default App;
