import bcrypt from 'bcryptjs';
import { badRequest } from './errors.js';

/**
 * bcryptjs, a nie bcrypt: czysty JavaScript, bez kompilacji natywnej.
 * W obrazie alpine oszczędza to instalowania python3/make/g++ i całej klasy
 * problemów z node-gyp przy każdej zmianie wersji Node.
 */
const COST = 12;

/** Minimalna długość hasła. Krótkie hasła odrzucamy po stronie serwera, nie tylko w formularzu. */
export const MIN_PASSWORD_LENGTH = 10;

export function assertPasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
  }
  if (password.length > 200) {
    throw badRequest('Hasło jest absurdalnie długie — maksimum to 200 znaków.');
  }
  if (/^\s|\s$/.test(password)) {
    throw badRequest('Hasło nie może zaczynać się ani kończyć spacją.');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
