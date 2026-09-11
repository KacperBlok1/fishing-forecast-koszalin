import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/pool.js';
import { currentUser, requireUser } from '../lib/auth.js';
import { conflict, notFound } from '../lib/errors.js';
import {
  asObject,
  optionalString,
  requireNumber,
  requireSpotType,
  requireString,
  requireUuid,
} from '../lib/validate.js';

interface SpotRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  note: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

function toSpot(row: SpotRow) {
  return {
    id: row.id,
    name: row.name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    type: row.type,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

const SELECT_COLUMNS = 'id, name, latitude, longitude, type, note, sort_order, created_at, updated_at';

/**
 * Łowiska należą do konta, nie do przeglądarki — dlatego dodane na telefonie
 * są widoczne na komputerze zaraz po odświeżeniu listy. Każde zapytanie jest
 * filtrowane po user_id, więc jeden użytkownik nie zobaczy cudzych miejsc
 * nawet znając ich identyfikator.
 */
export async function spotRoutes(app: FastifyInstance): Promise<void> {
  // Hook jest hermetyzowany w obrębie tego pluginu — dotyczy wyłącznie tras poniżej.
  app.addHook('preHandler', requireUser);

  app.get('/api/spots', async (request) => {
    const user = currentUser(request);
    const result = await query<SpotRow>(
      `SELECT ${SELECT_COLUMNS} FROM spots WHERE user_id = $1 ORDER BY sort_order, created_at`,
      [user.id]
    );
    return { spots: result.rows.map(toSpot) };
  });

  app.post('/api/spots', async (request, reply) => {
    const user = currentUser(request);
    const body = asObject(request.body);

    const name = requireString(body, 'name', { min: 2, max: 80, label: 'nazwa łowiska' });
    const type = requireSpotType(body);
    const latitude = requireNumber(body, 'latitude', { min: -90, max: 90, label: 'szerokość geograficzna' });
    const longitude = requireNumber(body, 'longitude', { min: -180, max: 180, label: 'długość geograficzna' });
    const note = optionalString(body, 'note', { max: 200, label: 'opis' });

    const duplicate = await queryOne<{ id: string }>(
      'SELECT id FROM spots WHERE user_id = $1 AND lower(btrim(name)) = lower($2)',
      [user.id, name]
    );
    if (duplicate) {
      throw conflict('Masz już łowisko o tej nazwie.', 'spot_name_taken');
    }

    const row = await queryOne<SpotRow>(
      `INSERT INTO spots (user_id, name, latitude, longitude, type, note, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE((SELECT MAX(sort_order) + 1 FROM spots WHERE user_id = $1), 0))
       RETURNING ${SELECT_COLUMNS}`,
      [user.id, name, latitude, longitude, type, note]
    );

    reply.code(201);
    return { spot: toSpot(row as SpotRow) };
  });

  app.patch<{ Params: { id: string } }>('/api/spots/:id', async (request) => {
    const user = currentUser(request);
    const id = requireUuid(request.params.id, 'identyfikator łowiska');
    const body = asObject(request.body);

    const existing = await queryOne<SpotRow>(
      `SELECT ${SELECT_COLUMNS} FROM spots WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (!existing) {
      throw notFound('Nie znaleziono takiego łowiska na Twoim koncie.');
    }

    const name = body.name === undefined ? existing.name : requireString(body, 'name', { min: 2, max: 80, label: 'nazwa łowiska' });
    const type = body.type === undefined ? existing.type : requireSpotType(body);
    const latitude =
      body.latitude === undefined
        ? Number(existing.latitude)
        : requireNumber(body, 'latitude', { min: -90, max: 90, label: 'szerokość geograficzna' });
    const longitude =
      body.longitude === undefined
        ? Number(existing.longitude)
        : requireNumber(body, 'longitude', { min: -180, max: 180, label: 'długość geograficzna' });
    const note = body.note === undefined ? existing.note : optionalString(body, 'note', { max: 200, label: 'opis' });

    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await queryOne<{ id: string }>(
        'SELECT id FROM spots WHERE user_id = $1 AND lower(btrim(name)) = lower($2) AND id <> $3',
        [user.id, name, id]
      );
      if (duplicate) {
        throw conflict('Masz już łowisko o tej nazwie.', 'spot_name_taken');
      }
    }

    const row = await queryOne<SpotRow>(
      `UPDATE spots
          SET name = $1, latitude = $2, longitude = $3, type = $4, note = $5, updated_at = now()
        WHERE id = $6 AND user_id = $7
        RETURNING ${SELECT_COLUMNS}`,
      [name, latitude, longitude, type, note, id, user.id]
    );

    return { spot: toSpot(row as SpotRow) };
  });

  app.delete<{ Params: { id: string } }>('/api/spots/:id', async (request) => {
    const user = currentUser(request);
    const id = requireUuid(request.params.id, 'identyfikator łowiska');

    const result = await query('DELETE FROM spots WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (!result.rowCount) {
      throw notFound('Nie znaleziono takiego łowiska na Twoim koncie.');
    }
    return { ok: true };
  });
}
