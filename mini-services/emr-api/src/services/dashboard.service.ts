import { Appointment } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { startOfDay, endOfDay, toDateKey } from '../utils/slots.js';
import type { AuthUser } from '../types.js';

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
  recentAppointments: unknown[];
  hourly: { hour: number; count: number }[];
}

export async function getStats(viewer?: AuthUser): Promise<DashboardStats> {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // Doctor scope: a doctor only sees their own stats.
  const doctorFilter =
    viewer && viewer.role === 'DOCTOR' && viewer.doctorId ? { doctorId: viewer.doctorId } : {};

  const [
    totalAppointments,
    todayAppointments,
    arrivedToday,
    completedToday,
    cancelledToday,
    scheduledToday,
    patientsCount,
    doctorsCount,
    recentRaw,
    todaySlots,
  ] = await Promise.all([
    Appointment.countDocuments(doctorFilter),
    Appointment.countDocuments({ ...doctorFilter, date: { $gte: todayStart, $lte: todayEnd } }),
    Appointment.countDocuments({
      ...doctorFilter,
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'ARRIVED',
    }),
    Appointment.countDocuments({
      ...doctorFilter,
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'COMPLETED',
    }),
    Appointment.countDocuments({
      ...doctorFilter,
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'CANCELLED',
    }),
    Appointment.countDocuments({
      ...doctorFilter,
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'SCHEDULED',
    }),
    Patient.countDocuments({}),
    Doctor.countDocuments({ isActive: true }),
    Appointment.find({
      ...doctorFilter,
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $ne: 'CANCELLED' },
    })
      .populate({ path: 'patientId', select: 'patientCode firstName lastName mobile' })
      .populate({ path: 'doctorId', select: 'name specialization' })
      .populate({ path: 'departmentId', select: 'name' })
      .sort({ slotStart: 1 })
      .limit(8)
      .lean(),
    Appointment.find({
      ...doctorFilter,
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $ne: 'CANCELLED' },
    })
      .select('slotStart')
      .lean(),
  ]);

  // Build hourly load distribution (0-23, numeric hour for the frontend chart).
  const hourCounts = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourCounts.set(h, 0);
  for (const s of todaySlots) {
    const hour = parseInt((s as { slotStart: string }).slotStart.split(':')[0] ?? '0', 10);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const hourly = Array.from(hourCounts.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({ hour, count }));

  // Transform recentAppointments to use clean field names (patient/doctor/department)
  // instead of Mongoose's patientId/doctorId/departmentId populated fields.
  const recentAppointments = recentRaw.map((a: any) => ({
    id: a._id,
    appointmentCode: a.appointmentCode,
    date: a.date,
    slotStart: a.slotStart,
    slotEnd: a.slotEnd,
    status: a.status,
    purpose: a.purpose,
    patient: a.patientId,
    doctor: a.doctorId,
    department: a.departmentId,
  }));

  return {
    totalAppointments,
    todayAppointments,
    arrivedToday,
    completedToday,
    cancelledToday,
    scheduledToday,
    patientsCount,
    doctorsCount,
    todayKey: toDateKey(new Date()),
    recentAppointments,
    hourly,
  };
}

export const _todayKey = (d = new Date()) => toDateKey(d);
