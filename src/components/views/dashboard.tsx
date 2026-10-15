"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DashboardStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui-helpers";
import { apiClientError } from "@/components/queries";
import { useNavStore } from "@/stores/nav-store";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
    ...apiClientError,
  });
  const setView = useNavStore((s) => s.setView);

  if (isLoading || !data) return <DashboardSkeleton />;

  const stats = [
    { label: "Today", value: data.todayAppointments },
    { label: "Scheduled", value: data.scheduledToday },
    { label: "Arrived", value: data.arrivedToday },
    { label: "Completed", value: data.completedToday },
    { label: "Cancelled", value: data.cancelledToday },
    { label: "Total Patients", value: data.patientsCount },
    { label: "Active Doctors", value: data.doctorsCount },
    { label: "All-time", value: data.totalAppointments },
  ];

  const maxCount = Math.max(1, ...data.hourly.map((h) => h.count));
  const peakHour = data.hourly.reduce((a, b) => (b.count > a.count ? b : a), { hour: 0, count: 0 });

  return (
    <div className="space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Today's schedule */}
        <Card className="lg:col-span-3 border-zinc-200">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-zinc-900">Today&rsquo;s Schedule</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-zinc-500 h-7" onClick={() => setView("appointments")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentAppointments.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-400">
                No appointments scheduled for today.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                {data.recentAppointments.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="text-xs font-mono text-zinc-900 w-12 shrink-0 font-medium">
                      {a.slotStart}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 truncate">
                        {a.patient?.firstName} {a.patient?.lastName}
                        <span className="text-zinc-400 ml-1.5">{a.patient?.patientCode}</span>
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {a.doctor?.name} · {a.department?.name}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hourly load */}
        <Card className="lg:col-span-2 border-zinc-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-900">Hourly Load</CardTitle>
            <p className="text-xs text-zinc-400">
              Peak at {String(peakHour.hour).padStart(2, "0")}:00 ({peakHour.count})
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-px h-32">
              {data.hourly.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className={`w-full rounded-t ${h.count > 0 ? "bg-zinc-300 group-hover:bg-zinc-400" : "bg-zinc-100"}`}
                    style={{ height: `${(h.count / maxCount) * 100}%`, minHeight: h.count > 0 ? 3 : 1 }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12 mt-2" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 border-zinc-200"><CardContent className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</CardContent></Card>
        <Card className="lg:col-span-2 border-zinc-200"><CardContent className="p-4"><Skeleton className="h-32" /></CardContent></Card>
      </div>
    </div>
  );
}
