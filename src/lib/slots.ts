/**
 * Pure date/time + slot-generation utilities shared by backend services
 * and (potentially) the frontend for display.
 *
 * Conventions:
 *  - "HH:mm" 24-hour strings everywhere (e.g. "09:00", "14:30").
 *  - A "date" for an appointment is the calendar day at local midnight; we
 *    store it as an ISO date string ("YYYY-MM-DD") and parse with a single
 *    helper to avoid timezone drift.
 */

export const WEEKDAYS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;
export type WeekDayShort = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<WeekDayShort, string> = {
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

/** Convert a Date to a "YYYY-MM-DD" string in its local timezone. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a "YYYY-MM-DD" key into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Weekday short code for a date (SUN..SAT). */
export function weekdayOf(d: Date): WeekDayShort {
  return WEEKDAYS[d.getDay()];
}

/** "HH:mm" -> minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:mm" */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Is `t` strictly inside [start, end)? */
export function timeInside(start: string, end: string, t: string): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const x = timeToMinutes(t);
  return x >= s && x < e;
}

export interface SessionWindow {
  name: string;
  type: "WORK" | "BREAK";
  startTime: string;
  endTime: string;
}

export interface Slot {
  start: string;
  end: string;
}

/**
 * Generate non-overlapping appointment slots from a schedule's sessions.
 * Algorithm:
 *  - For each WORK session, step from startTime by slotDuration.
 *  - A candidate [start, start+dur) is emitted only if it ends <= session end
 *    AND does NOT overlap any BREAK window of the same schedule.
 *  - Breaks override work windows.
 */
export function generateSlots(
  sessions: SessionWindow[],
  slotDurationMinutes: number,
): Slot[] {
  const work = sessions
    .filter((s) => s.type === "WORK")
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const breaks = sessions
    .filter((s) => s.type === "BREAK")
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const slots: Slot[] = [];
  for (const w of work) {
    const wStart = timeToMinutes(w.startTime);
    const wEnd = timeToMinutes(w.endTime);
    for (let t = wStart; t + slotDurationMinutes <= wEnd; t += slotDurationMinutes) {
      const slotStart = t;
      const slotEnd = t + slotDurationMinutes;
      const overlapsBreak = breaks.some((b) => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return slotStart < bEnd && slotEnd > bStart; // interval overlap
      });
      if (!overlapsBreak) {
        slots.push({
          start: minutesToTime(slotStart),
          end: minutesToTime(slotEnd),
        });
      }
    }
  }
  return slots;
}

/** Combine a date key + "HH:mm" into a Date in local time. */
export function slotToDate(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** Is the slot in the past relative to "now" (local)? */
export function isPastSlot(dateKey: string, time: string, now = new Date()): boolean {
  const slot = slotToDate(dateKey, time);
  return slot.getTime() <= now.getTime();
}

/** Is the date in the past (whole-day)? */
export function isPastDate(dateKey: string, now = new Date()): boolean {
  const today = toDateKey(now);
  return dateKey < today;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
