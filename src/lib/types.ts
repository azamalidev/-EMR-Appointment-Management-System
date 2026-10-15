/**
 * Frontend types — mirrors of the API responses. Keeping them here (instead of
 * importing Prisma generated types) keeps the client bundle clean and decoupled
 * from the DB layer.
 */
import type { Role, AppointmentStatus } from "@/lib/constants";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
  doctorId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  _count?: { doctors: number };
}

export interface ScheduleSession {
  id?: string;
  name: string;
  type: "WORK" | "BREAK";
  startTime: string;
  endTime: string;
  sortOrder: number;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
  slotDurationMinutes: number;
  isActive: boolean;
  sessions: ScheduleSession[];
}

export interface Doctor {
  id: string;
  name: string;
  departmentId: string;
  specialization?: string | null;
  qualification?: string | null;
  bio?: string | null;
  consultationFee?: number | null;
  isActive: boolean;
  department?: { id: string; name: string };
  schedules?: DoctorSchedule[];
}

export interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  dob?: string | null;
  address?: string | null;
  createdAt?: string;
}

export interface SlotItem {
  start: string;
  end: string;
  available: boolean;
  isPast: boolean;
  appointmentId?: string;
}

export interface SlotsResponse {
  doctorId: string;
  date: string;
  slotDurationMinutes: number;
  slots: SlotItem[];
}

export interface Appointment {
  id: string;
  appointmentCode: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  status: AppointmentStatus;
  purpose?: string | null;
  notes?: string | null;
  consultationNotes?: string | null;
  bookedAt: string;
  arrivedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Pick<Patient, "id" | "patientCode" | "firstName" | "lastName" | "mobile">;
  doctor?: { id: string; name: string; specialization?: string | null };
  department?: { id: string; name: string };
}

export interface PaginationMeta {
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  userRole: Role | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
  ip: string | null;
  userAgent: string | null;
  timestamp: string;
}

export interface DashboardStats {
  totalAppointments: number;
  todayAppointments: number;
  arrivedToday: number;
  completedToday: number;
  cancelledToday: number;
  scheduledToday: number;
  patientsCount: number;
  doctorsCount: number;
  todayKey: string;
  recentAppointments: Appointment[];
  hourly: { hour: number; count: number }[];
}
