import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { ScheduleSession } from '../models/ScheduleSession.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { hashPassword } from '../utils/crypto.js';
import {
  BadRequest,
  Conflict,
  NotFound,
  ValidationError,
} from '../utils/errors.js';
import { audit } from './audit.service.js';
import { broadcast } from '../utils/realtime.js';
import { generateSlots, timeToMinutes } from '../utils/slots.js';
import type { RequestContext } from '../types.js';
import type { UpsertScheduleInput } from '../validators/schemas.js';

export async function listDoctors(): Promise<unknown[]> {
  const doctors = await Doctor.find({ isActive: true })
    .populate({ path: 'departmentId', select: 'name description' })
    .lean();
  // Attach schedules with sessions for each doctor.
  const ids = doctors.map((d) => d._id);
  const schedules = await DoctorSchedule.find({ doctorId: { $in: ids } }).lean();
  const scheduleIds = schedules.map((s) => s._id);
  const sessions = await ScheduleSession.find({ scheduleId: { $in: scheduleIds } })
    .sort({ sortOrder: 1 })
    .lean();
  const sessionBySchedule = new Map<string, unknown[]>();
  for (const s of sessions) {
    const arr = sessionBySchedule.get(String(s.scheduleId)) ?? [];
    arr.push(s);
    sessionBySchedule.set(String(s.scheduleId), arr);
  }
  return doctors.map((d) => {
    const dept = d.departmentId as any;
    return {
      ...d,
      id: String(d._id),
      departmentId: dept ? String(dept._id) : undefined,
      department: dept ? { id: String(dept._id), name: dept.name, description: dept.description } : undefined,
      schedules: schedules
        .filter((s) => String(s.doctorId) === String(d._id))
        .map((s) => ({
          ...s,
          id: String(s._id),
          sessions: sessionBySchedule.get(String(s._id)) ?? [],
        })),
    };
  });
}

export async function getDoctor(id: string): Promise<unknown> {
  const d = await Doctor.findById(id)
    .populate({ path: 'departmentId', select: 'name description' })
    .lean();
  if (!d) throw NotFound('Doctor not found');
  return { ...d, id: String(d._id) };
}

export async function createDoctor(
  input: {
    email: string;
    password: string;
    name: string;
    departmentId: string;
    specialization?: string;
    qualification?: string;
    bio?: string;
    consultationFee?: number;
  },
  ctx: RequestContext | undefined,
): Promise<{ user: unknown; doctor: unknown }> {
  const dept = await Department.findById(input.departmentId);
  if (!dept) throw NotFound('Department not found');

  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw Conflict('Email already in use');

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: 'DOCTOR',
    isActive: true,
  });

  try {
    const doctor = await Doctor.create({
      userId: user._id,
      name: input.name,
      departmentId: input.departmentId,
      specialization: input.specialization,
      qualification: input.qualification,
      bio: input.bio,
      consultationFee: input.consultationFee,
      isActive: true,
    });
    await audit(
      'DOCTOR_CREATED',
      'Doctor',
      String(doctor._id),
      { userId: String(user._id), name: input.name, departmentId: input.departmentId },
      ctx,
    );
    broadcast('doctor:created', { doctorId: String(doctor._id), name: input.name });
    return {
      user: { id: String(user._id), email: user.email, name: user.name, role: user.role },
      doctor: { ...doctor.toObject(), id: String(doctor._id) },
    };
  } catch (e) {
    await User.deleteOne({ _id: user._id });
    throw e;
  }
}

function validateSessions(sessions: UpsertScheduleInput['sessions']): void {
  // start < end already enforced by zod. Check no overlaps within same type.
  const byType = new Map<string, { start: number; end: number }[]>();
  for (const s of sessions) {
    const arr = byType.get(s.type) ?? [];
    arr.push({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) });
    byType.set(s.type, arr);
  }
  for (const [, arr] of byType) {
    arr.sort((a, b) => a.start - b.start);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].start < arr[i - 1].end) {
        throw ValidationError('Sessions of the same type must not overlap');
      }
    }
  }
  // Also: BREAK windows must be inside a WORK window (sensible schedule).
  const work = (byType.get('WORK') ?? []).sort((a, b) => a.start - b.start);
  const breaks = byType.get('BREAK') ?? [];
  for (const b of breaks) {
    const inside = work.some((w) => b.start >= w.start && b.end <= w.end);
    if (!inside) {
      throw BadRequest('BREAK sessions must be inside a WORK session window');
    }
  }
}

export async function upsertSchedule(
  doctorId: string,
  input: UpsertScheduleInput,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw NotFound('Doctor not found');

  validateSessions(input.sessions);

  // Upsert DoctorSchedule
  let schedule = await DoctorSchedule.findOne({ doctorId, dayOfWeek: input.dayOfWeek });
  if (!schedule) {
    schedule = await DoctorSchedule.create({
      doctorId,
      dayOfWeek: input.dayOfWeek,
      slotDurationMinutes: input.slotDurationMinutes ?? 15,
      isActive: input.isActive ?? true,
    });
  } else {
    if (input.slotDurationMinutes !== undefined)
      schedule.slotDurationMinutes = input.slotDurationMinutes;
    if (input.isActive !== undefined) schedule.isActive = input.isActive;
    schedule.updatedAt = new Date();
    await schedule.save();
  }

  // Replace sessions atomically.
  await ScheduleSession.deleteMany({ scheduleId: schedule._id });
  if (input.sessions.length > 0) {
    await ScheduleSession.insertMany(
      input.sessions.map((s, i) => ({
        scheduleId: schedule!._id,
        name: s.name,
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: s.sortOrder ?? i,
      })),
    );
  }

  const sessions = await ScheduleSession.find({ scheduleId: schedule._id })
    .sort({ sortOrder: 1 })
    .lean();
  const slots = generateSlots(
    sessions.map((s) => ({ type: s.type, startTime: s.startTime, endTime: s.endTime })),
    schedule.slotDurationMinutes,
  );

  await audit(
    'SCHEDULE_UPSERTED',
    'DoctorSchedule',
    String(schedule._id),
    { doctorId, dayOfWeek: input.dayOfWeek, sessionsCount: sessions.length },
    ctx,
  );

  broadcast('schedule:updated', { doctorId, dayOfWeek: input.dayOfWeek });

  return {
    schedule: { ...schedule.toObject(), id: String(schedule._id) },
    sessions: sessions.map((s) => ({ ...s, id: String(s._id) })),
    previewSlots: slots,
  };
}

export async function listSchedules(doctorId: string): Promise<unknown[]> {
  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) throw NotFound('Doctor not found');
  const schedules = await DoctorSchedule.find({ doctorId }).lean();
  const scheduleIds = schedules.map((s) => s._id);
  const sessions = await ScheduleSession.find({ scheduleId: { $in: scheduleIds } })
    .sort({ sortOrder: 1 })
    .lean();
  return schedules.map((s) => ({
    ...s,
    id: String(s._id),
    sessions: sessions
      .filter((sess) => String(sess.scheduleId) === String(s._id))
      .map((sess) => ({ ...sess, id: String(sess._id) })),
  }));
}

export async function deleteSchedule(
  doctorId: string,
  dayOfWeek: string,
  ctx: RequestContext | undefined,
): Promise<void> {
  const schedule = await DoctorSchedule.findOne({ doctorId, dayOfWeek });
  if (!schedule) throw NotFound('Schedule not found');
  await ScheduleSession.deleteMany({ scheduleId: schedule._id });
  await DoctorSchedule.deleteOne({ _id: schedule._id });
  await audit('SCHEDULE_DELETED', 'DoctorSchedule', String(schedule._id), { doctorId, dayOfWeek }, ctx);
  broadcast('schedule:deleted', { doctorId, dayOfWeek });
}
