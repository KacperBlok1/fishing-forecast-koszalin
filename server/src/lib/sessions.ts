import { createHmac, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { query, queryOne } from '../db/pool.js';

export const SESSION_COOKIE = 'ffk_session';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

/**
 * W bazie nie leży token, tylko jego HMAC z sekretem aplikacji.
 * Sam wyciek bazy nie pozwala więc podszyć się pod zalogowanego użytkownika —
 * bez SESSION_SECRET nie da się odtworzyć tokenu z zapisanego skrótu.
 */
function hashToken(token: string): string {
  return createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(userId: string, userAgent: string | null): Promise<CreatedSession> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000);
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(token), expiresAt, userAgent?.slice(0, 300) ?? null]
  );
  return { token, expiresAt };
}

interface SessionRow {
  session_id: string;
  user_id: string;
  email: string;
  display_name: string;
  last_seen_at: Date;
}

/** Zwraca użytkownika powiązanego z tokenem albo null, gdy token jest zły lub wygasł. */
export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null;

  const row = await queryOne<SessionRow>(
    `SELECT s.id AS session_id, u.id AS user_id, u.email, u.display_name, s.last_seen_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()`,
    [hashToken(token)]
  );
  if (!row) return null;

  // Znacznik aktywności odświeżamy najwyżej raz na godzinę, żeby każde
  // żądanie do API nie generowało zapisu do bazy.
  const lastSeen =
    row.last_seen_at instanceof Date ? row.last_seen_at.getTime() : Date.parse(String(row.last_seen_at));
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > 3_600_000) {
    await query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]);
  }

  return { id: row.user_id, email: row.email, displayName: row.display_name };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/** Sprzątanie wygasłych sesji — wołane cyklicznie z index.ts. */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query('DELETE FROM sessions WHERE expires_at < now()');
  return result.rowCount ?? 0;
}
