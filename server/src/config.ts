/**
 * Konfiguracja serwera — wyłącznie ze zmiennych środowiskowych.
 * Brak wymaganej zmiennej kończy start z czytelnym komunikatem,
 * zamiast pozwalać aplikacji wstać w połowicznie działającym stanie.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Brak wymaganej zmiennej środowiskowej ${name}. ` +
        'Uzupełnij plik .env (wzór znajdziesz w .env.example) i uruchom kontener ponownie.'
    );
  }
  return value.trim();
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Zmienna ${name} musi być dodatnią liczbą, a jest: "${raw}".`);
  }
  return value;
}

function optionalBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

export const config = {
  /** Port wewnątrz kontenera. Na zewnątrz mapuje go docker-compose. */
  port: optionalNumber('PORT', 8090),
  host: process.env.HOST?.trim() || '0.0.0.0',

  /** postgres://user:haslo@host:5432/baza */
  databaseUrl: required('DATABASE_URL'),

  /**
   * Sekret używany jako "pieprz" przy haszowaniu tokenów sesji.
   * Jego zmiana unieważnia wszystkie sesje — nikt nie zostanie wylogowany
   * z danych, po prostu trzeba zalogować się ponownie.
   */
  sessionSecret: required('SESSION_SECRET'),

  /** Gdy false, endpoint rejestracji odrzuca nowe konta (przydatne po założeniu swoich). */
  allowRegistration: optionalBoolean('ALLOW_REGISTRATION', true),

  /** Ustaw na true dopiero, gdy aplikacja stoi za HTTPS — inaczej ciasteczko nie dojdzie. */
  cookieSecure: optionalBoolean('COOKIE_SECURE', false),

  /** Katalog ze zbudowanym frontendem (w obrazie: /srv/client). */
  clientDir: process.env.CLIENT_DIR?.trim() || '/srv/client',

  /** Jak długo odpowiedź Open-Meteo uznajemy za świeżą. */
  weatherFreshMs: optionalNumber('WEATHER_FRESH_MINUTES', 15) * 60_000,

  /** Jak długo trzymamy nieświeżą odpowiedź jako awaryjną, gdy API nie odpowiada. */
  weatherStaleMs: optionalNumber('WEATHER_STALE_HOURS', 24) * 3_600_000,

  /** Ile dni ważna jest sesja. */
  sessionDays: optionalNumber('SESSION_DAYS', 90),

  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
} as const;

export type AppConfig = typeof config;
