"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Doctor, DoctorSchedule, ScheduleSession } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { apiClientError, mutationError } from "@/components/queries";
import { toast } from "sonner";
import { CalendarClock, Trash2, Save, Plus } from "lucide-react";
import { useNavStore } from "@/stores/nav-store";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/slots";

const WEEKDAY_LIST = WEEKDAYS as readonly (typeof WEEKDAYS)[number][];

interface SessionRow extends ScheduleSession {
  _id: string;
}

function newRow(partial: Partial<SessionRow>): SessionRow {
  return {
    _id: Math.random().toString(36).slice(2),
    name: partial.name ?? "",
    type: partial.type ?? "WORK",
    startTime: partial.startTime ?? "09:00",
    endTime: partial.endTime ?? "12:00",
    sortOrder: partial.sortOrder ?? 0,
  };
}

export function SchedulesView() {
  const preDoctor = useNavStore((s) => s.schedulerDoctorId);
  const { data: doctors, isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.get<Doctor[]>("/doctors"),
    ...apiClientError,
  });
  const [doctorId, setDoctorId] = useState<string>(preDoctor ?? "");

  return (
    <div className="space-y-3">
      <Card className="border-zinc-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-900 flex items-center gap-2">
            <CalendarClock className="size-4" /> Schedule manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-w-xs">
            <Label className="text-xs text-zinc-500">Doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a doctor" /></SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!doctorId ? (
        <Card className="border-zinc-200"><CardContent className="py-10 text-center text-sm text-zinc-400">Select a doctor to manage their weekly schedule.</CardContent></Card>
      ) : isLoading ? (
        <Skeleton className="h-80" />
      ) : (
        <WeekdayEditor key={doctorId} doctorId={doctorId} />
      )}
    </div>
  );
}

function WeekdayEditor({ doctorId }: { doctorId: string }) {
  const qc = useQueryClient();
  const [activeDay, setActiveDay] = useState<(typeof WEEKDAYS)[number]>("MON");
  const [slotDuration, setSlotDuration] = useState(15);
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { isFetching } = useQuery({
    queryKey: ["schedules", doctorId, activeDay],
    queryFn: async () => {
      const all = await api.get<DoctorSchedule[]>(`/doctors/${doctorId}/schedules`);
      const sched = all.find((s) => s.dayOfWeek === activeDay);
      setSlotDuration(sched?.slotDurationMinutes ?? 15);
      setIsActive(sched?.isActive ?? true);
      setRows(sched?.sessions?.length ? sched.sessions.map((s, i) => ({ ...s, _id: `${i}-${Math.random().toString(36).slice(2)}` })) : []);
      setLoaded(true);
      return all;
    },
    ...apiClientError,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post(`/doctors/${doctorId}/schedules`, {
        dayOfWeek: activeDay,
        slotDurationMinutes: slotDuration,
        isActive,
        sessions: rows.map(({ name, type, startTime, endTime }, i) => ({ name, type, startTime, endTime, sortOrder: i })),
      }),
    onSuccess: () => {
      toast.success("Schedule saved");
      qc.invalidateQueries({ queryKey: ["schedules", doctorId] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e) => toast.error(mutationError(e)),
  });

  function updateRow(id: string, patch: Partial<SessionRow>) {
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  }
  function addRow(type: "WORK" | "BREAK") {
    setRows((rs) => [...rs, newRow({ type, name: type === "WORK" ? "Session" : "Break", sortOrder: rs.length })]);
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r._id !== id));
  }

  const sortedRows = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-3">
      <Card className="border-zinc-200">
        <CardContent className="p-2.5">
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LIST.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={activeDay === d ? "default" : "outline"}
                className={activeDay === d ? "h-7 bg-zinc-900 text-white hover:bg-zinc-800 text-xs" : "h-7 text-xs"}
                onClick={() => setActiveDay(d)}
              >
                {WEEKDAY_LABELS[d].slice(0, 3)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-zinc-900">{WEEKDAY_LABELS[activeDay]}</CardTitle>
          <div className="flex items-center gap-3">
            <Label className="text-xs text-zinc-500 flex items-center gap-1.5">
              Slot
              <Input type="number" min={5} max={120} step={5} value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="w-16 h-7 text-xs" />
              min
            </Label>
            <Label className="text-xs text-zinc-500 flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-zinc-900" />
              Active
            </Label>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isFetching && !loaded ? (
            <Skeleton className="h-32" />
          ) : sortedRows.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              No sessions for {WEEKDAY_LABELS[activeDay]}. Add a work session to begin.
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedRows.map((r) => (
                <SessionRowEditor key={r._id} row={r} onChange={(p) => updateRow(r._id, p)} onRemove={() => removeRow(r._id)} />
              ))}
            </div>
          )}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addRow("WORK")}><Plus className="size-3 mr-1" /> Work session</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addRow("BREAK")}><Plus className="size-3 mr-1" /> Break</Button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-zinc-400">Sessions must not overlap. Breaks suppress slot generation.</p>
            <Button size="sm" className="h-8 bg-zinc-900 text-white hover:bg-zinc-800" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save className="size-3.5 mr-1" /> {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {sortedRows.length > 0 && (
        <Card className="border-zinc-200">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-zinc-500">Slot preview ({previewSlots(sortedRows, slotDuration).length} slots)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {previewSlots(sortedRows, slotDuration).slice(0, 20).map((s) => (
                <span key={s.start} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">
                  {s.start}
                </span>
              ))}
              {previewSlots(sortedRows, slotDuration).length > 20 && (
                <span className="px-1.5 py-0.5 text-[11px] text-zinc-400">+{previewSlots(sortedRows, slotDuration).length - 20} more</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionRowEditor({ row, onChange, onRemove }: { row: SessionRow; onChange: (p: Partial<SessionRow>) => void; onRemove: () => void; }) {
  return (
    <div className="grid grid-cols-12 gap-1.5 items-center p-2 rounded border border-zinc-200 bg-white">
      <Input
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Session name"
        className="col-span-12 sm:col-span-4 h-8 text-sm"
      />
      <Input type="time" value={row.startTime} onChange={(e) => onChange({ startTime: e.target.value })} className="col-span-5 sm:col-span-3 h-8 text-sm" />
      <Input type="time" value={row.endTime} onChange={(e) => onChange({ endTime: e.target.value })} className="col-span-5 sm:col-span-3 h-8 text-sm" />
      <Select value={row.type} onValueChange={(v) => onChange({ type: v as "WORK" | "BREAK" })}>
        <SelectTrigger className="col-span-10 sm:col-span-1 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="WORK">Work</SelectItem>
          <SelectItem value="BREAK">Break</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={onRemove} className="col-span-2 sm:col-span-1 size-8 p-0 text-zinc-400 hover:text-rose-500">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function previewSlots(rows: SessionRow[], duration: number): { start: string; end: string }[] {
  const work = rows.filter((r) => r.type === "WORK").sort((a, b) => a.startTime.localeCompare(b.startTime));
  const breaks = rows.filter((r) => r.type === "BREAK");
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: { start: string; end: string }[] = [];
  for (const w of work) {
    const wStart = toMin(w.startTime);
    const wEnd = toMin(w.endTime);
    for (let t = wStart; t + duration <= wEnd; t += duration) {
      const slotStart = t;
      const slotEnd = t + duration;
      const overlapsBreak = breaks.some((b) => {
        const bs = toMin(b.startTime);
        const be = toMin(b.endTime);
        return slotStart < be && slotEnd > bs;
      });
      if (!overlapsBreak) out.push({ start: toTime(slotStart), end: toTime(slotEnd) });
    }
  }
  return out;
}
