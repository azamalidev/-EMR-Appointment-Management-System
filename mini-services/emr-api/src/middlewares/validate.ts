import type { Request, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Validate req.body against a zod schema; throws ValidationError(422) on failure.
 * Strips unknown keys (zod's default behavior with the schema).
 */
export function parseBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(ValidationError('Body validation failed', result.error.flatten().fieldErrors));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate req.query against a zod schema. Coerces all query values to the
 * types declared in the schema (zod's `coerce` does this).
 */
export function parseQuery(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(ValidationError('Query validation failed', result.error.flatten().fieldErrors));
    }
    // Re-assign parsed query back to req.query (cast-around Express v5 readonly typing).
    (req as unknown as { query: Record<string, unknown> }).query = result.data as Record<
      string,
      unknown
    >;
    next();
  };
}
