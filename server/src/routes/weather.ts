import type { FastifyInstance, FastifyRequest } from 'fastify';
import { queryOne } from '../db/pool.js';
import { currentUser, requireUser } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { isUuid } from '../lib/validate.js';
import { fetchForecast, fetchGeocoding, fetchMarine } from '../services/openMeteo.js';
import { coordinateKey, getOrFetch } from '../services/weatherCache.js';

interface WeatherQuery {
  spotId?: string;
  lat?: string;
  lon?: string;
  force?: string;
}

interface SpotRow {
  latitude: number;
  longitude: number;
  type: string;
}

/** Geokodowanie zmienia się raz na ruski rok — trzymamy je w cache znacznie dłużej niż pogodę. */
const GEO_FRESH_MS = 7 * 24 * 3_600_000;
const GEO_STALE_MS = 90 * 24 * 3_600_000;

function parseCoordinate(value: string | undefined, label: string, limit: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) {
    throw badRequest(`Nieprawidłowa ${label}.`);
  }
  return parsed;
}

export async function weatherRoutes(app: FastifyInstance): Promise<void> {
  // Hook jest hermetyzowany w obrębie tego pluginu — dotyczy wyłącznie tras poniżej.
  app.addHook('preHandler', requireUser);

  /**
   * Współrzędne można podać wprost albo przez identyfikator łowiska.
   * Wariant ze spotId jest preferowany: sprawdza, czy łowisko należy do
   * zalogowanego konta, i nie pozwala używać serwera jako otwartego proxy.
   */
  async function resolveCoordinates(
    request: FastifyRequest<{ Querystring: WeatherQuery }>
  ): Promise<{ latitude: number; longitude: number; type: string | null }> {
    const user = currentUser(request);
    const { spotId, lat, lon } = request.query;

    if (spotId) {
      if (!isUuid(spotId)) throw badRequest('Nieprawidłowy identyfikator łowiska.');
      const spot = await queryOne<SpotRow>(
        'SELECT latitude, longitude, type FROM spots WHERE id = $1 AND user_id = $2',
        [spotId, user.id]
      );
      if (!spot) throw notFound('Nie znaleziono takiego łowiska na Twoim koncie.');
      return { latitude: Number(spot.latitude), longitude: Number(spot.longitude), type: spot.type };
    }

    return {
      latitude: parseCoordinate(lat, 'szerokość geograficzną', 90),
      longitude: parseCoordinate(lon, 'długość geograficzną', 180),
      type: null,
    };
  }

  app.get<{ Querystring: WeatherQuery }>('/api/weather/forecast', async (request) => {
    const { latitude, longitude } = await resolveCoordinates(request);
    const force = request.query.force === '1';

    const cached = await getOrFetch(
      coordinateKey('forecast', latitude, longitude),
      () => fetchForecast(latitude, longitude),
      { force }
    );

    return {
      data: cached.data,
      meta: { fetchedAt: cached.fetchedAt, stale: cached.stale, source: 'open-meteo' },
    };
  });

  app.get<{ Querystring: WeatherQuery }>('/api/weather/marine', async (request) => {
    const { latitude, longitude } = await resolveCoordinates(request);
    const force = request.query.force === '1';

    const cached = await getOrFetch(
      coordinateKey('marine', latitude, longitude),
      () => fetchMarine(latitude, longitude),
      { force }
    );

    return {
      data: cached.data,
      meta: { fetchedAt: cached.fetchedAt, stale: cached.stale, source: 'open-meteo-marine' },
    };
  });

  app.get<{ Querystring: { q?: string } }>('/api/weather/geocode', async (request) => {
    const raw = (request.query.q ?? '').trim();
    if (raw.length < 2) {
      return { results: [] };
    }
    if (raw.length > 80) {
      throw badRequest('Szukana nazwa jest za długa.');
    }

    const cached = await getOrFetch(`geocode:${raw.toLowerCase()}`, () => fetchGeocoding(raw), {
      freshMs: GEO_FRESH_MS,
      staleMs: GEO_STALE_MS,
    });

    const payload = cached.data as { results?: unknown } | null;
    const results = Array.isArray(payload?.results) ? payload.results : [];

    // Aplikacja jest regionalna — zwracamy tylko wyniki z Polski.
    const filtered = results.filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== 'object') return false;
      const country = (item as Record<string, unknown>).country;
      return country === 'Polska' || country === 'Poland';
    });

    return {
      results: filtered.map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? ''),
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        admin1: typeof item.admin1 === 'string' ? item.admin1 : null,
      })),
    };
  });
}
