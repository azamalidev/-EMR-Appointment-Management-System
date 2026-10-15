"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiWithMeta } from "@/lib/api-client";
import type { AuditLog, PaginationMeta } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClientError } from "@/components/queries";
import { ROLE_LABELS } from "@/lib/constants";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const ACTION_OPTIONS = [
  "AUTH_LOGIN", "AUTH_LOGOUT", "AUTH_REFRESH", "AUTH_LOGIN_FAILED",
  "APPOINTMENT_CREATED", "APPOINTMENT_UPDATED", "APPOINTMENT_CANCELLED",
  "APPOINTMENT_ARRIVED", "APPOINTMENT_COMPLETED",
  "PATIENT_CREATED", "DOCTOR_CREATED", "SCHEDULE_UPDATED",
];

export function AuditLogsView() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [action, setAction] = useState("ALL");
  const [entity, setEntity] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = {
    page, pageSize,
    action: action === "ALL" ? undefined : action,
    entity: entity === "ALL" ? undefined : entity,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data, isFetching } = useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => apiWithMeta<AuditLog[]>("/audit-logs", query),
    ...apiClientError,
  });
  const rows = data?.data ?? [];
  const pagination = (data?.meta as PaginationMeta | undefined)?.pagination;

  return (
    <div className="space-y-3">
      <Card className="border-zinc-200">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actions</SelectItem>
                {ACTION_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entity} onValueChange={(v) => { setEntity(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All entities</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Doctor">Doctor</SelectItem>
                <SelectItem value="Patient">Patient</SelectItem>
                <SelectItem value="Appointment">Appointment</SelectItem>
                <SelectItem value="DoctorSchedule">Schedule</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-8 text-xs" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200">
        <CardContent className="p-0">
          {isFetching ? (
            <div className="p-3 space-y-1.5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-zinc-700">No audit logs</p>
              <p className="text-xs text-zinc-400 mt-1">No actions match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                    <th className="text-left font-medium px-3 py-2">Timestamp</th>
                    <th className="text-left font-medium px-3 py-2">User</th>
                    <th className="text-left font-medium px-3 py-2">Action</th>
                    <th className="text-left font-medium px-3 py-2">Entity</th>
                    <th className="text-left font-medium px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-50 align-top">
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-zinc-600">
                        {format(new Date(l.timestamp), "dd MMM yyyy")}
                        <br />
                        <span className="text-zinc-400 font-mono">{format(new Date(l.timestamp), "HH:mm:ss")}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-zinc-900">{l.userEmail || "—"}</p>
                        <p className="text-[11px] text-zinc-400">{l.userRole ? ROLE_LABELS[l.userRole] : "—"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[11px] text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">{l.action}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-600">
                        {l.entity}
                        {l.entityId && <span className="block text-zinc-300 font-mono text-[10px] truncate max-w-[100px]">{l.entityId}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400">
                        {l.metadata ? <pre className="font-mono text-[10px] whitespace-pre-wrap max-w-md">{prettyMeta(l.metadata)}</pre> : "—"}
                        {l.ip && <span className="block text-[10px] mt-0.5">{l.ip}</span>}
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
    </div>
  );
}

function prettyMeta(s: string): string {
  try {
    const obj = typeof s === "string" ? JSON.parse(s) : s;
    return JSON.stringify(obj);
  } catch { return String(s); }
}
