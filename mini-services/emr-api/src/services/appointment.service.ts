import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { BookedSlot } from '../models/BookedSlot.js';
import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { ScheduleSession } from '../models/ScheduleSession.js';
import { Patient } from '../models/Patient.js';
import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  ValidationError,
} from '../utils/errors.js';
import {
  fromDateKey,
  generateSlots,
  isPastDate,
  isPastSlot,
  startOfDay,
  weekdayOf,
} from '../utils/slots.js';
import { audit } from './audit.service.js';
import { findOrCreatePatient } from './patient.service.js';
import { broadcast } from '../utils/realtime.js';
import type { RequestContext } from '../types.js';
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from '../validators/schemas.js';

interface MongoDuplicateError {
  code?: number;
  keyValue?: Record<string, unknown>;
  message?: string;
}

function isDuplicateKeyError(e: unknown): e is MongoDuplicateError {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: number }).code === 11000
  );
}

/**
 * Transform a Mongoose appointment document (with populated patientId/doctorId/
 * departmentId) into the clean API response shape the frontend expects:
 *   patientId → patient, doctorId → doctor, departmentId → department
 *   _id → id
 */
function transformAppointment(a: any): unknown {
  if (!a) return a;
  return {
    id: a._id ?? a.id,
    appointmentCode: a.appointmentCode,
    patientId: a.patientId?._id ?? a.patientId,
    doctorId: a.doctorId?._id ?? a.doctorId,
    departmentId: a.departmentId?._id ?? a.departmentId,
    date: a.date,
    slotStart: a.slotStart,
    slotEnd: a.slotEnd,
    status: a.status,
    purpose: a.purpose,
    notes: a.notes,
    consultationNotes: a.consultationNotes,
    bookedById: a.bookedById,
    bookedAt: a.bookedAt,
    arrivedAt: a.arrivedAt,
    completedAt: a.completedAt,
    cancelledAt: a.cancelledAt,
    cancelledById: a.cancelledById,
    cancelReason: a.cancelReason,
    updatedById: a.updatedById,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    patient: a.patientId && typeof a.patientId === 'object' ? a.patientId : undefined,
    doctor: a.doctorId && typeof a.doctorId === 'object' ? a.doctorId : undefined,
    department: a.departmentId && typeof a.departmentId === 'object' ? a.departmentId : undefined,
  };
}

async function nextAppointmentCode(): Promise<string> {
  const last = await Appointment.findOne({})
    .sort({ appointmentCode: -1 })
    .select('appointmentCode')
    .lean();
  let next = 1;
  if (last && typeof last.appointmentCode === 'string') {
    const m = last.appointmentCode.match(/^AP-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `AP-${String(next).padStart(5, '0')}`;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  // 1. Validate doctor exists + active.
  const doctor = await Doctor.findById(input.doctorId).lean();
  if (!doctor) throw NotFound('Doctor not found');
  if (!doctor.isActive) throw BadRequest('Doctor is not active');

  // 2. Validate date not in past.
  if (isPastDate(input.date)) {
    throw BadRequest('Cannot book an appointment in the past');
  }

  // 3. Load doctor schedule for that weekday; generate valid slots.
  const date = fromDateKey(input.date);
  const dayOfWeek = weekdayOf(date);
  const schedule = await DoctorSchedule.findOne({
    doctorId: input.doctorId,
    dayOfWeek,
    isActive: true,
  }).lean();
  if (!schedule) {
    throw NotFound(`No active schedule for ${dayOfWeek}`);
  }
  const sessions = await ScheduleSession.find({ scheduleId: schedule._id })
    .sort({ sortOrder: 1 })
    .lean();
  const validSlots = generateSlots(
    sessions.map((s) => ({ type: s.type, startTime: s.startTime, endTime: s.endTime })),
    schedule.slotDurationMinutes,
  );
  const matchedSlot = validSlots.find(
    (s) => s.start === input.slotStart && s.end === input.slotEnd,
  );
  if (!matchedSlot) {
    throw ValidationError('Requested slot is not valid for this doctor on this date', {
      validSlots: validSlots.map((s) => `${s.start}-${s.end}`),
    });
  }

  // 4. Reject past time slot.
  if (isPastSlot(input.date, input.slotStart)) {
    throw BadRequest('Cannot book a slot that has already passed');
  }

  // 5. Find or create patient (no transaction needed — patient exists or is created atomically).
  const patient = await findOrCreatePatient(
    { patientId: input.patientId, newPatient: input.newPatient },
    ctx,
  );

  // 6. CONCURRENCY-SAFE BOOKING:
  //    - Create the BookedSlot FIRST. The unique compound index
  //      { doctorId, date, slotStart } is the SOLE concurrency boundary.
  //    - If a concurrent insert exists, Mongoose throws E11000 → 409 Conflict.
  //    - Only after the BookedSlot is secured, create the Appointment.
  //    - If the Appointment insert fails, delete the BookedSlot to free the slot.
  const dateMidnight = startOfDay(date);
  const appointmentCode = await nextAppointmentCode();

  let bookedSlot;
  try {
    bookedSlot = await BookedSlot.create({
      doctorId: input.doctorId,
      date: dateMidnight,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      // placeholder — will set the real appointmentId below.
      appointmentId: new mongoose.Types.ObjectId(),
    });
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      throw Conflict('This slot was just booked by someone else');
    }
    throw e;
  }

  // Now create the appointment and link it back to the BookedSlot.
  let appointment;
  try {
    appointment = await Appointment.create({
      appointmentCode,
      patientId: patient.id,
      doctorId: input.doctorId,
      departmentId: doctor.departmentId,
      date: dateMidnight,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      status: 'SCHEDULED',
      purpose: input.purpose,
      notes: input.notes,
      bookedById: ctx?.user?.id,
      bookedAt: new Date(),
    });

    // Patch the BookedSlot with the real appointmentId.
    bookedSlot.appointmentId = appointment._id as mongoose.Types.ObjectId;
    await bookedSlot.save();
  } catch (e) {
    // Roll back the placeholder BookedSlot to free the slot.
    try {
      await BookedSlot.deleteOne({ _id: bookedSlot._id });
    } catch {
      /* best effort */
    }
    if (isDuplicateKeyError(e)) {
      // unlikely: someone raced us for the appointmentCode, but still 409
      throw Conflict('This slot was just booked by someone else');
    }
    throw e;
  }

  const populated = await Appointment.findById(appointment._id)
    .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
    .populate({ path: 'doctorId', select: 'name specialization' })
    .populate({ path: 'departmentId', select: 'name' })
    .lean();

  await audit(
    'APPOINTMENT_CREATED',
    'Appointment',
    String(appointment._id),
    {
      appointmentCode,
      patientId: patient.id,
      doctorId: input.doctorId,
      date: input.date,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
    },
    ctx,
  );

  broadcast('appointment:created', {
    id: String(appointment._id),
    appointmentCode,
    patientId: patient.id,
    doctorId: input.doctorId,
    date: input.date,
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    status: 'SCHEDULED',
  });

  return transformAppointment(populated);
}

interface ListResult {
  items: unknown[];
  total: number;
}

export async function listAppointments(
  params: ListAppointmentsQuery,
  viewer?: RequestContext['user'],
): Promise<ListResult> {
  const filter: Record<string, unknown> = {};

  // Doctor scope: only their own appointments.
  if (viewer && viewer.role === 'DOCTOR' && viewer.doctorId) {
    filter.doctorId = viewer.doctorId;
  } else if (params.doctorId) {
    filter.doctorId = params.doctorId;
  }
  if (params.departmentId) filter.departmentId = params.departmentId;
  if (params.status) filter.status = params.status;

  if (params.dateFrom || params.dateTo) {
    const d: Record<string, Date> = {};
    if (params.dateFrom) d.$gte = startOfDay(fromDateKey(params.dateFrom));
    if (params.dateTo) {
      const end = fromDateKey(params.dateTo);
      end.setHours(23, 59, 59, 999);
      d.$lte = end;
    }
    filter.date = d;
  }

  // Search across patient name/code/mobile (requires a join-like lookup).
  // We do this in two steps when a search is present, to keep things simple.
  let patientIds: string[] | undefined;
  if (params.search) {
    const rx = { $regex: params.search, $options: 'i' };
    const matched = await Patient.find({
      $or: [
        { patientCode: rx },
        { mobile: rx },
        { firstName: rx },
        { lastName: rx },
      ],
    })
      .select('_id')
      .lean();
    patientIds = matched.map((p) => String(p._id));
    if (patientIds.length === 0) {
      return { items: [], total: 0 };
    }
    filter.patientId = { $in: patientIds };
  }

  // Sort mapping
  const sortMap: Record<string, Record<string, 1 | -1>> = {
    date: { date: params.sortDir === 'desc' ? -1 : 1, slotStart: 1 },
    createdAt: { createdAt: params.sortDir === 'desc' ? -1 : 1 },
    status: { status: params.sortDir === 'desc' ? -1 : 1, date: 1 },
    patientName: {}, // computed below
    doctorName: {}, // computed below
  };
  let sort: Record<string, 1 | -1> = sortMap[params.sortBy] ?? { date: 1, slotStart: 1 };

  // For patientName / doctorName sort we do an in-memory sort after fetch.
  const useMemSort = params.sortBy === 'patientName' || params.sortBy === 'doctorName';
  const pageSize = params.pageSize;
  const skip = (params.page - 1) * pageSize;

  const [countQuery, dataQuery] = await Promise.all([
    Appointment.countDocuments(filter),
    useMemSort
      ? Appointment.find(filter)
          .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
          .populate({ path: 'doctorId', select: 'name specialization' })
          .populate({ path: 'departmentId', select: 'name' })
          .lean()
      : Appointment.find(filter)
          .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
          .populate({ path: 'doctorId', select: 'name specialization' })
          .populate({ path: 'departmentId', select: 'name' })
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .lean(),
  ]);

  let items = (dataQuery as any[]).map(transformAppointment);

  if (useMemSort) {
    const dir = params.sortDir === 'desc' ? -1 : 1;
    items = items.sort((a: any, b: any) => {
      const aName =
        params.sortBy === 'patientName'
          ? `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`
          : a.doctor?.name ?? '';
      const bName =
        params.sortBy === 'patientName'
          ? `${b.patient?.firstName ?? ''} ${b.patient?.lastName ?? ''}`
          : b.doctor?.name ?? '';
      return aName.localeCompare(bName) * dir;
    });
    items = items.slice(skip, skip + pageSize);
  }

  return { items, total: countQuery };
}

export async function getAppointment(
  id: string,
  viewer?: RequestContext['user'],
): Promise<unknown> {
  const appt = await Appointment.findById(id)
    .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile email gender' })
    .populate({ path: 'doctorId', select: 'name specialization' })
    .populate({ path: 'departmentId', select: 'name' })
    .lean();
  if (!appt) throw NotFound('Appointment not found');
  if (viewer && viewer.role === 'DOCTOR' && viewer.doctorId) {
    const apptDoctorId = String(
      (appt as unknown as { doctorId?: { _id?: { toString(): string }; id?: string } })
        .doctorId?._id ?? '',
    );
    if (apptDoctorId !== viewer.doctorId) {
      throw Forbidden('You can only view your own appointments');
    }
  }
  return transformAppointment(appt);
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function updateAppointment(
  id: string,
  patch: UpdateAppointmentInput,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  const appt = await Appointment.findById(id);
  if (!appt) throw NotFound('Appointment not found');

  // Doctor scope
  if (ctx?.user && ctx.user.role === 'DOCTOR' && ctx.user.doctorId) {
    if (String(appt.doctorId) !== ctx.user.doctorId) {
      throw Forbidden('You can only update your own appointments');
    }
  }

  if (patch.purpose !== undefined) appt.purpose = patch.purpose;
  if (patch.notes !== undefined) appt.notes = patch.notes;
  if (patch.consultationNotes !== undefined) appt.consultationNotes = patch.consultationNotes;

  if (patch.status !== undefined && patch.status !== appt.status) {
    const allowed = VALID_TRANSITIONS[appt.status] ?? [];
    if (!allowed.includes(patch.status)) {
      throw BadRequest(
        `Cannot transition from ${appt.status} to ${patch.status}`,
      );
    }
    const prevStatus = appt.status;
    appt.status = patch.status;
    appt.updatedById = ctx?.user?.id ? new mongoose.Types.ObjectId(ctx.user.id) : undefined;
    appt.updatedAt = new Date();

    if (patch.status === 'ARRIVED' && !appt.arrivedAt) appt.arrivedAt = new Date();
    if (patch.status === 'COMPLETED') appt.completedAt = new Date();
    if (patch.status === 'CANCELLED') {
      appt.cancelledAt = new Date();
      appt.cancelledById = ctx?.user?.id
        ? new mongoose.Types.ObjectId(ctx.user.id)
        : undefined;
      appt.cancelReason = patch.cancelReason ?? 'Cancelled by user';
      // Free the BookedSlot row.
      await BookedSlot.deleteOne({ appointmentId: appt._id });
    }
    await appt.save();

    const populated = await Appointment.findById(appt._id)
      .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
      .populate({ path: 'doctorId', select: 'name specialization' })
      .populate({ path: 'departmentId', select: 'name' })
      .lean();

    await audit(
      patch.status === 'CANCELLED' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_UPDATED',
      'Appointment',
      String(appt._id),
      { prevStatus, newStatus: patch.status, cancelReason: patch.cancelReason },
      ctx,
    );

    broadcast(
      patch.status === 'CANCELLED' ? 'appointment:cancelled' : 'appointment:updated',
      { id: String(appt._id), status: patch.status },
    );
    return transformAppointment(populated);
  }

  appt.updatedById = ctx?.user?.id ? new mongoose.Types.ObjectId(ctx.user.id) : undefined;
  appt.updatedAt = new Date();
  await appt.save();

  const populated = await Appointment.findById(appt._id)
    .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
    .populate({ path: 'doctorId', select: 'name specialization' })
    .populate({ path: 'departmentId', select: 'name' })
    .lean();

  await audit('APPOINTMENT_UPDATED', 'Appointment', String(appt._id), { patch }, ctx);
  broadcast('appointment:updated', { id: String(appt._id) });
  return transformAppointment(populated);
}

export async function cancelAppointment(
  id: string,
  reason: string | undefined,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  return updateAppointment(
    id,
    { status: 'CANCELLED', cancelReason: reason ?? 'Cancelled by user' },
    ctx,
  );
}

export async function markArrived(
  id: string,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  const appt = await Appointment.findById(id);
  if (!appt) throw NotFound('Appointment not found');
  if (ctx?.user && ctx.user.role === 'DOCTOR' && ctx.user.doctorId) {
    if (String(appt.doctorId) !== ctx.user.doctorId) {
      throw Forbidden('You can only update your own appointments');
    }
  }
  if (appt.status !== 'SCHEDULED') {
    throw BadRequest(`Cannot mark arrived from ${appt.status}`);
  }
  appt.status = 'ARRIVED';
  appt.arrivedAt = new Date();
  appt.updatedById = ctx?.user?.id ? new mongoose.Types.ObjectId(ctx.user.id) : undefined;
  appt.updatedAt = new Date();
  await appt.save();
  await audit('APPOINTMENT_ARRIVED', 'Appointment', String(appt._id), {}, ctx);

  const populated = await Appointment.findById(appt._id)
    .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
    .populate({ path: 'doctorId', select: 'name specialization' })
    .populate({ path: 'departmentId', select: 'name' })
    .lean();

  broadcast('appointment:arrived', { id: String(appt._id), status: 'ARRIVED' });
  return transformAppointment(populated);
}

export async function markCompleted(
  id: string,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  const appt = await Appointment.findById(id);
  if (!appt) throw NotFound('Appointment not found');
  if (ctx?.user && ctx.user.role === 'DOCTOR' && ctx.user.doctorId) {
    if (String(appt.doctorId) !== ctx.user.doctorId) {
      throw Forbidden('You can only update your own appointments');
    }
  }
  if (appt.status !== 'ARRIVED') {
    throw BadRequest(`Cannot mark completed from ${appt.status}`);
  }
  appt.status = 'COMPLETED';
  appt.completedAt = new Date();
  appt.updatedById = ctx?.user?.id ? new mongoose.Types.ObjectId(ctx.user.id) : undefined;
  appt.updatedAt = new Date();
  await appt.save();
  await audit('APPOINTMENT_COMPLETED', 'Appointment', String(appt._id), {}, ctx);

  const populated = await Appointment.findById(appt._id)
    .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
    .populate({ path: 'doctorId', select: 'name specialization' })
    .populate({ path: 'departmentId', select: 'name' })
    .lean();

  broadcast('appointment:completed', { id: String(appt._id), status: 'COMPLETED' });
  return transformAppointment(populated);
}
