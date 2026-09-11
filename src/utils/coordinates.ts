/**
 * Parsowanie współrzędnych wpisanych ręcznie.
 *
 * Akceptuje zapisy, które realnie kopiuje się z map i czatów:
 * "54.1943, 16.2207", "54,1943 16,2207", "54.19 N 16.22 E".
 * Zwraca null, gdy nie da się odczytać dwóch liczb albo są poza zakresem.
 */
export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const normalized = input
    .replace(/[NnEe]/g, ' ')
    .replace(/°/g, ' ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .trim();

  const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return null;

  const latitude = Number.parseFloat(matches[0]);
  const longitude = Number.parseFloat(matches[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    latitude: Math.round(latitude * 10000) / 10000,
    longitude: Math.round(longitude * 10000) / 10000,
  };
}
