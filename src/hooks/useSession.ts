import { useCallback, useEffect, useState } from 'react';
import { ApiError, authApi } from '../api';
import type { User } from '../api';
import { cacheUser, cachedUser, clearLocalMirror } from '../services/storage';

export type SessionStatus = 'checking' | 'guest' | 'authenticated';

export interface Session {
  status: SessionStatus;
  user: User | null;
  /** true, gdy działamy na zapamiętanej tożsamości, bo serwer był nieosiągalny. */
  offlineIdentity: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  recheck: () => Promise<void>;
}

/**
 * Stan zalogowania. Źródłem prawdy jest ciasteczko sesji i endpoint /api/auth/me.
 *
 * Jeżeli serwer jest chwilowo nieosiągalny, a w pamięci przeglądarki jest
 * zapamiętany użytkownik, wpuszczamy go do aplikacji w trybie offline —
 * zobaczy ostatnie zapisane dane i wyraźny komunikat. Bez tego powrót nad wodę
 * bez zasięgu oznaczałby ekran logowania zamiast prognozy.
 */
export function useSession(): Session {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [user, setUser] = useState<User | null>(() => cachedUser());
  const [offlineIdentity, setOfflineIdentity] = useState(false);

  const check = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      cacheUser(me);
      setOfflineIdentity(false);
      setStatus('authenticated');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.isUnauthorized) {
        setUser(null);
        cacheUser(null);
        clearLocalMirror();
        setOfflineIdentity(false);
        setStatus('guest');
        return;
      }
      // Problem z siecią, nie z uprawnieniami.
      const remembered = cachedUser();
      if (remembered) {
        setUser(remembered);
        setOfflineIdentity(true);
        setStatus('authenticated');
      } else {
        setStatus('guest');
      }
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const signIn = useCallback((next: User) => {
    setUser(next);
    cacheUser(next);
    setOfflineIdentity(false);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Nawet gdy serwer nie odpowie, lokalnie i tak się wylogowujemy.
    }
    clearLocalMirror();
    setUser(null);
    setOfflineIdentity(false);
    setStatus('guest');
  }, []);

  return { status, user, offlineIdentity, signIn, signOut, recheck: check };
}
