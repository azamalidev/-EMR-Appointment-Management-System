import type { RequestHandler } from 'express';
import { AppError, Forbidden, Unauthorized } from '../utils/errors.js';
import type { AuthedRequest, Role } from './auth.js';

/**
 * Role-based access control middleware factory.
 * Usage: router.post('/x', requireUser, requireRole('SUPER_ADMIN'), handler)
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const r = req as AuthedRequest;
    if (!r.user) {
      return next(Unauthorized('Not authenticated'));
    }
    if (!roles.includes(r.user.role)) {
      return next(Forbidden(`Role ${r.user.role} not permitted`));
    }
    next();
  };
}

/** Convenience: must be at least the given role. */
export function requireAtLeastRole(min: Role): RequestHandler {
  const order: Role[] = ['DOCTOR', 'RECEPTIONIST', 'SUPER_ADMIN'];
  return (req, _res, next) => {
    const r = req as AuthedRequest;
    if (!r.user) return next(Unauthorized('Not authenticated'));
    const uIdx = order.indexOf(r.user.role);
    const mIdx = order.indexOf(min);
    if (uIdx < mIdx) return next(new AppError(403, 'FORBIDDEN', 'Insufficient role'));
    next();
  };
}
