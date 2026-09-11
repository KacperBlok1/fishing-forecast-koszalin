import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { unauthorized } from './errors.js';
import { SESSION_COOKIE, resolveSession } from './sessions.js';
import type { SessionUser } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Użytkownik rozpoznany z ciasteczka sesji; undefined dla gościa. */
    user?: SessionUser;
  }
}

/**
 * Hook globalny: przy każdym żądaniu próbuje rozpoznać użytkownika,
 * ale nikogo nie odrzuca. O dostęp dba requireUser na konkretnych trasach.
 */
export async function attachUser(request: FastifyRequest): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE];
  const user = await resolveSession(token);
  request.user = user ?? undefined;
}

/** preHandler dla tras wymagających zalogowania. */
export async function requireUser(request: FastifyRequest): Promise<void> {
  if (!request.user) {
    throw unauthorized('Zaloguj się, żeby korzystać z aplikacji.');
  }
}

/**
 * Zwraca zalogowanego użytkownika albo rzuca 401 — do użycia w handlerach.
 * Przyjmuje dowolny obiekt z polem `user`, żeby nie zależeć od wariantu
 * generyków konkretnej trasy.
 */
export function currentUser(request: { user?: SessionUser }): SessionUser {
  if (!request.user) {
    throw unauthorized('Zaloguj się, żeby korzystać z aplikacji.');
  }
  return request.user;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
  });
}
