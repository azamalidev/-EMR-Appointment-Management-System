// Shared domain types (mirrors of Prisma enums for the frontend + API layer).

export type Role = "SUPER_ADMIN" | "RECEPTIONIST" | "DOCTOR";
export type AppointmentStatus =
  | "SCHEDULED"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
export type WeekDayShort =
  | "SUN"
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  RECEPTIONIST: "Receptionist",
  DOCTOR: "Doctor",
};

export const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; tone: string; dot: string }
> = {
  SCHEDULED: { label: "Scheduled", tone: "bg-zinc-100 text-zinc-600 border-zinc-200", dot: "bg-zinc-400" },
  ARRIVED: { label: "Arrived", tone: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  COMPLETED: { label: "Completed", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelled", tone: "bg-rose-50 text-rose-600 border-rose-200", dot: "bg-rose-400" },
  NO_SHOW: { label: "No Show", tone: "bg-zinc-100 text-zinc-400 border-zinc-200", dot: "bg-zinc-300" },
};

export const APPOINTMENT_STATUS_FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["ARRIVED", "CANCELLED", "NO_SHOW"],
  ARRIVED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// Audit action constants (single source of truth).
export const AUDIT = {
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_REFRESH: "AUTH_REFRESH",
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  APPOINTMENT_CREATED: "APPOINTMENT_CREATED",
  APPOINTMENT_UPDATED: "APPOINTMENT_UPDATED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  APPOINTMENT_ARRIVED: "APPOINTMENT_ARRIVED",
  APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED",
  PATIENT_CREATED: "PATIENT_CREATED",
  DOCTOR_CREATED: "DOCTOR_CREATED",
  SCHEDULE_UPDATED: "SCHEDULE_UPDATED",
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];
