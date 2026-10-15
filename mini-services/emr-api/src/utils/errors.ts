export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', msg, details);
export const Unauthorized = (msg = 'Unauthorized', details?: unknown) =>
  new AppError(401, 'UNAUTHORIZED', msg, details);
export const Forbidden = (msg = 'Forbidden', details?: unknown) =>
  new AppError(403, 'FORBIDDEN', msg, details);
export const NotFound = (msg = 'Not found', details?: unknown) =>
  new AppError(404, 'NOT_FOUND', msg, details);
export const ValidationError = (msg = 'Validation failed', details?: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', msg, details);
export const Conflict = (msg = 'Conflict', details?: unknown) =>
  new AppError(409, 'CONFLICT', msg, details);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function asAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof Error) {
    return new AppError(500, 'INTERNAL_ERROR', e.message || 'Internal server error');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
}
