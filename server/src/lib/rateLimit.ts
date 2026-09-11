/**
 * Prościutki limiter w pamięci procesu — okno stałej długości na klucz.
 *
 * Świadomie bez dodatkowej zależności i bez Redisa: aplikacja działa w jednym
 * procesie w LAN-ie, a jedyne, przed czym realnie chroni, to zgadywanie haseł.
 * Restart kontenera czyści liczniki i to jest akceptowalne.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Zwraca liczbę sekund do końca blokady albo null, gdy żądanie mieści się w limicie. */
  check(key: string, now = Date.now()): number | null {
    this.sweep(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return null;
    }
    if (bucket.count >= this.limit) {
      return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    }
    bucket.count += 1;
    return null;
  }

  /** Udana operacja zeruje licznik — poprawne logowanie nie ma się wliczać do limitu. */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  private sweep(now: number): void {
    if (this.buckets.size < 500) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
