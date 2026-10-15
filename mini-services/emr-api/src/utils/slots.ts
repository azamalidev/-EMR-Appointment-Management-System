import type { DayOfWeek } from '../models/DoctorSchedule.js';
import type { SessionType } from '../models/ScheduleSession.js';

/** Format a Date to "YYYY-MM-DD" in local timezone. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a "YYYY-MM-DD" key into a Date at local midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/** Map JS Date.getDay() (0=Sun..6=Sat) to the 3-letter day code. */
export function weekdayOf(d: Date): DayOfWeek {
  const codes: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return codes[d.getDay()];
}

/** "HH:mm" → minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

/** minutes since midnight → "HH:mm". */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface SessionInput {
  type: SessionType;
  startTime: string;
  endTime: string;
}

export interface Slot {
  start: string;
  end: string;
}

/**
 * Generate non-overlapping appointment slots from WORK sessions,
 * skipping any slot that overlaps a BREAK window.
 */
export function generateSlots(
  sessions: SessionInput[],
  slotDurationMinutes: number,
): Slot[] {
  const workSessions = sessions
    .filter((s) => s.type === 'WORK')
    .map((s) => ({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime),
    }))
    .sort((a, b) => a.start - b.start);

  const breakWindows = sessions
    .filter((s) => s.type === 'BREAK')
    .map((s) => ({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime),
    }));

  const slots: Slot[] = [];

  for (const ws of workSessions) {
    for (let t = ws.start; t + slotDurationMinutes <= ws.end; t += slotDurationMinutes) {
      const slotStart = t;
      const slotEnd = t + slotDurationMinutes;
      const overlapsBreak = breakWindows.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );
      if (!overlapsBreak) {
        slots.push({ start: minutesToTime(slotStart), end: minutesToTime(slotEnd) });
      }
    }
  }

  return slots;
}

/** True if the given date+time is in the past (relative to `now`). */
export function isPastSlot(dateKey: string, time: string, now: Date = new Date()): boolean {
  const [h, m] = time.split(':').map(Number);
  const slotDate = fromDateKey(dateKey);
  slotDate.setHours(h ?? 0, m ?? 0, 0, 0);
  return slotDate.getTime() < now.getTime();
}

/** True if the date is before today. */
export function isPastDate(dateKey: string, now: Date = new Date()): boolean {
  const today = startOfDay(now);
  const target = startOfDay(fromDateKey(dateKey));
  return target.getTime() < today.getTime();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
