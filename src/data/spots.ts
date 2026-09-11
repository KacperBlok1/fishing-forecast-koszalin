import type { Spot } from '../types';

/**
 * Przykładowe łowiska z Koszalina i okolic.
 *
 * Współrzędne są przybliżone (punkt reprezentatywny dla akwenu) — prognoza
 * Open-Meteo i tak jest interpolowana do siatki o boku kilku kilometrów,
 * więc dokładność do kilkuset metrów nie zmienia wyniku. Użytkownik może
 * dodać własne miejsce po nazwie albo po współrzędnych.
 */
export const DEFAULT_SPOTS: Spot[] = [
  // ---------- Jeziora ----------
  {
    id: 'jamno',
    name: 'Jezioro Jamno',
    latitude: 54.2833,
    longitude: 16.1667,
    type: 'jezioro',
    note: 'Duże jezioro przymorskie tuż za Koszalinem',
  },
  {
    id: 'bukowo',
    name: 'Jezioro Bukowo',
    latitude: 54.35,
    longitude: 16.267,
    type: 'jezioro',
    note: 'Płytkie jezioro przymorskie koło Dąbek',
  },
  {
    id: 'rosnowskie',
    name: 'Jezioro Rosnowskie',
    latitude: 54.093,
    longitude: 16.313,
    type: 'jezioro',
    note: 'Zbiornik zaporowy na Radwi, ok. 15 km na południe',
  },
  {
    id: 'kwiecko',
    name: 'Jezioro Kwiecko',
    latitude: 54.033,
    longitude: 16.65,
    type: 'jezioro',
    note: 'Zbiornik elektrowni szczytowo-pompowej Żydowo',
  },

  // ---------- Rzeki ----------
  {
    id: 'radew-niedalino',
    name: 'Radew (Niedalino)',
    latitude: 54.08,
    longitude: 16.22,
    type: 'rzeka',
    note: 'Nizinno-podgórski odcinek Radwi',
  },
  {
    id: 'wieprza-slawno',
    name: 'Wieprza (Sławno)',
    latitude: 54.362,
    longitude: 16.677,
    type: 'rzeka',
    note: 'Rzeka łososiowa, szeroki nurt',
  },
  {
    id: 'grabowa-polanow',
    name: 'Grabowa (Polanów)',
    latitude: 54.118,
    longitude: 16.7,
    type: 'rzeka',
    note: 'Czysta, szybka rzeka pstrągowa',
  },
  {
    id: 'parseta-karlino',
    name: 'Parsęta (Karlino)',
    latitude: 54.042,
    longitude: 15.87,
    type: 'rzeka',
    note: 'Dolny bieg Parsęty, ok. 35 km od Koszalina',
  },
  {
    id: 'dzierzecinka',
    name: 'Dzierżęcinka (Koszalin)',
    latitude: 54.195,
    longitude: 16.185,
    type: 'rzeka',
    note: 'Mała rzeka w granicach miasta',
  },

  // ---------- Morze ----------
  {
    id: 'mielno',
    name: 'Mielno — plaża',
    latitude: 54.261,
    longitude: 16.062,
    type: 'morze',
    note: 'Najbliższe Koszalinowi wyjście nad Bałtyk',
  },
  {
    id: 'uniescie',
    name: 'Unieście',
    latitude: 54.274,
    longitude: 16.118,
    type: 'morze',
    note: 'Wschodni kraniec mierzei jamneńskiej',
  },
  {
    id: 'sarbinowo',
    name: 'Sarbinowo',
    latitude: 54.286,
    longitude: 15.97,
    type: 'morze',
    note: 'Szeroka plaża na zachód od Mielna',
  },
  {
    id: 'darlowko',
    name: 'Darłówko — port',
    latitude: 54.434,
    longitude: 16.38,
    type: 'morze',
    note: 'Falochrony i ujście Wieprzy',
  },
  {
    id: 'ustronie-morskie',
    name: 'Ustronie Morskie',
    latitude: 54.218,
    longitude: 15.757,
    type: 'morze',
    note: 'Plaża z ostrogami, ok. 40 km od Koszalina',
  },
];

/** Łowisko wybierane, gdy użytkownik nie ma jeszcze nic zapisanego. */
export const DEFAULT_SPOT_ID = 'jamno';
