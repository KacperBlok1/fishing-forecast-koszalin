import type { MoonInfo } from '../types';
import { dateToUtcNoon } from './time';

/**
 * Faza księżyca liczona lokalnie, bez żadnego API.
 *
 * Open-Meteo nie udostępnia fazy księżyca, a jest ona czysto astronomiczna
 * i w pełni deterministyczna, więc liczymy ją sami z długości miesiąca
 * synodycznego. To przybliżenie (błąd rzędu kilku godzin), całkowicie
 * wystarczające do opisu "nów / pierwsza kwadra / pełnia".
 */

/** Średnia długość miesiąca synodycznego w dobach. */
export const SYNODIC_MONTH = 29.530588853;

/** Referencyjny nów: 6 stycznia 2000, 18:14 UTC. */
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

const PHASES: { limit: number; phase: string; icon: string }[] = [
  { limit: 1.85, phase: 'nów', icon: '🌑' },
  { limit: 5.54, phase: 'przybywający sierp', icon: '🌒' },
  { limit: 9.23, phase: 'pierwsza kwadra', icon: '🌓' },
  { limit: 12.91, phase: 'przybywający garb', icon: '🌔' },
  { limit: 16.61, phase: 'pełnia', icon: '🌕' },
  { limit: 20.3, phase: 'ubywający garb', icon: '🌖' },
  { limit: 23.99, phase: 'ostatnia kwadra', icon: '🌗' },
  { limit: 27.68, phase: 'ubywający sierp', icon: '🌘' },
];

/** Wiek księżyca (w dobach od nowiu) dla podanej chwili. */
export function moonAge(at: Date): number {
  const days = (at.getTime() - REFERENCE_NEW_MOON) / 86400000;
  const age = days % SYNODIC_MONTH;
  return age < 0 ? age + SYNODIC_MONTH : age;
}

/** Pełny opis fazy księżyca dla daty "YYYY-MM-DD" (liczony na południe UTC). */
export function moonForDate(date: string): MoonInfo {
  return moonForInstant(dateToUtcNoon(date));
}

export function moonForInstant(at: Date): MoonInfo {
  const age = moonAge(at);
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH)) / 2;
  const match = PHASES.find((p) => age < p.limit) ?? { phase: 'nów', icon: '🌑' };
  return {
    age: Math.round(age * 10) / 10,
    illumination: Math.round(illumination * 1000) / 1000,
    phase: match.phase,
    icon: match.icon,
  };
}
