import type { Response } from 'express';
import { env } from '../config/env.js';

export interface ApiEnvelope<T = unknown, M = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export function ok<T, M = unknown>(
  res: Response,
  data: T,
  message = 'OK',
  meta?: M,
  status = 200,
): Response {
  const body: ApiEnvelope<T, M> = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function created<T, M = unknown>(
  res: Response,
  data: T,
  message = 'Created',
  meta?: M,
): Response {
  return ok(res, data, message, meta, 201);
}

export interface PaginationMeta {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export function pageMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const totalPages = pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
  return { pagination: { total, page, pageSize, totalPages } };
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    success: false,
    message,
    data: null,
    meta: { code, status },
  };
  if (env.isDev && details !== undefined) {
    body.details = details;
  }
  return body;
}
