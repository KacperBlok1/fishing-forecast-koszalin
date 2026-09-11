/**
 * Cienka warstwa nad fetch dla całego API aplikacji.
 *
 * Wszystkie zapytania idą pod ten sam origin co aplikacja (serwer Fastify
 * serwuje i frontend, i /api), więc nie ma tu CORS-u ani adresów w konfiguracji.
 * Ciasteczko sesji dokłada przeglądarka.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** true, gdy problemem jest brak zalogowania, a nie treść żądania. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** true dla błędów sieci/serwera, przy których warto pokazać dane z cache. */
  get isTransport(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

const TIMEOUT_MS = 20_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Przekazany sygnał (np. z odmontowanego komponentu) przerywa nasz też.
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const error =
        payload && typeof payload === 'object' && 'error' in payload
          ? (payload as { error?: { code?: string; message?: string } }).error
          : undefined;
      throw new ApiError(
        response.status,
        error?.code ?? 'http_error',
        error?.message ?? `Serwer odpowiedział kodem ${response.status}.`
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'Serwer nie odpowiedział w rozsądnym czasie.');
    }
    throw new ApiError(
      0,
      'network',
      'Nie udało się połączyć z serwerem aplikacji. Sprawdź, czy jesteś w tej samej sieci.'
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'DELETE', signal }),
};
