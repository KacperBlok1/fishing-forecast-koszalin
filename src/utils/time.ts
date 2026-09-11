/**
 * Narzędzia do pracy z czasem lokalnym łowiska.
 *
 * Open-Meteo zwraca czasy jako lokalne ISO bez strefy (np. "2026-09-11T14:00")
 * dla strefy podanej w zapytaniu. Celowo NIE parsujemy ich przez `new Date()`
 * bez potrzeby — przeglądarka użytkownika może mieć inną strefę niż łowisko,
 * a wtedy "świt" wypadałby o złej godzinie. Wszystkie operacje poniżej działają
 * na tekście albo na jawnie skonstruowanym czasie UTC.
 */

const WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'so'];
/** Część "YYYY-MM-DD" z lokalnego ISO. */
export function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Liczba minut od północy dla lokalnego ISO lub "HH:MM". */
export function minutesOfDay(iso: string): number {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso;
  if (!timePart) return 0;
  const hours = Number.parseInt(timePart.slice(0, 2), 10);
  const minutes = Number.parseInt(timePart.slice(3, 5), 10);
  if (!Number.isFinite(hours)) return 0;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

/** Godzina (0-23) z lokalnego ISO. */
export function hourOf(iso: string): number {
  return Math.floor(minutesOfDay(iso) / 60);
}

/** "2026-09-11T14:00" → "14:00". */
export function formatHour(iso: string): string {
  if (!iso) return '--:--';
  const minutes = minutesOfDay(iso);
  return formatMinutes(minutes);
}

/** 870 → "14:30". */
export function formatMinutes(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(normalized / 60)).padStart(2, '0');
  const m = String(normalized % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Zamienia "YYYY-MM-DD" na chwilę UTC (południe), stabilną niezależnie od strefy. */
export function dateToUtcNoon(date: string): Date {
  const year = Number.parseInt(date.slice(0, 4), 10);
  const month = Number.parseInt(date.slice(5, 7), 10);
  const day = Number.parseInt(date.slice(8, 10), 10);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** "2026-09-11" → "pt 11.09". */
export function formatDayShort(date: string): string {
  const d = dateToUtcNoon(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${WEEKDAYS[d.getUTCDay()]} ${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/** Dodaje godziny do lokalnego ISO, zawijając datę. */
export function addHours(iso: string, hours: number): string {
  const date = isoDate(iso);
  const total = minutesOfDay(iso) + hours * 60;
  const dayShift = Math.floor(total / 1440);
  const rest = ((total % 1440) + 1440) % 1440;
  const base = dateToUtcNoon(date);
  base.setUTCDate(base.getUTCDate() + dayShift);
  const shifted = base.toISOString().slice(0, 10);
  return `${shifted}T${formatMinutes(rest)}`;
}

/** Wiek danych w czytelnej formie ("przed chwilą", "8 min temu"). */
export function formatAge(fetchedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  if (seconds < 60) return 'przed chwilą';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h temu`;
  const days = Math.round(hours / 24);
  return `${days} dni temu`;
}
