import { SPECIES } from '../data/species';
import { MAX_WINDOW_HOURS } from '../utils/planner';
import {
  MARINE_WEIGHT,
  RATING_THRESHOLDS,
  SPECIES_DELTA_LIMIT,
  WAVE_THRESHOLDS,
  WEIGHTS,
  WINDOW_MIN_SCORE,
  WIND_THRESHOLDS,
} from '../utils/scoring';
import { FORECAST_DAYS, PAST_DAYS } from '../services/weather';

const FACTOR_DESCRIPTIONS: { key: keyof typeof WEIGHTS; label: string; text: string }[] = [
  {
    key: 'wind',
    label: 'Wiatr',
    text: 'Zupełna cisza dostaje mniej punktów niż lekka fala — falowanie dotlenia wodę i maskuje żyłkę. Silny wiatr obniża wynik, a porywistość (porywy ponad 1,7× średniej prędkości) odejmuje dodatkowe punkty. Progi zależą od akwenu.',
  },
  {
    key: 'pressure',
    label: 'Ciśnienie',
    text: 'Sześćdziesiąt procent oceny to sam poziom ciśnienia, czterdzieści procent to zmiana z ostatnich 24 godzin. Łagodny spadek jest premiowany, skok większy niż 8 hPa na dobę jest karany.',
  },
  {
    key: 'temperature',
    label: 'Temperatura',
    text: 'Sześćdziesiąt procent to poziom temperatury powietrza, czterdzieści procent to odchylenie od średniej z trzech poprzednich dni. Gwałtowna zmiana obniża ocenę nawet przy "ładnej" pogodzie.',
  },
  {
    key: 'light',
    label: 'Pora dnia',
    text: 'Liczona względem realnego wschodu i zachodu słońca dla danego dnia i miejsca, a nie sztywnych godzin. Godzina wokół świtu i zmierzchu dostaje najwyższą notę.',
  },
  {
    key: 'precipitation',
    label: 'Opady',
    text: 'Mżawka bywa lepsza od zupełnie suchej pogody, silny deszcz obniża wynik. Kod pogody 95–99 (burza) przycina ocenę opadów niezależnie od sumy mm.',
  },
  {
    key: 'cloud',
    label: 'Zachmurzenie',
    text: 'Najwyżej oceniane jest zachmurzenie 30–75 %: rozproszone światło wydłuża żerowanie drapieżników.',
  },
  {
    key: 'moon',
    label: 'Faza księżyca',
    text: 'Nów i pełnia dostają premię, kwadry są neutralne. Fazę liczymy lokalnie z długości miesiąca synodycznego — Open-Meteo jej nie udostępnia. Waga jest celowo mała.',
  },
  {
    key: 'stability',
    label: 'Stabilność pogody',
    text: 'Rozrzut ciśnienia i prędkości wiatru w oknie ±12 godzin. Rozchwiana pogoda obniża wynik nawet wtedy, gdy wartości chwilowe wyglądają dobrze.',
  },
];

/** Zakładka "Dlaczego?" — pełny, jawny opis algorytmu i jego ograniczeń. */
export default function WhyTab() {
  const weightRows = FACTOR_DESCRIPTIONS.map((factor) => ({
    ...factor,
    weight: WEIGHTS[factor.key],
  }));

  return (
    <div className="why">
      <section className="card">
        <h2 className="card-title">Jak powstaje ocena</h2>
        <p>
          Wynik jest w pełni deterministyczny: te same dane wejściowe zawsze dają ten sam wynik. Nie ma tu modelu
          uczonego, backendu ani bazy danych — cała arytmetyka dzieje się w Twojej przeglądarce.
        </p>
        <ol className="steps">
          <li>
            Dla każdej godziny liczymy osiem ocen cząstkowych w skali 0–100 (wiatr, ciśnienie, temperatura, pora dnia,
            opady, zachmurzenie, księżyc, stabilność).
          </li>
          <li>
            Składamy je jako <strong>średnią ważoną</strong> — wagi poniżej sumują się do 100. Dla łowisk morskich
            dochodzi komponent fali o wadze {MARINE_WEIGHT}, a suma wag jest normalizowana.
          </li>
          <li>
            Do wyniku bazowego dodajemy <strong>korektę gatunkową</strong> — zestaw prostych reguł, ograniczony do
            ±{SPECIES_DELTA_LIMIT} punktów.
          </li>
          <li>Wynik przycinamy do zakresu 0–100 i zamieniamy na etykietę.</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="card-title">Wagi czynników</h2>
        <ul className="weight-list">
          {weightRows.map((row) => (
            <li key={row.key}>
              <div className="weight-head">
                <span className="weight-label">{row.label}</span>
                <span className="weight-value">{row.weight}</span>
              </div>
              <div className="weight-bar" aria-hidden="true">
                <span style={{ width: `${row.weight}%` }} />
              </div>
              <p>{row.text}</p>
            </li>
          ))}
          <li className="is-marine">
            <div className="weight-head">
              <span className="weight-label">Fala (tylko morze)</span>
              <span className="weight-value">{MARINE_WEIGHT}</span>
            </div>
            <div className="weight-bar" aria-hidden="true">
              <span style={{ width: `${MARINE_WEIGHT}%` }} />
            </div>
            <p>
              Dokładana wyłącznie wtedy, gdy Marine API zwróciło wysokość fali. Progi: do {WAVE_THRESHOLDS.calm} m
              bardzo dobrze, do {WAVE_THRESHOLDS.moderate} m akceptowalnie, powyżej {WAVE_THRESHOLDS.severe} m
              warunki sztormowe. Gdy danych nie ma — nie zmyślamy ich, tylko pokazujemy komunikat.
            </p>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">Etykiety i okna czasowe</h2>
        <ul className="legend-list">
          <li>
            <span className="rate-badge small rate-słabo">słabo</span> 0–{RATING_THRESHOLDS.srednio - 1} punktów
          </li>
          <li>
            <span className="rate-badge small rate-średnio">średnio</span> {RATING_THRESHOLDS.srednio}–
            {RATING_THRESHOLDS.dobrze - 1}
          </li>
          <li>
            <span className="rate-badge small rate-dobrze">dobrze</span> {RATING_THRESHOLDS.dobrze}–
            {RATING_THRESHOLDS.bardzoDobrze - 1}
          </li>
          <li>
            <span className="rate-badge small rate-bardzo-dobrze">bardzo dobrze</span> {RATING_THRESHOLDS.bardzoDobrze}
            –100
          </li>
        </ul>
        <p>
          <strong>Okno połowowe</strong> to co najmniej dwie następujące po sobie godziny z wynikiem minimum{' '}
          {WINDOW_MIN_SCORE}. Dłuższe serie dzielimy na fragmenty po maksymalnie {MAX_WINDOW_HOURS} godziny —
          „od 18:00 do północy” nie jest praktyczną wskazówką. Jeśli żadna godzina nie przekracza progu, pokazujemy
          najlepsze dostępne okno dwugodzinne, żeby zawsze było wiadomo, kiedy jest najmniej źle. Ocena dnia w
          zakładce „7 dni” to <strong>65 % wyniku najlepszego okna + 35 % średniej z godzin dziennych</strong> —
          sam najlepszy wynik godzinowy byłby mylący, bo prawie każdy dzień ma jedną dobrą godzinę o świcie.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Progi wiatru dla akwenów</h2>
        <div className="table-wrap">
          <table className="why-table">
            <thead>
              <tr>
                <th scope="col">Akwen</th>
                <th scope="col">Cisza</th>
                <th scope="col">Optimum</th>
                <th scope="col">Silny</th>
                <th scope="col">Bardzo silny</th>
              </tr>
            </thead>
            <tbody>
              {(['jezioro', 'rzeka', 'morze'] as const).map((type) => {
                const t = WIND_THRESHOLDS[type];
                return (
                  <tr key={type}>
                    <th scope="row">{type}</th>
                    <td className="num">≤ {t.calm}</td>
                    <td className="num">
                      {t.optimalFrom}–{t.optimalTo}
                    </td>
                    <td className="num">{t.strong}</td>
                    <td className="num">{t.severe}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fineprint">Wartości w km/h, prędkość wiatru na wysokości 10 m.</p>
      </section>

      <section className="card">
        <h2 className="card-title">Reguły gatunkowe</h2>
        <p>
          Każdy gatunek ma ten sam zestaw sześciu reguł: dopasowanie akwenu, zakres temperatury, preferencja świetlna,
          stosunek do wiatru, wrażliwość na skoki ciśnienia i premia za zachmurzenie. Każda reguła dokłada lub odejmuje
          stałą liczbę punktów i zostawia po sobie zdanie wyjaśnienia widoczne w zakładce „Teraz”.
        </p>
        <div className="table-wrap">
          <table className="why-table">
            <thead>
              <tr>
                <th scope="col">Gatunek</th>
                <th scope="col">Akweny</th>
                <th scope="col">Temperatura</th>
                <th scope="col">Światło</th>
                <th scope="col">Wiatr</th>
              </tr>
            </thead>
            <tbody>
              {SPECIES.map((species) => (
                <tr key={species.id}>
                  <th scope="row">
                    {species.icon} {species.name}
                  </th>
                  <td>{species.habitats.join(', ')}</td>
                  <td className="num">
                    {species.temperatureRange[0]}–{species.temperatureRange[1]} °C
                  </td>
                  <td>{species.light}</td>
                  <td>{species.wind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Skąd biorą się dane</h2>
        <ul className="source-list">
          <li>
            <strong>Open-Meteo Forecast API</strong> — pogoda bieżąca, godzinowa i dzienna, {PAST_DAYS} dni wstecz i{' '}
            {FORECAST_DAYS} dni prognozy, w strefie czasowej łowiska.
          </li>
          <li>
            <strong>Open-Meteo Marine API</strong> — wysokość, kierunek i okres fali oraz temperatura wody. Odpytywane
            wyłącznie dla łowisk oznaczonych jako „morze”.
          </li>
          <li>
            <strong>Open-Meteo Geocoding API</strong> — wyszukiwanie miejscowości przy dodawaniu własnego łowiska.
          </li>
          <li>
            <strong>Obliczenia lokalne</strong> — faza księżyca (z długości miesiąca synodycznego) i cała punktacja,
            wykonywane w Twojej przeglądarce.
          </li>
        </ul>
        <p className="fineprint">
          Do Open-Meteo odpytuje serwer aplikacji, nie Twoja przeglądarka. Odpowiedzi trafiają do cache w bazie, więc
          telefon i komputer dzielą jedno zapytanie na łowisko na kwadrans, a aplikacja działa również wtedy, gdy
          urządzenie ma dostęp tylko do serwera w sieci lokalnej. Łowiska i ustawienia są zapisane przy Twoim koncie
          — nie opuszczają Twojego serwera.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Ograniczenia — czytaj to</h2>
        <ul className="limits">
          <li>
            To prognoza pogody przełożona na punkty, a nie przewidywanie brań. Żaden model nie wie, czy ryba ma dziś
            ochotę.
          </li>
          <li>
            Model pogodowy interpoluje dane do siatki o boku kilku kilometrów. Nad małym, osłoniętym stawem wiatr może
            być zupełnie inny niż w prognozie.
          </li>
          <li>
            Algorytm nie zna przejrzystości i poziomu wody, temperatury wody w jeziorze, presji wędkarskiej, zarybień
            ani tego, co dzieje się pod powierzchnią.
          </li>
          <li>Im dalszy dzień prognozy, tym większy błąd. Siódmy dzień traktuj jako orientacyjny.</li>
          <li>
            Reguły gatunkowe to uproszczone heurystyki oparte na wędkarskiej praktyce, a nie na badaniach
            ichtiologicznych.
          </li>
          <li>
            Dane morskie to prognoza modelu falowego, nie pomiar z boi. Przed wejściem na falochron zawsze sprawdź
            warunki i ostrzeżenia IMGW.
          </li>
          <li>
            Aplikacja nie zna okresów ochronnych ani wymiarów obowiązujących w Twoim okręgu — sprawdź regulamin przed
            wyjazdem.
          </li>
        </ul>
      </section>
    </div>
  );
}
