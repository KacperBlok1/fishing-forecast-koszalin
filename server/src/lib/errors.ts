/** Błąd z jawnym kodem HTTP i komunikatem po polsku, gotowym do pokazania użytkownikowi. */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Bezpieczne odczytanie komunikatu z wartości złapanej w catch albo przekazanej
 * przez Fastify. W trybie strict taka wartość ma typ `unknown` — nie wolno
 * zakładać, że ktoś rzucił akurat obiektem Error.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Kod HTTP z błędu, o ile go niesie (tak robią błędy Fastify i walidacji).
 * Dla wszystkiego innego zwracamy 500 — nieznany błąd to błąd serwera.
 */
export function getErrorStatusCode(error: unknown, fallback = 500): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
      return statusCode;
    }
  }
  return fallback;
}

export const badRequest = (message: string, code = 'bad_request') => new HttpError(400, code, message);
export const unauthorized = (message = 'Musisz się zalogować.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Brak uprawnień do tego zasobu.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Nie znaleziono zasobu.') => new HttpError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message);
export const tooManyRequests = (message: string) => new HttpError(429, 'too_many_requests', message);
export const badGateway = (message: string) => new HttpError(502, 'upstream_error', message);
