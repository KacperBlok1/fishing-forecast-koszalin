export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer-attribution">
        Dane pogodowe:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Open-Meteo
        </a>{' '}
        (Forecast, Marine i Geocoding API) — licencja{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>
        .
      </p>
      <p className="footer-disclaimer">
        Ocena jest wskazówką, nie gwarancją brań. Przed wyjazdem sprawdź ostrzeżenia pogodowe, bezpieczeństwo nad wodą
        oraz regulamin i okresy ochronne w swoim okręgu.
      </p>
      <p className="footer-privacy">
        Aplikacja działa bez konta i bez serwera. Ustawienia i ostatnie wyniki zostają w pamięci tej przeglądarki.
      </p>
    </footer>
  );
}
