/**
 * Rejestracja service workera odpowiadającego za offline'owy cache interfejsu.
 * Rejestrujemy tylko w buildzie produkcyjnym — w trybie dev SW potrafi
 * przesłonić hot reload i mocno utrudnić pracę.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Brak SW oznacza tylko brak trybu offline — aplikacja działa normalnie.
    });
  });
}
