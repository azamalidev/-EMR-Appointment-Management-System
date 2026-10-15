import { z } from 'zod';

const roleEnum = z.enum(['SUPER_ADMIN', 'RECEPTIONIST', 'DOCTOR']);
const dayEnum = z.enum(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
const statusEnum = z.enum(['SCHEDULED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);
const sessionTypeEnum = z.enum(['WORK', 'BREAK']);
const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);

// Time string "HH:mm" with 24h validation.
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm in 24h format');

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

const objectId = z
  .string()
  .length(24, 'Must be a 24-char hex ObjectId')
  .or(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'));

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  description: z.string().max(500).optional(),
});

export const createReceptionistSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(128),
  name: z.string().min(2).max(80).trim(),
});

export const createDoctorSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(128),
  name: z.string().min(2).max(80).trim(),
  departmentId: objectId,
  specialization: z.string().max(120).optional(),
  qualification: z.string().max(120).optional(),
  bio: z.string().max(1000).optional(),
  consultationFee: z.number().nonnegative().optional(),
});

const sessionSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: sessionTypeEnum,
    startTime: timeString,
    endTime: timeString,
    sortOrder: z.number().int().optional(),
  })
  .refine((s) => timeLt(s.startTime, s.endTime), {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

export const upsertScheduleSchema = z.object({
  dayOfWeek: dayEnum,
  slotDurationMinutes: z.number().int().min(5).max(120).optional(),
  isActive: z.boolean().optional(),
  sessions: z.array(sessionSchema).min(1, 'At least one session is required'),
});

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(60).trim(),
  lastName: z.string().min(1).max(60).trim(),
  mobile: z.string().min(6).max(20).trim(),
  email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
  gender: genderEnum.optional(),
  dob: z.string().datetime().optional(),
  address: z.string().max(300).optional(),
});

export const createAppointmentSchema = z.object({
  doctorId: objectId,
  date: dateKey,
  slotStart: timeString,
  slotEnd: timeString,
  purpose: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
  // Either patientId OR newPatient payload must be provided.
  patientId: objectId.optional(),
  newPatient: createPatientSchema.optional(),
});

export const updateAppointmentSchema = z.object({
  purpose: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
  consultationNotes: z.string().max(5000).optional(),
  status: statusEnum.optional(),
  cancelReason: z.string().max(500).optional(),
});

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z
    .enum(['date', 'createdAt', 'patientName', 'status', 'doctorName'])
    .default('date'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  doctorId: objectId.optional(),
  departmentId: objectId.optional(),
  status: statusEnum.optional(),
  dateFrom: dateKey.optional(),
  dateTo: dateKey.optional(),
});

export const slotsQuerySchema = z.object({
  doctorId: objectId,
  date: dateKey,
});

export const patientsQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  action: z.string().optional(),
  entity: z.string().optional(),
  userId: objectId.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// helper used by refine above
function timeLt(a: string, b: string): boolean {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah * 60 + am < bh * 60 + bm;
}

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type CreateReceptionistInput = z.infer<typeof createReceptionistSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpsertScheduleInput = z.infer<typeof upsertScheduleSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type PatientsQuery = z.infer<typeof patientsQuerySchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;

// Re-export enums for convenience.
export const RoleEnum = roleEnum;
export const DayEnum = dayEnum;
export const StatusEnum = statusEnum;
