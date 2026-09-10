import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import type { AppState, LocationState, ForecastResult, CurrentWeather, ForecastHourly, HistoricalDaily, MarineData, FishingLocationType } from './types';
import { fetchWeatherData, fetchTrendData, fetchMarineData } from './services/openMeteo';
import { getCachedResult, setCachedResult, clearAllCaches } from './services/cache';
import { calculateFishingScore, filterTrendDays } from './utils/scoring';
import LoadingIntro from './components/LoadingIntro';
import HeroSection from './components/HeroSection';
import SearchControls from './components/SearchControls';
import CurrentConditions from './components/CurrentConditions';
import BestWindows from './components/BestWindows';
import TrendStrip from './components/TrendStrip';
import ScoreDetails from './components/ScoreDetails';
import Footer from './components/Footer';

// Poniżej "linii zgięcia" strony — ładowane leniwie, żeby przyspieszyć pierwszy render.
const ForecastChart = lazy(() => import('./components/ForecastChart'));
const MethodologyAccordion = lazy(() => import('./components/MethodologyAccordion'));

const DEFAULT_LOCATION: LocationState = { name: 'Koszalin', latitude: 54.1943, longitude: 16.2207, type: 'jezioro' };

/** Pobiera pogodę, trend i (dla morza) dane morskie dla lokalizacji, z czytelnymi komunikatami błędów. */
async function fetchWeatherBundle(loc: LocationState) {
  const [w, trend, mar] = await Promise.all([
    fetchWeatherData(loc.latitude, loc.longitude).catch((e: unknown) => {
      throw new Error('Błąd pogody: ' + (e instanceof Error ? e.message : String(e)));
    }),
    fetchTrendData(loc.latitude, loc.longitude).catch((e: unknown) => {
      throw new Error('Błąd trendu: ' + (e instanceof Error ? e.message : String(e)));
    }),
    loc.type === 'morze'
      ? fetchMarineData(loc.latitude, loc.longitude).catch(() => ({ current: undefined }))
      : Promise.resolve({ current: undefined }),
  ]);
  const trendDaily = filterTrendDays(trend.daily);
  const marineData: MarineData | null = mar.current ? mar : null;
  return { w, trendDaily, marineData };
}

function App() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AppState['status']>('idle');
  const [location, setLocation] = useState<LocationState>(DEFAULT_LOCATION);
  const [cw, setCw] = useState<CurrentWeather | null>(null);
  const [fh, setFh] = useState<ForecastHourly | null>(null);
  const [hd, setHd] = useState<HistoricalDaily | null>(null);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setCw(null); setFh(null); setHd(null); setResult(null);
    try {
      const cached = getCachedResult<ForecastResult>(location.latitude, location.longitude, location.type);
      if (cached) {
        // Pokaż od razu wynik z cache, a w tle odśwież bieżące dane pogodowe.
        setResult(cached);
        setLastUpdate(new Date());
        setStatus('success');
      }

      const { w, trendDaily, marineData } = await fetchWeatherBundle(location);

      if (!w.current || !w.hourly || !w.daily) {
        if (cached) return; // mamy już wynik z cache — ciche niepowodzenie odświeżenia w tle
        throw new Error('Brak danych pogodowych z API');
      }

      setCw(w.current);
      setFh(w.hourly);
      setHd(trendDaily);

      if (!cached) {
        const r = calculateFishingScore(w.current, w.hourly, trendDaily, marineData, location.type);
        setResult(r);
        setCachedResult(location.latitude, location.longitude, location.type, r);
        setLastUpdate(new Date());
        setStatus('success');
      }
    } catch (e: unknown) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Wystąpił błąd');
    }
  }, [location]);

  // Pobranie danych przy starcie/zmianie lokalizacji — klasyczny wzorzec "fetch on mount".
  // eslint-disable-next-line react-hooks/set-state-in-effect -- efekt pobierania danych przy zmianie lokalizacji; loadData ustawia stan asynchronicznie po zakończeniu fetchu, nie synchronicznie w ciele efektu.
  useEffect(() => { loadData(); }, [loadData]);

  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }); },
      { threshold: 0.1 }
    );
    const revealElements = el.querySelectorAll('.reveal');
    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, status]);

  const changeType = (t: FishingLocationType) => { setLocation(prev => ({ ...prev, type: t })); clearAllCaches(); };

  if (loading) return <LoadingIntro onComplete={() => setLoading(false)} />;

  return (
    <div className='app'>
      <HeroSection locationName={location.name} locationType={location.type} result={result} currentWeather={cw} />
      <div className='main-content' ref={revealRef}>
        <SearchControls
          locationType={location.type}
          onChangeLocation={(n, la, lo) => { setLocation({ name: n, latitude: la, longitude: lo, type: location.type }); clearAllCaches(); }}
          onChangeType={changeType}
          onRefresh={() => { clearAllCaches(); loadData(); }}
        />
        {status === 'loading' && <div className='loading-container'><div className='spinner' /><p>Ładowanie danych...</p></div>}
        {status === 'error' && <div className='error-state'><h3>Błąd ładowania</h3><p>{error}</p><button className='retry-btn' onClick={() => { clearAllCaches(); loadData(); }}>Spróbuj ponownie</button></div>}
        {status === 'success' && result && (<>
          <CurrentConditions current={cw} />
          <BestWindows windows={result.bestWindows} />
          <TrendStrip historical={hd} />
          <ScoreDetails components={result.components} />
          <Suspense fallback={null}>
            <ForecastChart hourly={fh} current={cw} />
          </Suspense>
          <Suspense fallback={null}>
            <MethodologyAccordion />
          </Suspense>
          {lastUpdate && <div className='last-update'>Aktualizacja: {lastUpdate.toLocaleString('pl-PL')}</div>}
        </>)}
      </div>
      <Footer />
    </div>
  );
}

export default App;
