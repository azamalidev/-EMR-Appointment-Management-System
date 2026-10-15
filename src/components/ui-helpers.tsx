"use client";

import { AppointmentStatus, APPOINTMENT_STATUS_META } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { toDateKey } from "@/lib/slots";

/** Format an ISO date string (or Date) into "YYYY-MM-DD". */
export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return toDateKey(date);
}

/** Format "HH:mm" + a date key into a friendly "Mon 15 Oct, 09:15". */
export function fmtSlot(dateKey: string, time: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const day = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${time}`;
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = APPOINTMENT_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${meta.tone}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
