export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-logo">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 18c1-1 2.5-3 4.5-4s4-1 6 1 3 4 4 5" />
            <path d="M14 8c1.5-1 3-1 5 0" />
            <circle cx="17" cy="5" r="1.5" />
          </svg>
          <span>Czy warto iść na ryby?</span>
        </div>
        <p>
          Dane: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0)
        </p>
        <p className="footer-disclaimer">
          Aplikacja jest narzędziem pomocniczym. Nie gwarantuje brań ryb i nie zastępuje oceny bezpieczeństwa.
        </p>
      </div>
    </footer>
  );
}
