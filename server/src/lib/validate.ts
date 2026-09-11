import { badRequest } from './errors.js';

/** Ciało żądania jako obiekt — cokolwiek innego (tablica, string, null) jest błędem. */
export function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Oczekiwano obiektu JSON w treści żądania.');
  }
  return body as Record<string, unknown>;
}

export function requireString(
  source: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number; label?: string } = {}
): string {
  const label = options.label ?? field;
  const value = source[field];
  if (typeof value !== 'string') {
    throw badRequest(`Pole „${label}” jest wymagane.`);
  }
  const trimmed = value.trim();
  const min = options.min ?? 1;
  const max = options.max ?? 500;
  if (trimmed.length < min) {
    throw badRequest(`Pole „${label}” musi mieć co najmniej ${min} zn.`);
  }
  if (trimmed.length > max) {
    throw badRequest(`Pole „${label}” może mieć najwyżej ${max} zn.`);
  }
  return trimmed;
}

export function optionalString(
  source: Record<string, unknown>,
  field: string,
  options: { max?: number; label?: string } = {}
): string | null {
  const value = source[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw badRequest(`Pole „${options.label ?? field}” musi być tekstem.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const max = options.max ?? 500;
  if (trimmed.length > max) {
    throw badRequest(`Pole „${options.label ?? field}” może mieć najwyżej ${max} zn.`);
  }
  return trimmed;
}

export function requireNumber(
  source: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number; label?: string } = {}
): number {
  const label = options.label ?? field;
  const raw = source[field];
  const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest(`Pole „${label}” musi być liczbą.`);
  }
  if (options.min !== undefined && value < options.min) {
    throw badRequest(`Pole „${label}” nie może być mniejsze niż ${options.min}.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw badRequest(`Pole „${label}” nie może być większe niż ${options.max}.`);
  }
  return value;
}

const SPOT_TYPES = ['jezioro', 'rzeka', 'morze'] as const;
export type SpotType = (typeof SPOT_TYPES)[number];

export function requireSpotType(source: Record<string, unknown>, field = 'type'): SpotType {
  const value = source[field];
  if (typeof value !== 'string' || !SPOT_TYPES.includes(value as SpotType)) {
    throw badRequest('Typ akwenu musi być jednym z: jezioro, rzeka, morze.');
  }
  return value as SpotType;
}

/**
 * Bardzo liberalna walidacja adresu e-mail: sprawdzamy kształt, a nie zgodność
 * z RFC. Serwer i tak nie wysyła maili, adres służy wyłącznie jako login.
 */
export function requireEmail(source: Record<string, unknown>, field = 'email'): string {
  const value = requireString(source, field, { min: 3, max: 254, label: 'adres e-mail' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw badRequest('To nie wygląda na poprawny adres e-mail.');
  }
  return value.toLowerCase();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function requireUuid(value: unknown, label = 'identyfikator'): string {
  if (!isUuid(value)) {
    throw badRequest(`Nieprawidłowy ${label}.`);
  }
  return value;
}
