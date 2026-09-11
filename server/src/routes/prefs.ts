import type { FastifyInstance } from 'fastify';
import { queryOne } from '../db/pool.js';
import { currentUser, requireUser } from '../lib/auth.js';
import { badRequest } from '../lib/errors.js';
import { asObject, isUuid } from '../lib/validate.js';

const SPECIES = ['szczupak', 'okon', 'sandacz', 'karp', 'leszcz', 'pstrag', 'dorsz'] as const;
const TABS = ['teraz', 'dzis', 'tydzien', 'dlaczego'] as const;

interface PrefsRow {
  species: string | null;
  selected_spot_id: string | null;
  active_tab: string | null;
  updated_at: Date;
}

function toPrefs(row: PrefsRow | null) {
  return {
    species: row?.species ?? 'szczupak',
    selectedSpotId: row?.selected_spot_id ?? null,
    activeTab: row?.active_tab ?? 'teraz',
  };
}

/**
 * Ustawienia widoku trzymane po stronie konta: wybrane łowisko, gatunek
 * i aktywna zakładka. Dzięki temu aplikacja otwarta na komputerze wygląda
 * tak, jak ją zostawiłeś na telefonie.
 */
export async function prefsRoutes(app: FastifyInstance): Promise<void> {
  // Hook jest hermetyzowany w obrębie tego pluginu — dotyczy wyłącznie tras poniżej.
  app.addHook('preHandler', requireUser);

  app.get('/api/prefs', async (request) => {
    const user = currentUser(request);
    const row = await queryOne<PrefsRow>(
      'SELECT species, selected_spot_id, active_tab, updated_at FROM user_prefs WHERE user_id = $1',
      [user.id]
    );
    return { prefs: toPrefs(row) };
  });

  app.put('/api/prefs', async (request) => {
    const user = currentUser(request);
    const body = asObject(request.body);

    let species: string | null = null;
    if (body.species !== undefined && body.species !== null) {
      if (typeof body.species !== 'string' || !SPECIES.includes(body.species as (typeof SPECIES)[number])) {
        throw badRequest('Nieznany gatunek.');
      }
      species = body.species;
    }

    let activeTab: string | null = null;
    if (body.activeTab !== undefined && body.activeTab !== null) {
      if (typeof body.activeTab !== 'string' || !TABS.includes(body.activeTab as (typeof TABS)[number])) {
        throw badRequest('Nieznana zakładka.');
      }
      activeTab = body.activeTab;
    }

    let selectedSpotId: string | null = null;
    if (body.selectedSpotId !== undefined && body.selectedSpotId !== null && body.selectedSpotId !== '') {
      if (!isUuid(body.selectedSpotId)) {
        throw badRequest('Nieprawidłowy identyfikator łowiska.');
      }
      // Cudzego (albo nieistniejącego) łowiska nie da się ustawić jako wybranego.
      const owned = await queryOne<{ id: string }>('SELECT id FROM spots WHERE id = $1 AND user_id = $2', [
        body.selectedSpotId,
        user.id,
      ]);
      selectedSpotId = owned ? owned.id : null;
    }

    const row = await queryOne<PrefsRow>(
      `INSERT INTO user_prefs (user_id, species, selected_spot_id, active_tab, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
         SET species          = COALESCE(EXCLUDED.species, user_prefs.species),
             selected_spot_id = COALESCE(EXCLUDED.selected_spot_id, user_prefs.selected_spot_id),
             active_tab       = COALESCE(EXCLUDED.active_tab, user_prefs.active_tab),
             updated_at       = now()
       RETURNING species, selected_spot_id, active_tab, updated_at`,
      [user.id, species, selectedSpotId, activeTab]
    );

    return { prefs: toPrefs(row) };
  });
}
