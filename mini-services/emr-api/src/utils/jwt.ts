import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Unauthorized } from './errors.js';

// StringValue literal types for jsonwebtoken's expiresIn option.
const ACCESS_TTL = '15m' as const;
const REFRESH_TTL = '7d' as const;

export type UserRole = 'SUPER_ADMIN' | 'RECEPTIONIST' | 'DOCTOR';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  doctorId?: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function signAccessToken(input: {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  doctorId?: string | null;
}): string {
  const payload: AccessTokenPayload = {
    sub: input.sub,
    role: input.role,
    email: input.email,
    name: input.name,
    doctorId: input.doctorId ?? null,
    type: 'access',
  };
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(sub: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub, jti, type: 'refresh' };
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwt.accessSecret) as jwt.JwtPayload;
  } catch {
    throw Unauthorized('Invalid or expired access token');
  }
  if (decoded.type !== 'access') {
    throw Unauthorized('Token is not an access token');
  }
  return decoded as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwt.refreshSecret) as jwt.JwtPayload;
  } catch {
    throw Unauthorized('Invalid or expired refresh token');
  }
  if (decoded.type !== 'refresh') {
    throw Unauthorized('Token is not a refresh token');
  }
  return decoded as unknown as RefreshTokenPayload;
}
