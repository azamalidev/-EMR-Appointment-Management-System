"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Doctor, Department } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClientError, mutationError } from "@/components/queries";
import { toast } from "sonner";
import { UserPlus, Stethoscope } from "lucide-react";
import { useNavStore } from "@/stores/nav-store";

export function DoctorsView() {
  const { data: doctors, isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.get<Doctor[]>("/doctors"),
    ...apiClientError,
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
    ...apiClientError,
  });
  const [creating, setCreating] = useState(false);
  const preselect = useNavStore((s) => s.preselect);
  const setView = useNavStore((s) => s.setView);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-zinc-400">{doctors?.length ?? 0} doctor(s)</p>
        <Button size="sm" className="h-9 bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => setCreating(true)}>
          <UserPlus className="size-3.5 mr-1" /> Add doctor
        </Button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {doctors?.map((d) => (
            <Card key={d.id} className="border-zinc-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center text-xs font-medium">
                      {d.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 leading-tight">{d.name}</p>
                      <p className="text-xs text-zinc-400">{d.specialization || "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-zinc-500">
                  <p>{d.department?.name}</p>
                  {d.consultationFee != null && <p>Fee: Rs. {d.consultationFee}</p>}
                  <p>Works: {d.schedules?.filter((s) => s.isActive).map((s) => s.dayOfWeek).join(", ") || "Not set"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 h-8 text-xs"
                  onClick={() => { preselect(d.id, undefined); setView("schedules"); }}
                >
                  <Stethoscope className="size-3.5 mr-1" /> Manage schedule
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && departments && (
        <CreateDoctorDialog departments={departments} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function CreateDoctorDialog({ departments, onClose }: { departments: Department[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", email: "", password: "", departmentId: departments[0]?.id ?? "",
    specialization: "", qualification: "", bio: "", consultationFee: "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.post("/doctors", {
        name: form.name,
        email: form.email,
        password: form.password,
        departmentId: form.departmentId,
        specialization: form.specialization || undefined,
        qualification: form.qualification || undefined,
        bio: form.bio || undefined,
        consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
      }),
    onSuccess: () => {
      toast.success("Doctor created");
      qc.invalidateQueries({ queryKey: ["doctors"] });
      onClose();
    },
    onError: (e) => toast.error(mutationError(e)),
  });
  const can = form.name && form.email && form.password.length >= 6 && form.departmentId;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Add new doctor</DialogTitle>
          <DialogDescription className="text-xs">Creates a doctor login and profile.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-zinc-500">Full name</Label>
            <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Email (login)</Label>
            <Input className="h-9 text-sm" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Password</Label>
            <Input className="h-9 text-sm" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-zinc-500">Department</Label>
            <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Specialization</Label>
            <Input className="h-9 text-sm" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Fee (Rs.)</Label>
            <Input className="h-9 text-sm" type="number" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-zinc-500">Qualification</Label>
            <Input className="h-9 text-sm" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-zinc-500">Bio</Label>
            <Textarea rows={2} className="text-sm" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800" disabled={!can || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
