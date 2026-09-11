import type { SpotType } from '../lib/validate.js';

export interface DefaultSpot {
  name: string;
  latitude: number;
  longitude: number;
  type: SpotType;
  note: string;
}

/**
 * Zestaw łowisk zakładany każdemu nowemu kontu, żeby aplikacja nie witała
 * pustą listą. Użytkownik może je edytować i usuwać jak własne — to zwykłe
 * rekordy w tabeli spots, nie żadne "wbudowane" byty.
 *
 * Współrzędne są przybliżone (punkt reprezentatywny dla akwenu); model
 * pogodowy i tak interpoluje do siatki o boku kilku kilometrów.
 */
export const DEFAULT_SPOTS: DefaultSpot[] = [
  {
    name: 'Jezioro Jamno',
    latitude: 54.2833,
    longitude: 16.1667,
    type: 'jezioro',
    note: 'Duże jezioro przymorskie tuż za Koszalinem',
  },
  {
    name: 'Jezioro Bukowo',
    latitude: 54.35,
    longitude: 16.267,
    type: 'jezioro',
    note: 'Płytkie jezioro przymorskie koło Dąbek',
  },
  {
    name: 'Jezioro Rosnowskie',
    latitude: 54.093,
    longitude: 16.313,
    type: 'jezioro',
    note: 'Zbiornik zaporowy na Radwi, ok. 15 km na południe',
  },
  {
    name: 'Jezioro Kwiecko',
    latitude: 54.033,
    longitude: 16.65,
    type: 'jezioro',
    note: 'Zbiornik elektrowni szczytowo-pompowej Żydowo',
  },
  {
    name: 'Radew (Niedalino)',
    latitude: 54.08,
    longitude: 16.22,
    type: 'rzeka',
    note: 'Nizinno-podgórski odcinek Radwi',
  },
  {
    name: 'Wieprza (Sławno)',
    latitude: 54.362,
    longitude: 16.677,
    type: 'rzeka',
    note: 'Rzeka łososiowa, szeroki nurt',
  },
  {
    name: 'Grabowa (Polanów)',
    latitude: 54.118,
    longitude: 16.7,
    type: 'rzeka',
    note: 'Czysta, szybka rzeka pstrągowa',
  },
  {
    name: 'Parsęta (Karlino)',
    latitude: 54.042,
    longitude: 15.87,
    type: 'rzeka',
    note: 'Dolny bieg Parsęty, ok. 35 km od Koszalina',
  },
  {
    name: 'Dzierżęcinka (Koszalin)',
    latitude: 54.195,
    longitude: 16.185,
    type: 'rzeka',
    note: 'Mała rzeka w granicach miasta',
  },
  {
    name: 'Mielno — plaża',
    latitude: 54.261,
    longitude: 16.062,
    type: 'morze',
    note: 'Najbliższe Koszalinowi wyjście nad Bałtyk',
  },
  {
    name: 'Unieście',
    latitude: 54.274,
    longitude: 16.118,
    type: 'morze',
    note: 'Wschodni kraniec mierzei jamneńskiej',
  },
  {
    name: 'Sarbinowo',
    latitude: 54.286,
    longitude: 15.97,
    type: 'morze',
    note: 'Szeroka plaża na zachód od Mielna',
  },
  {
    name: 'Darłówko — port',
    latitude: 54.434,
    longitude: 16.38,
    type: 'morze',
    note: 'Falochrony i ujście Wieprzy',
  },
  {
    name: 'Ustronie Morskie',
    latitude: 54.218,
    longitude: 15.757,
    type: 'morze',
    note: 'Plaża z ostrogami, ok. 40 km od Koszalina',
  },
];
