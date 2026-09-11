import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from './errors.js';
import {
  asObject,
  isUuid,
  optionalString,
  requireEmail,
  requireNumber,
  requireSpotType,
  requireString,
  requireUuid,
} from './validate.js';

/** Pomocnik: sprawdza, że wywołanie rzuca HttpError o podanym kodzie HTTP. */
function rejects(fn: () => unknown, status = 400): void {
  assert.throws(fn, (error: unknown) => error instanceof HttpError && error.statusCode === status);
}

describe('asObject', () => {
  it('przepuszcza zwykły obiekt', () => {
    assert.deepEqual(asObject({ a: 1 }), { a: 1 });
  });

  it('odrzuca tablicę, null i tekst', () => {
    rejects(() => asObject([1, 2]));
    rejects(() => asObject(null));
    rejects(() => asObject('{"a":1}'));
  });
});

describe('requireString', () => {
  it('przycina białe znaki', () => {
    assert.equal(requireString({ name: '  Jamno  ' }, 'name'), 'Jamno');
  });

  it('pilnuje długości', () => {
    rejects(() => requireString({ name: 'a' }, 'name', { min: 2 }));
    rejects(() => requireString({ name: 'a'.repeat(90) }, 'name', { max: 80 }));
  });

  it('odrzuca brak pola i zły typ', () => {
    rejects(() => requireString({}, 'name'));
    rejects(() => requireString({ name: 42 }, 'name'));
  });
});

describe('optionalString', () => {
  it('zamienia pustkę na null', () => {
    assert.equal(optionalString({}, 'note'), null);
    assert.equal(optionalString({ note: '' }, 'note'), null);
    assert.equal(optionalString({ note: '   ' }, 'note'), null);
  });

  it('zwraca przyciętą wartość', () => {
    assert.equal(optionalString({ note: ' opis ' }, 'note'), 'opis');
  });
});

describe('requireNumber', () => {
  it('akceptuje liczby i teksty liczbowe, także z przecinkiem', () => {
    assert.equal(requireNumber({ lat: 54.19 }, 'lat'), 54.19);
    assert.equal(requireNumber({ lat: '54.19' }, 'lat'), 54.19);
    assert.equal(requireNumber({ lat: '54,19' }, 'lat'), 54.19);
  });

  it('pilnuje zakresu', () => {
    rejects(() => requireNumber({ lat: 120 }, 'lat', { min: -90, max: 90 }));
    rejects(() => requireNumber({ lat: -120 }, 'lat', { min: -90, max: 90 }));
  });

  it('odrzuca NaN i nie-liczby', () => {
    rejects(() => requireNumber({ lat: 'gdzieś' }, 'lat'));
    rejects(() => requireNumber({ lat: Number.NaN }, 'lat'));
    rejects(() => requireNumber({}, 'lat'));
  });
});

describe('requireSpotType', () => {
  it('przepuszcza trzy dozwolone typy', () => {
    assert.equal(requireSpotType({ type: 'jezioro' }), 'jezioro');
    assert.equal(requireSpotType({ type: 'rzeka' }), 'rzeka');
    assert.equal(requireSpotType({ type: 'morze' }), 'morze');
  });

  it('odrzuca cokolwiek innego', () => {
    rejects(() => requireSpotType({ type: 'staw' }));
    rejects(() => requireSpotType({}));
  });
});

describe('requireEmail', () => {
  it('normalizuje do małych liter', () => {
    assert.equal(requireEmail({ email: '  Kacper@Example.COM ' }), 'kacper@example.com');
  });

  it('odrzuca adresy bez sensu', () => {
    rejects(() => requireEmail({ email: 'kacper' }));
    rejects(() => requireEmail({ email: 'kacper@' }));
    rejects(() => requireEmail({ email: 'kacper@example' }));
    rejects(() => requireEmail({ email: 'a b@example.com' }));
  });
});

describe('uuid', () => {
  it('rozpoznaje poprawny identyfikator', () => {
    assert.equal(isUuid('11111111-1111-4111-8111-111111111111'), true);
    assert.equal(requireUuid('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111');
  });

  it('odrzuca podszywanie się i wstrzyknięcia', () => {
    assert.equal(isUuid("1' OR '1'='1"), false);
    assert.equal(isUuid('../../etc/passwd'), false);
    assert.equal(isUuid(''), false);
    rejects(() => requireUuid('nie-uuid'));
  });
});
