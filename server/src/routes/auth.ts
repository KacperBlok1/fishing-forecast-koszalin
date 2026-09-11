import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { queryOne, transaction } from '../db/pool.js';
import { DEFAULT_SPOTS } from '../data/defaultSpots.js';
import { clearSessionCookie, currentUser, requireUser, setSessionCookie } from '../lib/auth.js';
import { badRequest, conflict, forbidden, tooManyRequests, unauthorized } from '../lib/errors.js';
import { assertPasswordStrength, hashPassword, verifyPassword } from '../lib/passwords.js';
import { RateLimiter } from '../lib/rateLimit.js';
import {
  SESSION_COOKIE,
  createSession,
  destroyAllSessionsForUser,
  destroySession,
} from '../lib/sessions.js';
import { asObject, requireEmail, requireString } from '../lib/validate.js';

/**
 * Limity: pięć nieudanych logowań na adres IP w ciągu piętnastu minut oraz
 * pięć rejestracji na godzinę. Udane logowanie kasuje licznik, więc własne
 * pomyłki nie zablokują Ci konta na długo.
 */
const loginLimiter = new RateLimiter(5, 15 * 60_000);
const registerLimiter = new RateLimiter(5, 60 * 60_000);

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
}

function clientKey(request: FastifyRequest): string {
  return request.ip || 'nieznane';
}

function publicUser(row: { id: string; email: string; display_name: string }) {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** Czy w ogóle można zakładać konta — klient chowa zakładkę rejestracji, gdy nie. */
  app.get('/api/auth/config', async () => ({
    allowRegistration: config.allowRegistration,
    minPasswordLength: 10,
  }));

  app.get('/api/auth/me', async (request) => {
    if (!request.user) {
      throw unauthorized('Nie jesteś zalogowany.');
    }
    return { user: request.user };
  });

  app.post('/api/auth/register', async (request, reply) => {
    if (!config.allowRegistration) {
      throw forbidden('Rejestracja nowych kont jest wyłączona na tym serwerze.');
    }

    const retryAfter = registerLimiter.check(clientKey(request));
    if (retryAfter !== null) {
      throw tooManyRequests(`Za dużo prób rejestracji. Spróbuj ponownie za ${retryAfter} s.`);
    }

    const body = asObject(request.body);
    const email = requireEmail(body);
    const password = requireString(body, 'password', { min: 1, max: 200, label: 'hasło' });
    const displayName = requireString(body, 'displayName', { min: 2, max: 60, label: 'nazwa' });
    assertPasswordStrength(password);

    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email_lower = lower($1)', [
      email,
    ]);
    if (existing) {
      throw conflict('Konto z tym adresem e-mail już istnieje.', 'email_taken');
    }

    const passwordHash = await hashPassword(password);

    const user = await transaction(async (client) => {
      const inserted = await client.query<UserRow>(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, password_hash`,
        [email, displayName, passwordHash]
      );
      const created = inserted.rows[0];

      // Nowe konto dostaje komplet przykładowych łowisk — pusta lista na starcie
      // to najgorsze pierwsze wrażenie, jakie może zrobić taka aplikacja.
      for (let index = 0; index < DEFAULT_SPOTS.length; index++) {
        const spot = DEFAULT_SPOTS[index];
        await client.query(
          `INSERT INTO spots (user_id, name, latitude, longitude, type, note, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [created.id, spot.name, spot.latitude, spot.longitude, spot.type, spot.note, index]
        );
      }

      await client.query(
        `INSERT INTO user_prefs (user_id, species, active_tab, selected_spot_id)
         VALUES ($1, 'szczupak', 'teraz',
                 (SELECT id FROM spots WHERE user_id = $1 ORDER BY sort_order LIMIT 1))`,
        [created.id]
      );

      return created;
    });

    const session = await createSession(user.id, request.headers['user-agent'] ?? null);
    setSessionCookie(reply, session.token, session.expiresAt);
    registerLimiter.reset(clientKey(request));

    reply.code(201);
    return { user: publicUser(user) };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const key = clientKey(request);
    const retryAfter = loginLimiter.check(key);
    if (retryAfter !== null) {
      throw tooManyRequests(`Za dużo nieudanych prób logowania. Spróbuj ponownie za ${retryAfter} s.`);
    }

    const body = asObject(request.body);
    const email = requireEmail(body);
    const password = requireString(body, 'password', { min: 1, max: 200, label: 'hasło' });

    const user = await queryOne<UserRow>(
      'SELECT id, email, display_name, password_hash FROM users WHERE email_lower = lower($1)',
      [email]
    );

    // Ten sam komunikat dla złego adresu i złego hasła — nie podpowiadamy,
    // który adres istnieje w bazie.
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !ok) {
      throw unauthorized('Nieprawidłowy e-mail lub hasło.');
    }

    const session = await createSession(user.id, request.headers['user-agent'] ?? null);
    setSessionCookie(reply, session.token, session.expiresAt);
    loginLimiter.reset(key);

    return { user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await destroySession(request.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(reply);
    return { ok: true };
  });

  /** Wylogowanie ze wszystkich urządzeń — przydatne po zmianie hasła. */
  app.post('/api/auth/logout-all', { preHandler: requireUser }, async (request, reply) => {
    const user = currentUser(request);
    await destroyAllSessionsForUser(user.id);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post('/api/auth/change-password', { preHandler: requireUser }, async (request, reply) => {
    const user = currentUser(request);
    const body = asObject(request.body);
    const currentPassword = requireString(body, 'currentPassword', { min: 1, max: 200, label: 'obecne hasło' });
    const newPassword = requireString(body, 'newPassword', { min: 1, max: 200, label: 'nowe hasło' });
    assertPasswordStrength(newPassword);

    if (currentPassword === newPassword) {
      throw badRequest('Nowe hasło musi różnić się od obecnego.');
    }

    const row = await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [
      user.id,
    ]);
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      throw unauthorized('Obecne hasło jest nieprawidłowe.');
    }

    const passwordHash = await hashPassword(newPassword);
    await transaction(async (client) => {
      await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        passwordHash,
        user.id,
      ]);
      // Zmiana hasła unieważnia wszystkie sesje — także tę, z której przyszło żądanie.
      await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    });

    const session = await createSession(user.id, request.headers['user-agent'] ?? null);
    setSessionCookie(reply, session.token, session.expiresAt);
    return { ok: true };
  });
}
