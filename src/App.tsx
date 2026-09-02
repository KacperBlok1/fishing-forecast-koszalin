import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppState, LocationState, ForecastResult, CurrentWeather, ForecastHourly, HistoricalDaily, MarineData, FishingLocationType, GeoLocation } from './types';
import { fetchWeatherData, fetchTrendData, fetchMarineData } from './services/openMeteo';
import { searchCity } from './services/geocoding';
import { getCachedResult, setCachedResult, clearAllCaches } from './services/cache';
import { calculateFishingScore, filterTrendDays } from './utils/scoring';
import LoadingIntro from './components/LoadingIntro';
import HeroSection from './components/HeroSection';
import SearchControls from './components/SearchControls';
import CurrentConditions from './components/CurrentConditions';
import BestWindows from './components/BestWindows';
import TrendStrip from './components/TrendStrip';
import ScoreDetails from './components/ScoreDetails';
import ForecastChart from './components/ForecastChart';
import MethodologyAccordion from './components/MethodologyAccordion';
import Footer from './components/Footer';

const DEFAULT_LOCATION: LocationState = { name: 'Koszalin', latitude: 54.1943, longitude: 16.2207, type: 'jezioro' };

function App() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AppState['status']>('idle');
  const [location, setLocation] = useState<LocationState>(DEFAULT_LOCATION);
  const [cw, setCw] = useState<CurrentWeather | null>(null);
  const [fh, setFh] = useState<ForecastHourly | null>(null);
  const [hd, setHd] = useState<HistoricalDaily | null>(null);
  const [md, setMd] = useState<MarineData | null>(null);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<GeoLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    console.log('[loadData] START', location.name, location.latitude, location.longitude, location.type);
    setStatus('loading');
    setError(null);
    setCw(null); setFh(null); setHd(null); setMd(null); setResult(null);
    try {
      const cached = getCachedResult<ForecastResult>(location.latitude, location.longitude, location.type);
      if (cached) {
        console.log('[loadData] CACHE HIT', location.name);
        setResult(cached); setLastUpdate(new Date()); setStatus('success');
        const [w, trend, mar] = await Promise.all([
          fetchWeatherData(location.latitude, location.longitude).catch(e => { console.error('[loadData] fetchWeatherData err:', e); throw new Error('Błąd pogody: ' + e.message); }),
          fetchTrendData(location.latitude, location.longitude).catch(e => { console.error('[loadData] fetchTrendData err:', e); throw new Error('Błąd trendu: ' + e.message); }),
          location.type === 'morze' ? fetchMarineData(location.latitude, location.longitude).catch(() => ({ current: null })) : Promise.resolve({ current: null }),
        ]);
        if (w.current && w.hourly && w.daily) {
          setCw(w.current); setFh(w.hourly); setHd(filterTrendDays(trend.daily)); setMd(mar.current ? mar : null);
        }
        console.log('[loadData] CACHE HIT DONE', location.name);
        return;
      }
      console.log('[loadData] CACHE MISS', location.name);
      const [w, trend, mar] = await Promise.all([
        fetchWeatherData(location.latitude, location.longitude).catch(e => { console.error('[loadData] fetchWeatherData err:', e); throw new Error('Błąd pogody: ' + e.message); }),
        fetchTrendData(location.latitude, location.longitude).catch(e => { console.error('[loadData] fetchTrendData err:', e); throw new Error('Błąd trendu: ' + e.message); }),
        location.type === 'morze' ? fetchMarineData(location.latitude, location.longitude).catch(() => ({ current: null })) : Promise.resolve({ current: null }),
      ]);
      console.log('[loadData] API data', location.name, 'cur:', !!w?.current, 'hour:', !!w?.hourly, 'day:', !!w?.daily);
      if (w.current && w.hourly && w.daily) {
        const trendDaily = filterTrendDays(trend.daily);
        setHd(trendDaily); setCw(w.current); setFh(w.hourly);
        const marineData = mar.current ? mar : null; setMd(marineData);
        const r = calculateFishingScore(w.current, w.hourly, trendDaily, marineData, location.type);
        console.log('[loadData] score calc', location.name, 'score:', r?.score);
        setResult(r); setCachedResult(location.latitude, location.longitude, location.type, r);
        setLastUpdate(new Date()); setStatus('success');
        console.log('[loadData] SUCCESS', location.name);
      } else {
        console.error('[loadData] INVALID DATA', location.name, 'w:', JSON.stringify({cur: !!w?.current, hour: !!w?.hourly, day: !!w?.daily}));
        throw new Error('Brak danych pogodowych z API');
      }
    } catch (e: any) {
      console.error('[loadData] ERROR', location.name, e?.message || e);
      setStatus('error'); setError(e.message || 'Wystapil blad');
    }
  }, [location]);

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

  const handleSearch = async () => { if (sq.trim().length < 2) { setSr([]); return; } setSearching(true); try { setSr(await searchCity(sq)); } catch { setSr([]); } finally { setSearching(false); } };
  const selectLocation = (g: GeoLocation) => { setLocation({ name: g.name, latitude: g.latitude, longitude: g.longitude, type: location.type }); setSq(''); setSr([]); };
  const changeType = (t: FishingLocationType) => { setLocation(prev => ({ ...prev, type: t })); clearAllCaches(); };

  if (loading) return <LoadingIntro onComplete={() => setLoading(false)} />;

  return (
    <div className='app'>
      <HeroSection locationName={location.name} locationType={location.type} result={result} currentWeather={cw} />
      <div className='main-content' ref={revealRef}>
        <SearchControls locationName={location.name} locationType={location.type} onChangeLocation={(n, la, lo) => { console.log('[App] onChangeLocation', n, la, lo); setLocation({ name: n, latitude: la, longitude: lo, type: location.type }); setSq(''); setSr([]); clearAllCaches(); }} onChangeType={changeType} onRefresh={() => { console.log('[App] onRefresh'); clearAllCaches(); loadData(); }} />
        {status === 'loading' && <div className='loading-container'><div className='spinner' /><p>Ładowanie danych...</p></div>}
        {status === 'error' && <div className='error-state'><h3>Błąd ładowania</h3><p>{error}</p><button className='retry-btn' onClick={() => { clearAllCaches(); loadData(); }}>Spróbuj ponownie</button></div>}
        {status === 'success' && result && (<>
          <CurrentConditions current={cw} historical={hd} />
          <BestWindows windows={result.bestWindows} current={cw} />
          <TrendStrip historical={hd} />
          <ScoreDetails components={result.components} />
          <ForecastChart hourly={fh} current={cw} />
          <MethodologyAccordion />
          {lastUpdate && <div className='last-update'>Aktualizacja: {lastUpdate.toLocaleString('pl-PL')}</div>}
        </>)}
      </div>
      <Footer />
    </div>
  );
}

export default App;