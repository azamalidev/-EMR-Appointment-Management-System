import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError, ValidationError, asAppError } from '../utils/errors.js';
import { fail } from '../utils/response.js';
import { env } from '../config/env.js';

/**
 * Centralized error handler — the LAST middleware in the chain.
 * Catches AppError, ZodError, Mongoose errors (11000 duplicate key, validation),
 * and unknown Errors; returns the standard envelope.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    if (env.isDev) console.error('[error] zod validation:', err.flatten());
    res
      .status(422)
      .json(fail(422, 'VALIDATION_ERROR', 'Validation failed', err.flatten().fieldErrors));
    return;
  }

  // Mongoose duplicate key (E11000) — typically from the BookedSlot unique guard.
  if (err instanceof mongoose.Error && (err as { code?: number }).code === 11000) {
    if (env.isDev) console.error('[error] duplicate key:', err);
    res
      .status(409)
      .json(fail(409, 'CONFLICT', 'Resource already exists', (err as { keyValue?: unknown }).keyValue));
    return;
  }
  // Mongoose validation errors.
  if (err instanceof mongoose.Error.ValidationError) {
    if (env.isDev) console.error('[error] mongoose validation:', err);
    res.status(422).json(fail(422, 'VALIDATION_ERROR', 'Validation failed', err.errors));
    return;
  }
  // Cast errors (bad ObjectId etc.)
  if (err instanceof mongoose.Error.CastError) {
    if (env.isDev) console.error('[error] mongoose cast:', err);
    res.status(400).json(fail(400, 'BAD_REQUEST', `Invalid ${err.path}: ${err.message}`));
    return;
  }
  // Raw Mongo driver duplicate-key
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    if (env.isDev) console.error('[error] mongo duplicate key:', err);
    res
      .status(409)
      .json(
        fail(409, 'CONFLICT', 'Resource already exists', (err as { keyValue?: unknown }).keyValue),
      );
    return;
  }

  const appErr = asAppError(err);
  if (env.isDev) {
    console.error('[error]', appErr.status, appErr.code, appErr.message);
    if (err instanceof Error && err.stack) console.error(err.stack);
  }
  res.status(appErr.status).json(fail(appErr.status, appErr.code, appErr.message, appErr.details));
}

/** Wrap an async request handler so thrown errors propagate to the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export { AppError, ValidationError };
