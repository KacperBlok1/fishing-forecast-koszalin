import { describe, it, expect } from 'vitest';
import {
  RATING_THRESHOLDS,
  SPECIES_DELTA_LIMIT,
  computeScore,
  dayPhase,
  ratingLabel,
  scoreCloud,
  scoreLight,
  scoreMoon,
  scorePrecipitation,
  scorePressure,
  scoreStability,
  scoreTemperature,
  scoreWave,
  scoreWind,
  speciesAdjustment,
  waveSafety,
} from './scoring';
import type { ScoreContext } from './scoring';
import { getSpecies } from '../data/species';
import { moonForDate } from './moon';
import type { HourPoint } from '../types';

function hour(overrides: Partial<HourPoint> = {}): HourPoint {
  return {
    time: '2026-09-11T18:00',
    temperature: 17,
    apparentTemperature: 16,
    humidity: 70,
    precipitation: 0,
    precipitationProbability: 10,
    cloudCover: 50,
    pressure: 1015,
    windSpeed: 10,
    windDirection: 270,
    windGusts: 14,
    weatherCode: 2,
    isDay: 1,
    ...overrides,
  };
}

function context(overrides: Partial<ScoreContext> = {}): ScoreContext {
  return {
    hour: hour(),
    locationType: 'jezioro',
    sunriseMinutes: 6 * 60,
    sunsetMinutes: 19 * 60,
    moon: moonForDate('2026-09-11'),
    pressureChange24h: 0,
    temperatureChange: 0,
    pressureRange: 2,
    windRange: 6,
    waveHeight: null,
    ...overrides,
  };
}

describe('ratingLabel', () => {
  it('przypisuje cztery etykiety zgodnie z progami', () => {
    expect(ratingLabel(0)).toBe('słabo');
    expect(ratingLabel(RATING_THRESHOLDS.srednio - 1)).toBe('słabo');
    expect(ratingLabel(RATING_THRESHOLDS.srednio)).toBe('średnio');
    expect(ratingLabel(RATING_THRESHOLDS.dobrze)).toBe('dobrze');
    expect(ratingLabel(RATING_THRESHOLDS.bardzoDobrze)).toBe('bardzo dobrze');
    expect(ratingLabel(100)).toBe('bardzo dobrze');
  });
});

describe('scoreWind', () => {
  it('premiuje lekki wiatr ponad zupełną ciszę', () => {
    expect(scoreWind(10, 12, 'jezioro')).toBeGreaterThan(scoreWind(1, 2, 'jezioro'));
  });

  it('obniża wynik przy wichurze', () => {
    expect(scoreWind(60, 80, 'jezioro')).toBeLessThan(15);
  });

  it('karze porywistość', () => {
    expect(scoreWind(10, 30, 'jezioro')).toBeLessThan(scoreWind(10, 12, 'jezioro'));
  });

  it('ma szersze optimum dla morza niż dla jeziora', () => {
    expect(scoreWind(20, 24, 'morze')).toBeGreaterThan(scoreWind(20, 24, 'jezioro'));
  });

  it('zawsze mieści się w zakresie 0-100', () => {
    for (let speed = 0; speed <= 120; speed += 3) {
      const value = scoreWind(speed, speed * 1.5, 'rzeka');
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('scorePressure', () => {
  it('stabilne ciśnienie jest lepsze niż gwałtowny skok', () => {
    expect(scorePressure(1015, 0)).toBeGreaterThan(scorePressure(1015, 12));
  });

  it('łagodny spadek jest oceniany wyżej niż łagodny wzrost', () => {
    expect(scorePressure(1015, -3)).toBeGreaterThan(scorePressure(1015, 3));
  });

  it('działa bez danych o zmianie', () => {
    expect(scorePressure(1015, null)).toBeGreaterThan(0);
  });
});

describe('scorePrecipitation', () => {
  it('mżawka jest lepsza od ulewy', () => {
    expect(scorePrecipitation(0.2, 51)).toBeGreaterThan(scorePrecipitation(8, 65));
  });

  it('burza przycina ocenę niezależnie od sumy opadów', () => {
    expect(scorePrecipitation(0, 95)).toBeLessThanOrEqual(22);
  });
});

describe('scoreTemperature', () => {
  it('premiuje zakres 12-22 stopni', () => {
    expect(scoreTemperature(17, 0)).toBeGreaterThan(scoreTemperature(35, 0));
  });

  it('karze gwałtowną zmianę względem ostatnich trzech dni', () => {
    expect(scoreTemperature(17, 0)).toBeGreaterThan(scoreTemperature(17, 12));
  });
});

describe('scoreCloud, scoreMoon, scoreStability, scoreWave', () => {
  it('zachmurzenie 30-75% dostaje najwyższą notę', () => {
    expect(scoreCloud(50)).toBeGreaterThan(scoreCloud(0));
    expect(scoreCloud(50)).toBeGreaterThan(scoreCloud(100));
  });

  it('nów i pełnia są premiowane względem kwadry', () => {
    expect(scoreMoon(0)).toBeGreaterThan(scoreMoon(0.5));
    expect(scoreMoon(1)).toBeGreaterThan(scoreMoon(0.5));
  });

  it('stabilna pogoda dostaje więcej punktów', () => {
    expect(scoreStability(1, 5)).toBeGreaterThan(scoreStability(14, 40));
  });

  it('mała fala jest lepsza od dużej', () => {
    expect(scoreWave(0.2)).toBeGreaterThan(scoreWave(2.8));
  });
});

describe('dayPhase i scoreLight', () => {
  it('rozpoznaje świt, dzień, zmierzch i noc', () => {
    expect(dayPhase(6 * 60, 6 * 60, 19 * 60)).toBe('świt');
    expect(dayPhase(13 * 60, 6 * 60, 19 * 60)).toBe('dzień');
    expect(dayPhase(19 * 60, 6 * 60, 19 * 60)).toBe('zmierzch');
    expect(dayPhase(2 * 60, 6 * 60, 19 * 60)).toBe('noc');
  });

  it('świt i zmierzch dostają najwyższą notę', () => {
    expect(scoreLight(6 * 60, 6 * 60, 19 * 60)).toBeGreaterThan(scoreLight(13 * 60, 6 * 60, 19 * 60));
  });
});

describe('waveSafety', () => {
  it('nie zmyśla danych, gdy fali brak', () => {
    expect(waveSafety(null).level).toBe('brak danych');
  });

  it('rośnie wraz z wysokością fali', () => {
    expect(waveSafety(0.2).level).toBe('bezpiecznie');
    expect(waveSafety(0.8).level).toBe('ostrożnie');
    expect(waveSafety(1.6).level).toBe('trudne warunki');
    expect(waveSafety(3).level).toBe('niebezpiecznie');
  });
});

describe('speciesAdjustment', () => {
  it('karze gatunek nietypowy dla akwenu', () => {
    const result = speciesAdjustment(getSpecies('dorsz'), {
      locationType: 'jezioro',
      temperature: 10,
      phase: 'dzień',
      cloudCover: 50,
      windSpeed: 10,
      pressureChange24h: 0,
    });
    expect(result.delta).toBeLessThan(0);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('premiuje sandacza po zmroku, a okonia w dzień', () => {
    const base = {
      locationType: 'jezioro' as const,
      temperature: 18,
      cloudCover: 50,
      windSpeed: 10,
      pressureChange24h: 0,
    };
    const zanderNight = speciesAdjustment(getSpecies('sandacz'), { ...base, phase: 'noc' });
    const zanderDay = speciesAdjustment(getSpecies('sandacz'), { ...base, phase: 'dzień' });
    expect(zanderNight.delta).toBeGreaterThan(zanderDay.delta);

    const perchDay = speciesAdjustment(getSpecies('okon'), { ...base, phase: 'dzień' });
    const perchNight = speciesAdjustment(getSpecies('okon'), { ...base, phase: 'noc' });
    expect(perchDay.delta).toBeGreaterThan(perchNight.delta);
  });

  it('nigdy nie przekracza limitu korekty', () => {
    for (const species of ['szczupak', 'okon', 'sandacz', 'karp', 'leszcz', 'pstrag', 'dorsz'] as const) {
      for (const phase of ['noc', 'świt', 'dzień', 'zmierzch'] as const) {
        const result = speciesAdjustment(getSpecies(species), {
          locationType: 'morze',
          temperature: -5,
          phase,
          cloudCover: 95,
          windSpeed: 70,
          pressureChange24h: 20,
        });
        expect(Math.abs(result.delta)).toBeLessThanOrEqual(SPECIES_DELTA_LIMIT);
      }
    }
  });
});

describe('computeScore', () => {
  it('jest deterministyczny', () => {
    const a = computeScore(context(), 'szczupak');
    const b = computeScore(context(), 'szczupak');
    expect(a.score).toBe(b.score);
    expect(a.baseScore).toBe(b.baseScore);
  });

  it('zwraca wynik w zakresie 0-100 i pasującą etykietę', () => {
    const result = computeScore(context(), 'szczupak');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.label).toBe(ratingLabel(result.score));
  });

  it('wagi czynników bazowych sumują się do 100', () => {
    const result = computeScore(context(), 'szczupak');
    const sum = result.factors.reduce((total, factor) => total + factor.weight, 0);
    expect(sum).toBe(100);
  });

  it('dolicza komponent morski tylko wtedy, gdy są dane o fali', () => {
    const withWave = computeScore(
      context({ locationType: 'morze', waveHeight: 0.4, hour: hour({ time: '2026-09-11T12:00' }) }),
      'dorsz'
    );
    expect(withWave.marineIncluded).toBe(true);
    expect(withWave.factors.some((f) => f.key === 'wave')).toBe(true);
    expect(withWave.factors.reduce((total, f) => total + f.weight, 0)).toBe(115);

    const withoutWave = computeScore(
      context({ locationType: 'morze', waveHeight: null, hour: hour({ time: '2026-09-11T12:00' }) }),
      'dorsz'
    );
    expect(withoutWave.marineIncluded).toBe(false);
    expect(withoutWave.factors.some((f) => f.key === 'wave')).toBe(false);
    expect(withoutWave.warnings.length).toBeGreaterThan(0);
  });

  it('złe warunki dają wyraźnie niższy wynik niż dobre', () => {
    const good = computeScore(
      context({ hour: hour({ time: '2026-09-11T06:00' }) }),
      'szczupak'
    );
    const bad = computeScore(
      context({
        hour: hour({
          time: '2026-09-11T13:00',
          windSpeed: 55,
          windGusts: 90,
          precipitation: 9,
          weatherCode: 95,
          pressure: 985,
          temperature: 33,
          cloudCover: 100,
        }),
        pressureChange24h: -14,
        temperatureChange: 11,
        pressureRange: 16,
        windRange: 45,
      }),
      'szczupak'
    );
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.warnings.length).toBeGreaterThan(0);
  });

  it('zmiana gatunku zmienia wynik, ale nie czynniki bazowe', () => {
    const ctx = context({ hour: hour({ time: '2026-09-11T13:00', cloudCover: 10, temperature: 26 }) });
    const pike = computeScore(ctx, 'szczupak');
    const carp = computeScore(ctx, 'karp');
    expect(pike.baseScore).toBe(carp.baseScore);
    expect(pike.speciesDelta).not.toBe(carp.speciesDelta);
  });
});
