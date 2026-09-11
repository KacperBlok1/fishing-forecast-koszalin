import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config.js';

/**
 * Jedna pula połączeń na proces. Dla jednego kontenera i kilku użytkowników
 * dziesięć połączeń to z zapasem wystarczająco.
 */
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export type QueryParam = string | number | boolean | Date | null | undefined;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly QueryParam[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as QueryParam[]);
}

/** Zwraca pierwszy wiersz albo null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly QueryParam[] = []
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

/** Uruchamia callback w transakcji, z automatycznym ROLLBACK przy błędzie. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Jeśli ROLLBACK też padnie, oryginalny błąd jest ważniejszy.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Czeka, aż Postgres zacznie odpowiadać.
 * Healthcheck w compose powinien to załatwić, ale przy starcie całego stosu
 * baza potrafi być jeszcze w trakcie inicjalizacji — lepiej poczekać niż paść.
 */
export async function waitForDatabase(attempts = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          `Nie udało się połączyć z bazą po ${attempts} próbach. ` +
            `Sprawdź DATABASE_URL i kontener bazy. Ostatni błąd: ${
              error instanceof Error ? error.message : String(error)
            }`
        );
      }
      await new Promise<void>((resolve) => setTimeout(() => resolve(), delayMs));
    }
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
