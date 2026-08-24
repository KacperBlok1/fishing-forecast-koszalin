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
    setStatus('loading'); setError(null);
    try {
      const cached = getCachedResult<ForecastResult>(location.latitude, location.longitude, location.type);
      if (cached) {
        setResult(cached); setLastUpdate(new Date()); setStatus('success');
        // Cache nie zawiera danych pogodowych â€” wciÄ…ĹĽ trzeba je zaĹ‚adowaÄ‡ dla podkomponentĂłw
        const [w, trend, mar] = await Promise.all([
          fetchWeatherData(location.latitude, location.longitude).catch(e => { throw new Error('BĹ‚Ä…d pogody: ' + e.message); }),
          fetchTrendData(location.latitude, location.longitude).catch(e => { throw new Error('BĹ‚Ä…d trendu: ' + e.message); }),
          location.type === 'morze' ? fetchMarineData(location.latitude, location.longitude).catch(() => ({ current: null })) : Promise.resolve({ current: null }),
        ]);
        if (w.current && w.hourly && w.daily) {
          setCw(w.current);
          setFh(w.hourly);
          setHd(filterTrendDays(trend.daily));
        }
        return;
      }
      const [w, trend, mar] = await Promise.all([
        fetchWeatherData(location.latitude, location.longitude).catch(e => { throw new Error('BĹ‚ad pogody: ' + e.message); }),
        fetchTrendData(location.latitude, location.longitude).catch(e => { throw new Error('BĹ‚ad trendu: ' + e.message); }),
        location.type === 'morze' ? fetchMarineData(location.latitude, location.longitude).catch(() => ({ current: null })) : Promise.resolve({ current: null }),
      ]);
      if (w.current && w.hourly && w.daily) {
        const trendDaily = filterTrendDays(trend.daily);
        const weatherDailyFiltered = filterTrendDays(w.daily);
        setHd(trendDaily);
        const r = calculateFishingScore(w.current, w.hourly, trendDaily, mar.current ? mar : null, location.type);
        setResult(r); setCachedResult(location.latitude, location.longitude, location.type, r);
        setLastUpdate(new Date()); setStatus('success');
      } else { throw new Error('Brak danych pogodowych.'); }
    } catch (e: any) { setStatus('error'); setError(e.message || 'WystapiĹ‚ blad.'); }
  }, [location]);

  useEffect(() => { loadData(); }, [loadData]);

  // Activate all .reveal elements with IntersectionObserver
  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    const revealElements = el.querySelectorAll('.reveal');
    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  const handleSearch = async () => {
    if (sq.trim().length < 2) { setSr([]); return; }
    setSearching(true); try { setSr(await searchCity(sq)); } catch { setSr([]); } finally { setSearching(false); }
  };
  const selectLocation = (g: GeoLocation) => {
    setLocation({ name: g.name, latitude: g.latitude, longitude: g.longitude, type: location.type });
    setSq(''); setSr([]);
  };
  const changeType = (t: FishingLocationType) => {
    setLocation(prev => ({ ...prev, type: t }));
    clearAllCaches();
  };


  if (loading) return <LoadingIntro onComplete={() => setLoading(false)} />;

  return (
    <div className='app'>
      <HeroSection locationName={location.name} locationType={location.type} result={result} currentWeather={cw} />
      <div className='main-content' ref={revealRef}>
        <SearchControls locationName={location.name} locationType={location.type} onChangeLocation={(name, lat, lng) => { setLocation({ name, latitude: lat, longitude: lng, type: location.type }); setSq(''); setSr([]); clearAllCaches(); }} onChangeType={changeType} onRefresh={() => { clearAllCaches(); loadData(); }} />
        {status === 'loading' && <div className='loading-container'><div className='spinner' /><p>Ĺadowanie danych...</p></div>}
        {status === 'error' && <div className='error-state'><h3>BĹ‚ad Ĺ‚adowania danych</h3><p>{error}</p><button className='retry-btn' onClick={() => { clearAllCaches(); loadData(); }}>SprĂłbuj ponownie</button></div>}
        {status === 'success' && result && (<>
          <CurrentConditions current={cw} historical={hd} />
          <BestWindows windows={result.bestWindows} current={cw} />
          <TrendStrip historical={hd} />
          <ScoreDetails components={result.components} />
          <ForecastChart hourly={fh} />
          <MethodologyAccordion />
          {lastUpdate && <div className='last-update'>Aktualizacja: {lastUpdate.toLocaleString('pl-PL')}</div>}
        </>)}
      </div>
      <Footer />
    </div>
  );
}

export default App;
