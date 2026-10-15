"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useNavStore, type ViewKey } from "@/stores/nav-store";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { initials } from "@/components/ui-helpers";
import {
  LayoutDashboard,
  CalendarPlus,
  ListChecks,
  Users,
  Stethoscope,
  CalendarClock,
  ScrollText,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" />, roles: ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR"] },
  { key: "scheduler", label: "Book Appointment", icon: <CalendarPlus className="size-4" />, roles: ["SUPER_ADMIN", "RECEPTIONIST"] },
  { key: "appointments", label: "Appointments", icon: <ListChecks className="size-4" />, roles: ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR"] },
  { key: "patients", label: "Patients", icon: <Users className="size-4" />, roles: ["SUPER_ADMIN", "RECEPTIONIST"] },
  { key: "doctors", label: "Doctors", icon: <Stethoscope className="size-4" />, roles: ["SUPER_ADMIN"] },
  { key: "schedules", label: "Schedules", icon: <CalendarClock className="size-4" />, roles: ["SUPER_ADMIN"] },
  { key: "audit-logs", label: "Audit Logs", icon: <ScrollText className="size-4" />, roles: ["SUPER_ADMIN"] },
];

const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Today's overview" },
  scheduler: { title: "Book Appointment", subtitle: "Select a doctor, date, and available slot" },
  appointments: { title: "Appointments", subtitle: "Search and manage all appointments" },
  patients: { title: "Patients", subtitle: "Search the patient registry" },
  doctors: { title: "Doctors", subtitle: "Manage doctor profiles" },
  schedules: { title: "Doctor Schedules", subtitle: "Configure working hours and breaks" },
  "audit-logs": { title: "Audit Logs", subtitle: "Action history" },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { view, setView } = useNavStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo(() => NAV_ITEMS.filter((i) => user && i.roles.includes(user.role)), [user]);
  const titleMeta = VIEW_TITLES[view];

  const SidebarBody = (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-zinc-200">
        <span className="text-sm font-semibold text-zinc-900">MediBook EMR</span>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setView(item.key);
              setMobileOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition",
              view === item.key
                ? "bg-zinc-100 text-zinc-900 font-medium"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-2 border-t border-zinc-200">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="size-7 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center text-xs font-medium">
            {user ? initials(user.name) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-900 truncate">{user?.name}</p>
            <p className="text-[11px] text-zinc-400">{user ? ROLE_LABELS[user.role] : ""}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 h-8 text-xs text-zinc-500 hover:text-zinc-900"
          onClick={() => logout()}
        >
          <LogOut className="size-3.5 mr-1.5" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <div className="flex flex-1">
        <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-zinc-200 flex-col">
          {SidebarBody}
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-56 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {SidebarBody}
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-zinc-200 bg-white sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden size-8"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <div>
                <h1 className="text-sm font-semibold text-zinc-900 leading-tight">{titleMeta.title}</h1>
                <p className="text-xs text-zinc-400 hidden sm:block">{titleMeta.subtitle}</p>
              </div>
            </div>
          
          </header>
          <main className="flex-1 p-4 sm:p-6 max-w-[1200px] w-full mx-auto">{children}</main>
        </div>
      </div>
      <footer className="border-t border-zinc-200 bg-white py-2.5 px-4 text-center text-xs text-zinc-400">
        MediBook EMR · Appointment Management
      </footer>
    </div>
  );
}
