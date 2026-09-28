import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { User } from './types.js';

// A fixed secret is fine for a test/demo system under test. Never do this in production.
export const JWT_SECRET = process.env.JWT_SECRET ?? 'agentpay-dev-secret';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export interface TokenClaims {
  sub: number;
  role: User['role'];
  agentId: number | null;
}

export function signToken(user: User): string {
  const claims: TokenClaims = { sub: user.id, role: user.role, agentId: user.agentId };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: '2h' });
}

export function verifyToken(token: string): TokenClaims | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as TokenClaims;
  } catch {
    return null;
  }
}
