"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useNavStore } from "@/stores/nav-store";
import { LoginPage } from "@/components/login-page";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/views/dashboard";
import { SchedulerView } from "@/components/views/scheduler";
import { AppointmentsView } from "@/components/views/appointments";
import { PatientsView } from "@/components/views/patients";
import { DoctorsView } from "@/components/views/doctors";
import { SchedulesView } from "@/components/views/schedules";
import { AuditLogsView } from "@/components/views/audit-logs";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user, loading, bootstrap } = useAuthStore();
  const view = useNavStore((s) => s.view);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="space-y-3 w-72">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <AppShell>
      {view === "dashboard" && <DashboardView />}
      {view === "scheduler" && <SchedulerView />}
      {view === "appointments" && <AppointmentsView />}
      {view === "patients" && <PatientsView />}
      {view === "doctors" && <DoctorsView />}
      {view === "schedules" && <SchedulesView />}
      {view === "audit-logs" && <AuditLogsView />}
    </AppShell>
  );
}
