import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RateLimiter } from './rateLimit.js';

describe('RateLimiter', () => {
  it('przepuszcza dokładnie tyle żądań, ile wynosi limit', () => {
    const limiter = new RateLimiter(3, 60_000);
    const now = 1_000_000;
    assert.equal(limiter.check('ip', now), null);
    assert.equal(limiter.check('ip', now), null);
    assert.equal(limiter.check('ip', now), null);
    assert.notEqual(limiter.check('ip', now), null);
  });

  it('zwraca liczbę sekund do końca blokady', () => {
    const limiter = new RateLimiter(1, 30_000);
    const now = 1_000_000;
    limiter.check('ip', now);
    const retryAfter = limiter.check('ip', now + 10_000);
    assert.equal(typeof retryAfter, 'number');
    assert.ok(retryAfter !== null && retryAfter > 0 && retryAfter <= 30);
  });

  it('zwalnia po upływie okna', () => {
    const limiter = new RateLimiter(1, 10_000);
    const now = 1_000_000;
    limiter.check('ip', now);
    assert.notEqual(limiter.check('ip', now + 5_000), null);
    assert.equal(limiter.check('ip', now + 10_001), null);
  });

  it('liczy osobno dla różnych kluczy', () => {
    const limiter = new RateLimiter(1, 60_000);
    const now = 1_000_000;
    assert.equal(limiter.check('a', now), null);
    assert.equal(limiter.check('b', now), null);
    assert.notEqual(limiter.check('a', now), null);
  });

  it('reset zeruje licznik — udane logowanie nie wlicza się do limitu', () => {
    const limiter = new RateLimiter(2, 60_000);
    const now = 1_000_000;
    limiter.check('ip', now);
    limiter.check('ip', now);
    assert.notEqual(limiter.check('ip', now), null);
    limiter.reset('ip');
    assert.equal(limiter.check('ip', now), null);
  });
});
