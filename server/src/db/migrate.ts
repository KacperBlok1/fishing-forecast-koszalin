import type { PoolClient } from 'pg';
import { pool } from './pool.js';

/**
 * Migracje trzymamy w kodzie i uruchamiamy przy każdym starcie serwera.
 * Każda ma unikalną nazwę zapisywaną w tabeli schema_migrations, więc
 * ponowny start niczego nie powtarza. Nie ma osobnego narzędzia ani kroku
 * w deployu — `docker compose up -d --build` wystarcza.
 */

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_init',
    sql: `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL,
        email_lower   text GENERATED ALWAYS AS (lower(email)) STORED,
        display_name  text NOT NULL,
        password_hash text NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (email_lower);

      CREATE TABLE IF NOT EXISTS sessions (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  text NOT NULL UNIQUE,
        created_at  timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        expires_at  timestamptz NOT NULL,
        user_agent  text
      );

      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

      CREATE TABLE IF NOT EXISTS spots (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       text NOT NULL,
        latitude   double precision NOT NULL,
        longitude  double precision NOT NULL,
        type       text NOT NULL,
        note       text,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT spots_type_check CHECK (type IN ('jezioro', 'rzeka', 'morze')),
        CONSTRAINT spots_lat_check CHECK (latitude >= -90 AND latitude <= 90),
        CONSTRAINT spots_lon_check CHECK (longitude >= -180 AND longitude <= 180),
        CONSTRAINT spots_name_check CHECK (char_length(btrim(name)) BETWEEN 2 AND 80)
      );

      CREATE INDEX IF NOT EXISTS spots_user_id_idx ON spots (user_id, sort_order, created_at);

      CREATE TABLE IF NOT EXISTS user_prefs (
        user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        species         text,
        selected_spot_id uuid REFERENCES spots(id) ON DELETE SET NULL,
        active_tab      text,
        updated_at      timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS weather_cache (
        cache_key  text PRIMARY KEY,
        payload    jsonb NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS weather_cache_fetched_at_idx ON weather_cache (fetched_at);
    `,
  },
];

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function runMigrations(log: (message: string) => void): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(applied.rows.map((row) => row.name));

    for (const migration of MIGRATIONS) {
      if (done.has(migration.name)) continue;
      log(`Migracja ${migration.name} — uruchamiam`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        log(`Migracja ${migration.name} — gotowe`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migracja ${migration.name} nie przeszła: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } finally {
    client.release();
  }
}
