import type { FishingLocationType, GeoLocation, Spot, SpeciesId, TabId } from '../types';
import { api } from './http';

// ------------------------------------------------------------------ konto

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface ServerConfig {
  allowRegistration: boolean;
  minPasswordLength: number;
}

export const authApi = {
  config: () => api.get<ServerConfig>('/api/auth/config'),
  me: () => api.get<{ user: User }>('/api/auth/me').then((r) => r.user),
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/api/auth/login', { email, password }).then((r) => r.user),
  register: (email: string, password: string, displayName: string) =>
    api.post<{ user: User }>('/api/auth/register', { email, password, displayName }).then((r) => r.user),
  logout: () => api.post<{ ok: boolean }>('/api/auth/logout'),
  logoutAll: () => api.post<{ ok: boolean }>('/api/auth/logout-all'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean }>('/api/auth/change-password', { currentPassword, newPassword }),
};

// ------------------------------------------------------------------ łowiska

export interface SpotInput {
  name: string;
  latitude: number;
  longitude: number;
  type: FishingLocationType;
  note?: string | null;
}

export const spotsApi = {
  list: (signal?: AbortSignal) => api.get<{ spots: Spot[] }>('/api/spots', signal).then((r) => r.spots),
  create: (input: SpotInput) => api.post<{ spot: Spot }>('/api/spots', input).then((r) => r.spot),
  update: (id: string, input: Partial<SpotInput>) =>
    api.patch<{ spot: Spot }>(`/api/spots/${id}`, input).then((r) => r.spot),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/api/spots/${id}`),
};

// ------------------------------------------------------------------ ustawienia

export interface RemotePrefs {
  species: SpeciesId;
  selectedSpotId: string | null;
  activeTab: TabId;
}

export const prefsApi = {
  get: (signal?: AbortSignal) => api.get<{ prefs: RemotePrefs }>('/api/prefs', signal).then((r) => r.prefs),
  save: (prefs: Partial<RemotePrefs>) =>
    api.put<{ prefs: RemotePrefs }>('/api/prefs', prefs).then((r) => r.prefs),
};

// ------------------------------------------------------------------ pogoda

export interface WeatherEnvelope {
  data: unknown;
  meta: {
    /** Kiedy serwer pobrał te dane z Open-Meteo (ISO). */
    fetchedAt: string;
    /** true = Open-Meteo nie odpowiedziało, serwer oddał ostatnią poprawną odpowiedź. */
    stale: boolean;
    source: string;
  };
}

export const weatherApi = {
  forecast: (spotId: string, force = false, signal?: AbortSignal) =>
    api.get<WeatherEnvelope>(`/api/weather/forecast?spotId=${encodeURIComponent(spotId)}${force ? '&force=1' : ''}`, signal),
  marine: (spotId: string, force = false, signal?: AbortSignal) =>
    api.get<WeatherEnvelope>(`/api/weather/marine?spotId=${encodeURIComponent(spotId)}${force ? '&force=1' : ''}`, signal),
  geocode: (query: string, signal?: AbortSignal) =>
    api
      .get<{ results: Array<Omit<GeoLocation, 'country'> & { admin1: string | null }> }>(
        `/api/weather/geocode?q=${encodeURIComponent(query)}`,
        signal
      )
      .then((r) =>
        r.results.map<GeoLocation>((item) => ({
          id: item.id,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          country: 'Polska',
          admin1: item.admin1 ?? undefined,
        }))
      ),
};

export { ApiError } from './http';
