"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiWithMeta } from "@/lib/api-client";
import type { Appointment, Doctor, Department, PaginationMeta } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui-helpers";
import { apiClientError, mutationError } from "@/components/queries";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search, ListChecks, UserCheck, Eye, ArrowUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppointmentStatus, APPOINTMENT_STATUS_FLOW } from "@/lib/constants";
import { format } from "date-fns";

type SortBy = "date" | "createdAt" | "patientName" | "status" | "doctorName";
type SortDir = "asc" | "desc";

export function AppointmentsView() {
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === "DOCTOR";
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<AppointmentStatus | "ALL">("ALL");
  const [doctorId, setDoctorId] = useState<string>("ALL");
  const [departmentId, setDepartmentId] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<Appointment | null>(null);

  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.get<Doctor[]>("/doctors"),
    ...apiClientError,
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
    ...apiClientError,
  });

  const query = useMemo(
    () => ({
      page,
      pageSize,
      sortBy,
      sortDir,
      search: search || undefined,
      doctorId: doctorId === "ALL" ? undefined : doctorId,
      departmentId: departmentId === "ALL" ? undefined : departmentId,
      status: status === "ALL" ? undefined : status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [page, pageSize, sortBy, sortDir, search, doctorId, departmentId, status, dateFrom, dateTo],
  );

  const { data, isFetching } = useQuery({
    queryKey: ["appointments", query],
    queryFn: () => apiWithMeta<Appointment[]>("/appointments", query),
    ...apiClientError,
  });

  const rows = data?.data ?? [];
  const pagination = (data?.meta as PaginationMeta | undefined)?.pagination;

  function applySearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }
  function resetFilters() {
    setSearch(""); setSearchInput(""); setStatus("ALL"); setDoctorId("ALL"); setDepartmentId("ALL");
    setDateFrom(""); setDateTo(""); setSortBy("date"); setSortDir("asc"); setPage(1);
  }

  const arriveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/arrive`),
    onSuccess: () => { toast.success("Patient marked as arrived"); qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e) => toast.error(mutationError(e)),
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/complete`),
    onSuccess: () => { toast.success("Appointment completed"); qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); setDetail(null); },
    onError: (e) => toast.error(mutationError(e)),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.del(`/appointments/${id}`),
    onSuccess: () => { toast.success("Appointment cancelled"); qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["slots"] }); setDetail(null); },
    onError: (e) => toast.error(mutationError(e)),
  });

  return (
    <div className="space-y-3">
      {/* Filters */}
      <Card className="border-zinc-200">
        <CardContent className="p-3 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Search by patient, mobile, ID, or appointment code"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </div>
            <Button size="sm" className="h-9 bg-zinc-900 text-white hover:bg-zinc-800" onClick={applySearch}>Search</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={resetFilters}>Reset</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v as AppointmentStatus | "ALL"); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="ARRIVED">Arrived</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
            {!isDoctor && (
              <Select value={doctorId} onValueChange={(v) => { setDoctorId(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Doctor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All doctors</SelectItem>
                  {doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All departments</SelectItem>
                {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-8 text-xs" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-8 text-xs" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="h-8 text-xs"><ArrowUpDown className="size-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="createdAt">Created</SelectItem>
                <SelectItem value="patientName">Patient</SelectItem>
                <SelectItem value="doctorName">Doctor</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-zinc-200">
        <CardContent className="p-0">
          {isFetching ? (
            <div className="p-3 space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <ListChecks className="size-8 mx-auto text-zinc-300 mb-2" />
              <p className="text-sm font-medium text-zinc-700">No appointments found</p>
              <p className="text-xs text-zinc-400 mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                    <th className="text-left font-medium px-3 py-2">Code</th>
                    <th className="text-left font-medium px-3 py-2">Patient</th>
                    {!isDoctor && <th className="text-left font-medium px-3 py-2">Doctor</th>}
                    <th className="text-left font-medium px-3 py-2">Date / Time</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-right font-medium px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">{a.appointmentCode}</td>
                      <td className="px-3 py-2">
                        <p className="text-sm text-zinc-900">{a.patient?.firstName} {a.patient?.lastName}</p>
                        <p className="text-xs text-zinc-400">{a.patient?.patientCode} · {a.patient?.mobile}</p>
                      </td>
                      {!isDoctor && <td className="px-3 py-2 text-sm text-zinc-600">{a.doctor?.name}</td>}
                      <td className="px-3 py-2">
                        <p className="text-sm text-zinc-900">{format(new Date(a.date), "dd MMM yyyy")}</p>
                        <p className="text-xs text-zinc-400 font-mono">{a.slotStart}–{a.slotEnd}</p>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-0.5">
                          {a.status === "SCHEDULED" && (
                            <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => arriveMutation.mutate(a.id)} title="Mark arrived">
                              <UserCheck className="size-3.5 text-amber-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => setDetail(a)} title="View">
                            <Eye className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-1 items-center">
            <Button size="sm" variant="outline" className="size-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-xs text-zinc-500 px-2">{page} / {pagination.totalPages}</span>
            <Button size="sm" variant="outline" className="size-7 p-0" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {detail && (
        <DetailDialog
          appointment={detail}
          canManage={user?.role !== undefined}
          canComplete={user?.role === "SUPER_ADMIN" || user?.role === "DOCTOR"}
          onClose={() => setDetail(null)}
          onArrive={(id) => arriveMutation.mutate(id)}
          onComplete={(id) => completeMutation.mutate(id)}
          onCancel={(id) => cancelMutation.mutate(id)}
          busy={arriveMutation.isPending || completeMutation.isPending || cancelMutation.isPending}
        />
      )}
    </div>
  );
}

function DetailDialog({
  appointment, canManage, canComplete, onClose, onArrive, onComplete, onCancel, busy,
}: {
  appointment: Appointment;
  canManage: boolean;
  canComplete: boolean;
  onClose: () => void;
  onArrive: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  busy: boolean;
}) {
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState(appointment.purpose ?? "");
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [consultation, setConsultation] = useState(appointment.consultationNotes ?? "");

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/appointments/${appointment.id}`, { purpose, notes, consultationNotes: consultation }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
    },
    onError: (e) => toast.error(mutationError(e)),
  });

  const allowedNext = APPOINTMENT_STATUS_FLOW[appointment.status];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {appointment.appointmentCode}
            <StatusBadge status={appointment.status} />
          </DialogTitle>
          <DialogDescription className="text-xs">
            {appointment.doctor?.name} · {appointment.department?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <p className="font-medium text-zinc-900">{appointment.patient?.firstName} {appointment.patient?.lastName}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{appointment.patient?.patientCode} · {appointment.patient?.mobile}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Date" value={format(new Date(appointment.date), "dd MMM yyyy")} />
            <Field label="Time" value={`${appointment.slotStart} – ${appointment.slotEnd}`} />
            <Field label="Booked" value={format(new Date(appointment.bookedAt), "dd MMM, HH:mm")} />
            {appointment.arrivedAt && <Field label="Arrived" value={format(new Date(appointment.arrivedAt), "dd MMM, HH:mm")} />}
          </div>

          {canManage && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-zinc-500">Purpose</Label>
                <Input className="h-9 text-sm mt-1" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Notes</Label>
                <Textarea rows={2} className="text-sm mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Consultation notes</Label>
                <Textarea rows={3} className="text-sm mt-1" value={consultation} onChange={(e) => setConsultation(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {canManage && (
            <Button variant="secondary" size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          )}
          {allowedNext.includes("ARRIVED") && (
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={busy} onClick={() => onArrive(appointment.id)}>
              <UserCheck className="size-3.5 mr-1" /> Mark arrived
            </Button>
          )}
          {canComplete && allowedNext.includes("COMPLETED") && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={() => onComplete(appointment.id)}>
              Complete
            </Button>
          )}
          {allowedNext.includes("CANCELLED") && (
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => onCancel(appointment.id)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm text-zinc-900">{value}</p>
    </div>
  );
}
