import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { ScheduleSession } from '../models/ScheduleSession.js';
import { BookedSlot } from '../models/BookedSlot.js';
import {
  fromDateKey,
  generateSlots,
  isPastSlot,
  weekdayOf,
  startOfDay,
  endOfDay,
} from '../utils/slots.js';
import { NotFound } from '../utils/errors.js';

export interface SlotView {
  start: string;
  end: string;
  available: boolean;
  isPast: boolean;
  appointmentId?: string;
}

export interface SlotsResult {
  doctorId: string;
  date: string;
  slotDurationMinutes: number;
  slots: SlotView[];
}

export async function getSlots(doctorId: string, dateKey: string): Promise<SlotsResult> {
  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) throw NotFound('Doctor not found');
  if (!doctor.isActive) throw NotFound('Doctor not active');

  const date = fromDateKey(dateKey);
  const dayOfWeek = weekdayOf(date);

  const schedule = await DoctorSchedule.findOne({
    doctorId,
    dayOfWeek,
    isActive: true,
  }).lean();
  if (!schedule) {
    return {
      doctorId,
      date: dateKey,
      slotDurationMinutes: 0,
      slots: [],
    };
  }

  const sessions = await ScheduleSession.find({ scheduleId: schedule._id })
    .sort({ sortOrder: 1 })
    .lean();

  const slots = generateSlots(
    sessions.map((s) => ({ type: s.type, startTime: s.startTime, endTime: s.endTime })),
    schedule.slotDurationMinutes,
  );

  // Load all booked slots for this doctor on this date in a single query.
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const booked = await BookedSlot.find({
    doctorId,
    date: { $gte: dayStart, $lte: dayEnd },
  }).lean();

  const bookedByStart = new Map<string, { appointmentId: string }>();
  for (const b of booked) {
    bookedByStart.set(b.slotStart, { appointmentId: String(b.appointmentId) });
  }

  const now = new Date();
  const slotViews: SlotView[] = slots.map((s) => {
    const isPast = isPastSlot(dateKey, s.start, now);
    const bookedEntry = bookedByStart.get(s.start);
    return {
      start: s.start,
      end: s.end,
      available: !isPast && !bookedEntry,
      isPast,
      appointmentId: bookedEntry?.appointmentId,
    };
  });

  return {
    doctorId,
    date: dateKey,
    slotDurationMinutes: schedule.slotDurationMinutes,
    slots: slotViews,
  };
}
