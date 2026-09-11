import type { FishingLocationType, SpeciesId } from '../types';

/** Preferencja świetlna gatunku — decyduje o premii za porę dnia. */
export type LightPreference = 'przyćmione' | 'jasne' | 'nocne' | 'obojętne';

/** Stosunek gatunku do falowania i wiatru. */
export type WindPreference = 'lubi' | 'obojętny' | 'nie lubi';

export interface SpeciesProfile {
  id: SpeciesId;
  /** Nazwa wyświetlana (mianownik). */
  name: string;
  /** Dopełniacz — używany w zdaniach typu „warunki na szczupaka”. */
  genitive: string;
  icon: string;
  /** Akweny, na których gatunek występuje w naszym regionie. */
  habitats: FishingLocationType[];
  /** Zakres temperatury powietrza, w którym gatunek zwykle żeruje najlepiej (°C). */
  temperatureRange: [number, number];
  light: LightPreference;
  wind: WindPreference;
  /** Czy gatunek wyraźnie reaguje na skoki ciśnienia. */
  pressureSensitive: boolean;
  /** Czy zachmurzenie pomaga (ryby drapieżne trzymające się płycizn). */
  likesClouds: boolean;
  /** Krótki opis pokazywany przy wyborze gatunku. */
  summary: string;
  /** Dodatkowe uwagi (przepisy, okresy ochronne — zawsze do zweryfikowania). */
  notes: string[];
}

export const SPECIES: SpeciesProfile[] = [
  {
    id: 'szczupak',
    name: 'Szczupak',
    genitive: 'szczupaka',
    icon: '🐊',
    habitats: ['jezioro', 'rzeka'],
    temperatureRange: [4, 20],
    light: 'przyćmione',
    wind: 'lubi',
    pressureSensitive: false,
    likesClouds: true,
    summary: 'Drapieżnik zasadzkowy. Najlepiej reaguje przy chłodnej wodzie, zachmurzeniu i lekkiej fali.',
    notes: [
      'Okres ochronny w Polsce zwykle od 1 stycznia do 30 kwietnia — sprawdź aktualny regulamin okręgu.',
      'Przy temperaturze powietrza powyżej 25 °C aktywność wyraźnie spada.',
    ],
  },
  {
    id: 'okon',
    name: 'Okoń',
    genitive: 'okonia',
    icon: '🐟',
    habitats: ['jezioro', 'rzeka'],
    temperatureRange: [6, 22],
    light: 'jasne',
    wind: 'lubi',
    pressureSensitive: false,
    likesClouds: false,
    summary: 'Poluje wzrokiem w stadzie, najaktywniejszy w dzień. Falowanie przy brzegu działa na jego korzyść.',
    notes: ['Brak okresu ochronnego, obowiązuje wymiar ochronny w części okręgów.'],
  },
  {
    id: 'sandacz',
    name: 'Sandacz',
    genitive: 'sandacza',
    icon: '🌙',
    habitats: ['jezioro', 'rzeka'],
    temperatureRange: [8, 24],
    light: 'nocne',
    wind: 'lubi',
    pressureSensitive: false,
    likesClouds: true,
    summary: 'Widzi lepiej niż jego ofiary po zmroku. Najlepsze wyjścia to noc, świt i zmierzch.',
    notes: [
      'Okres ochronny zwykle od 1 stycznia do 31 maja — sprawdź regulamin okręgu.',
      'Mętna woda po deszczu bywa dla sandacza korzystna.',
    ],
  },
  {
    id: 'karp',
    name: 'Karp',
    genitive: 'karpia',
    icon: '🎏',
    habitats: ['jezioro', 'rzeka'],
    temperatureRange: [16, 28],
    light: 'obojętne',
    wind: 'nie lubi',
    pressureSensitive: true,
    likesClouds: false,
    summary: 'Ryba ciepłolubna. Żeruje przy stabilnym, wysokim ciśnieniu i ciepłej wodzie.',
    notes: ['Gwałtowne spadki ciśnienia potrafią całkowicie wyłączyć branie.'],
  },
  {
    id: 'leszcz',
    name: 'Leszcz',
    genitive: 'leszcza',
    icon: '🥏',
    habitats: ['jezioro', 'rzeka'],
    temperatureRange: [12, 26],
    light: 'przyćmione',
    wind: 'nie lubi',
    pressureSensitive: true,
    likesClouds: false,
    summary: 'Stadna ryba spokojnego żeru. Lubi ciepło, spokojną wodę i wyrównane ciśnienie.',
    notes: ['Najlepsze brania zwykle o świcie i późnym wieczorem.'],
  },
  {
    id: 'pstrag',
    name: 'Pstrąg',
    genitive: 'pstrąga',
    icon: '💧',
    habitats: ['rzeka', 'jezioro'],
    temperatureRange: [4, 16],
    light: 'przyćmione',
    wind: 'nie lubi',
    pressureSensitive: false,
    likesClouds: true,
    summary: 'Zimnolubny mieszkaniec czystych rzek. Ciepłe, bezwietrzne dni mu nie służą.',
    notes: [
      'Wody krainy pstrąga mają własne okresy ochronne i regulaminy — sprawdź przed wyjazdem.',
      'Powyżej 20 °C powietrza aktywność pstrąga wyraźnie spada.',
    ],
  },
  {
    id: 'dorsz',
    name: 'Dorsz',
    genitive: 'dorsza',
    icon: '⚓',
    habitats: ['morze'],
    temperatureRange: [2, 14],
    light: 'obojętne',
    wind: 'obojętny',
    pressureSensitive: false,
    likesClouds: false,
    summary: 'Gatunek morski. O wyniku decyduje przede wszystkim fala i bezpieczeństwo wyjścia.',
    notes: [
      'Połów dorsza na Bałtyku podlega ograniczeniom i zakazom — przed wyjazdem sprawdź aktualne przepisy.',
      'Przy fali powyżej 1,5 m wyjście z brzegu i z małej łodzi jest niebezpieczne.',
    ],
  },
];

export const DEFAULT_SPECIES_ID: SpeciesId = 'szczupak';

const SPECIES_BY_ID = new Map<SpeciesId, SpeciesProfile>(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: SpeciesId): SpeciesProfile {
  return SPECIES_BY_ID.get(id) ?? SPECIES[0];
}

export function isSpeciesId(value: unknown): value is SpeciesId {
  return typeof value === 'string' && SPECIES_BY_ID.has(value as SpeciesId);
}
