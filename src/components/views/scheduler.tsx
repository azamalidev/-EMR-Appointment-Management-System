"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Doctor, SlotsResponse, Patient, SlotItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiClientError, mutationError } from "@/components/queries";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { toDateKey, WEEKDAY_LABELS } from "@/lib/slots";
import { useNavStore } from "@/stores/nav-store";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function SchedulerView() {
  const preDoctor = useNavStore((s) => s.schedulerDoctorId);
  const preDate = useNavStore((s) => s.schedulerDate);

  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.get<Doctor[]>("/doctors"),
    ...apiClientError,
  });

  const [doctorId, setDoctorId] = useState<string>(preDoctor ?? "");
  const [date, setDate] = useState<Date>(preDate ? new Date(preDate + "T00:00:00") : new Date());
  const dateKey = toDateKey(date);

  const selectedDoctor = doctors?.find((d) => d.id === doctorId);
  const weekdayCode = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()] as keyof typeof WEEKDAY_LABELS;
  const hasScheduleToday = selectedDoctor?.schedules?.some((s) => s.dayOfWeek === weekdayCode && s.isActive);

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ["slots", doctorId, dateKey],
    queryFn: () => api.get<SlotsResponse>(`/slots`, { doctorId, date: dateKey }),
    enabled: !!doctorId,
    ...apiClientError,
  });

  const [bookingSlot, setBookingSlot] = useState<SlotItem | null>(null);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Picker */}
      <div className="space-y-3">
        <Card className="border-zinc-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-900">Select</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choose a doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.department?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDoctor && (
              <div className="text-xs text-zinc-500 space-y-1 pt-1">
                <p>{selectedDoctor.specialization || "General practice"}</p>
                <p>Works: {selectedDoctor.schedules?.filter((s) => s.isActive).map((s) => WEEKDAY_LABELS[s.dayOfWeek as keyof typeof WEEKDAY_LABELS].slice(0, 3)).join(", ") || "Not set"}</p>
                {selectedDoctor.consultationFee != null && <p>Fee: Rs. {selectedDoctor.consultationFee}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Date</Label>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border border-zinc-200 p-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slot grid */}
      <Card className="border-zinc-200">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-medium text-zinc-900">Available Slots</CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              {selectedDoctor ? `${selectedDoctor.name} · ` : ""}
              {format(date, "EEE, dd MMM yyyy")}
            </p>
          </div>
          {slots && slots.slots.length > 0 && (
            <span className="text-xs text-zinc-400 font-mono">
              {slots.slotDurationMinutes}min · {slots.slots.filter((s) => s.available).length}/{slots.slots.length} free
            </span>
          )}
        </CardHeader>
        <CardContent>
          {!doctorId ? (
            <EmptyState title="Select a doctor" subtitle="Pick a doctor to see available time slots." />
          ) : slotsLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
              {Array.from({ length: 21 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : !slots || slots.slots.length === 0 ? (
            <EmptyState
              title="No availability"
              subtitle={hasScheduleToday === false
                ? `${selectedDoctor?.name} does not work on ${WEEKDAY_LABELS[weekdayCode]}.`
                : "No schedule configured for this day."}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
                {slots.slots.map((s) => (
                  <button
                    key={s.start}
                    disabled={!s.available}
                    onClick={() => setBookingSlot(s)}
                    className={cn(
                      "h-10 rounded text-xs font-mono border transition",
                      s.available
                        ? "bg-white border-zinc-300 text-zinc-900 hover:border-zinc-900 hover:bg-zinc-50"
                        : s.appointmentId
                          ? "bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed line-through"
                          : "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed",
                    )}
                    title={s.available ? "Book this slot" : s.appointmentId ? "Booked" : "Past"}
                  >
                    {s.start}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-zinc-300 bg-white" /> Available</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-zinc-200 bg-zinc-50" /> Booked / Past</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {bookingSlot && selectedDoctor && (
        <BookingDialog
          doctor={selectedDoctor}
          dateKey={dateKey}
          slot={bookingSlot}
          onClose={() => setBookingSlot(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      <p className="text-xs text-zinc-400 mt-1 max-w-xs">{subtitle}</p>
    </div>
  );
}

function BookingDialog({
  doctor,
  dateKey,
  slot,
  onClose,
}: {
  doctor: Doctor;
  dateKey: string;
  slot: SlotItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [purpose, setPurpose] = useState("");
  const [newPatient, setNewPatient] = useState({ firstName: "", lastName: "", mobile: "", email: "", gender: "" });

  const { data: results, isFetching } = useQuery({
    queryKey: ["patient-search", search],
    queryFn: () => api.get<Patient[]>(`/patients`, { search, limit: 10 }),
    enabled: search.trim().length >= 2,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        date: dateKey,
        slotStart: slot.start,
        slotEnd: slot.end,
        purpose: purpose || undefined,
      };
      if (mode === "existing" && selectedPatient) body.patientId = selectedPatient.id;
      if (mode === "new") {
        body.newPatient = {
          firstName: newPatient.firstName,
          lastName: newPatient.lastName,
          mobile: newPatient.mobile,
          email: newPatient.email || undefined,
          gender: newPatient.gender || undefined,
        };
      }
      return api.post("/appointments", body);
    },
    onSuccess: () => {
      toast.success("Appointment booked");
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (e) => toast.error(mutationError(e)),
  });

  const canBook =
    mode === "existing"
      ? !!selectedPatient
      : newPatient.firstName && newPatient.lastName && newPatient.mobile.length >= 4;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Book Appointment</DialogTitle>
          <DialogDescription className="text-xs">
            {doctor.name} · {format(new Date(dateKey + "T00:00:00"), "dd MMM yyyy")} · {slot.start}–{slot.end}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "existing" | "new")} className="grid grid-cols-2 gap-2">
            <Label className={cn("flex items-center gap-2 px-3 py-2 rounded border text-xs cursor-pointer transition", mode === "existing" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:bg-zinc-50")}>
              <RadioGroupItem value="existing" className="size-3" /> Existing patient
            </Label>
            <Label className={cn("flex items-center gap-2 px-3 py-2 rounded border text-xs cursor-pointer transition", mode === "new" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:bg-zinc-50")}>
              <RadioGroupItem value="new" className="size-3" /> New patient
            </Label>
          </RadioGroup>

          {mode === "existing" ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Search patient</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Name, mobile, or patient ID"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedPatient(null);
                  }}
                />
              </div>
              {isFetching && <p className="text-xs text-zinc-400">Searching…</p>}
              {!isFetching && results && results.length === 0 && search.trim().length >= 2 && (
                <p className="text-xs text-zinc-400">No patients found.</p>
              )}
              {results && results.length > 0 && !selectedPatient && (
                <div className="max-h-40 overflow-y-auto rounded border border-zinc-200 divide-y divide-zinc-100">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setSearch(`${p.firstName} ${p.lastName}`); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 text-xs"
                    >
                      <span className="font-medium text-zinc-900">{p.firstName} {p.lastName}</span>
                      <span className="text-zinc-400 ml-2">{p.patientCode} · {p.mobile}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-zinc-400">{selectedPatient.patientCode} · {selectedPatient.mobile}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="size-6 p-0" onClick={() => { setSelectedPatient(null); setSearch(""); }}>
                    <X className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">First name</Label>
                <Input className="h-9 text-sm" value={newPatient.firstName} onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Last name</Label>
                <Input className="h-9 text-sm" value={newPatient.lastName} onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Mobile</Label>
                <Input className="h-9 text-sm" value={newPatient.mobile} onChange={(e) => setNewPatient({ ...newPatient, mobile: e.target.value })} placeholder="03XXXXXXXXX" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Gender</Label>
                <Select value={newPatient.gender} onValueChange={(v) => setNewPatient({ ...newPatient, gender: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Purpose <span className="text-zinc-300">(optional)</span></Label>
            <Textarea rows={2} className="text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Reason for visit" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-zinc-900 text-white hover:bg-zinc-800"
            disabled={!canBook || bookMutation.isPending}
            onClick={() => bookMutation.mutate()}
          >
            {bookMutation.isPending ? "Booking…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
