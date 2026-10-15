import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env.js';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.bcryptCost);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** SHA-256 hex digest for refresh token hashing. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Cryptographically-strong random refresh token (base64url, ~64 chars). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}
