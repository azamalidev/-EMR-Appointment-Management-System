// Shared domain types used across services & controllers.
import type { Document } from 'mongoose';

export type Role = 'SUPER_ADMIN' | 'RECEPTIONIST' | 'DOCTOR';
export type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
export type SessionType = 'WORK' | 'BREAK';
export type AppointmentStatus =
  | 'SCHEDULED'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

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

export interface AuthedRequest {
  user?: AuthUser;
  ctx?: RequestContext;
  // Express req fields we use:
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}

// Helper for stripping mongoose doc internals.
export function lean<T extends Document>(doc: T): T {
  return doc.toObject ? (doc.toObject() as T) : doc;
}
