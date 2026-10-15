import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError, Unauthorized } from '../utils/errors.js';

export type Role = 'SUPER_ADMIN' | 'RECEPTIONIST' | 'DOCTOR';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
  doctorId: string | null;
}

export interface RequestContext {
  user?: AuthUser;
  ip?: string;
  userAgent?: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  ctx?: RequestContext;
}

/** Extract client IP from common proxy headers, falling back to req.ip. */
function extractIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() ?? '';
  if (Array.isArray(xff) && xff.length) return xff[0] ?? '';
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string') return xri.trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function extractUserAgent(req: Request): string {
  return (req.headers['user-agent'] as string) ?? 'unknown';
}

/**
 * Middleware: require a valid Bearer access token; load the user from DB
 * and attach an AuthUser object to req.user. Also populates req.ctx.
 */
export const requireUser: RequestHandler = async (req: AuthedRequest, _res, next) => {
  try {
    // Always populate ctx for downstream audit logging.
    const ctx: RequestContext = { ip: extractIp(req), userAgent: extractUserAgent(req) };
    req.ctx = ctx;

    const header = req.headers.authorization;
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return next(Unauthorized('Missing Authorization header'));
    }

    let payload;
    try {
      payload = verifyAccessToken(match[1]);
    } catch (e) {
      return next(e instanceof Error ? e : Unauthorized('Invalid or expired token'));
    }

    const user = await User.findById(payload.sub)
      .select('_id role email name isActive')
      .populate({ path: 'doctor', select: '_id' });
    if (!user || !user.isActive) {
      return next(Unauthorized('User not found or inactive'));
    }

    const doctorId = extractDoctorId(user);

    req.user = {
      id: String(user._id),
      role: user.role,
      email: user.email,
      name: user.name,
      doctorId,
    };
    ctx.user = req.user;

    next();
  } catch (err) {
    next(err instanceof Error ? err : new AppError(500, 'INTERNAL_ERROR', 'Auth failure'));
  }
};

/**
 * Optional auth: attaches req.user if a valid token is present, otherwise continues.
 */
export const optionalUser: RequestHandler = async (req: AuthedRequest, _res, next) => {
  try {
    req.ctx = { ip: extractIp(req), userAgent: extractUserAgent(req) };
    const header = req.headers.authorization;
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) return next();
    try {
      const payload = verifyAccessToken(match[1]);
      const user = await User.findById(payload.sub)
        .select('_id role email name isActive')
        .populate({ path: 'doctor', select: '_id' });
      if (user && user.isActive) {
        const doctorId = extractDoctorId(user);
        req.user = {
          id: String(user._id),
          role: user.role,
          email: user.email,
          name: user.name,
          doctorId,
        };
        req.ctx.user = req.user;
      }
    } catch {
      /* ignore — optional */
    }
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error('Auth failure'));
  }
};

// Helper to safely extract the doctorId virtual from a populated User document.
function extractDoctorId(user: unknown): string | null {
  const u = user as { doctor?: unknown };
  if (!u.doctor) return null;
  if (typeof u.doctor !== 'object') return null;
  const d = u.doctor as { _id?: { toString(): string }; id?: string };
  if (d._id) return String(d._id);
  if (d.id) return String(d.id);
  return null;
}
