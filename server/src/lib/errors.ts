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

export const badRequest = (message: string, code = 'bad_request') => new HttpError(400, code, message);
export const unauthorized = (message = 'Musisz się zalogować.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Brak uprawnień do tego zasobu.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Nie znaleziono zasobu.') => new HttpError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message);
export const tooManyRequests = (message: string) => new HttpError(429, 'too_many_requests', message);
export const badGateway = (message: string) => new HttpError(502, 'upstream_error', message);
