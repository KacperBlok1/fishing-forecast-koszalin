import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ApiError, authApi } from '../api';
import type { ServerConfig, User } from '../api';
import { IconAlert } from './Icons';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

type Mode = 'login' | 'register';

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .config()
      .then((cfg) => {
        if (cancelled) return;
        setServerConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setServerConfig({ allowRegistration: true, minPasswordLength: 10 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const minLength = serverConfig?.minPasswordLength ?? 10;
  const registrationOpen = serverConfig?.allowRegistration ?? true;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await authApi.login(email, password)
          : await authApi.register(email, password, displayName);
      onAuthenticated(user);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się połączyć z serwerem.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-brand">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M3 14c3-4 7-6 11-6 3 0 5 2 6 3-1 1-3 3-6 3-4 0-8-2-11-6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="10" r="0.9" fill="currentColor" />
          </svg>
          <div>
            <h1>Czy warto iść na ryby?</h1>
            <p>Planer wypadu — Koszalin i okolice</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'is-active' : ''}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Logowanie
          </button>
          {registrationOpen && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              Nowe konto
            </button>
          )}
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">
              <span>Jak się do Ciebie zwracać</span>
              <input
                type="text"
                value={displayName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)}
                autoComplete="nickname"
                placeholder="Kacper"
                required
                minLength={2}
                maxLength={60}
              />
            </label>
          )}

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="ty@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Hasło</span>
            <input
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? `min. ${minLength} znaków` : ''}
              required
              minLength={mode === 'register' ? minLength : 1}
            />
            {mode === 'register' && (
              <small className="field-hint">
                Minimum {minLength} znaków. Hasło jest haszowane bcryptem — serwer nigdy go nie przechowuje jawnie.
              </small>
            )}
          </label>

          {error && (
            <p className="form-error" role="alert">
              <IconAlert size={16} /> {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary full" disabled={busy}>
            {busy ? 'Chwileczkę…' : mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}
          </button>
        </form>

        {!registrationOpen && mode === 'login' && (
          <p className="auth-note">Rejestracja nowych kont jest na tym serwerze wyłączona.</p>
        )}

        <p className="auth-note">
          Konto trzyma Twoje łowiska i ustawienia na serwerze, więc miejsce dodane na telefonie zobaczysz od razu
          na komputerze.
        </p>
      </div>
    </div>
  );
}
