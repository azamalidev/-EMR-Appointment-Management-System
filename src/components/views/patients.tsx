"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Patient } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClientError, mutationError } from "@/components/queries";
import { toast } from "sonner";
import { Search, UserPlus, Users, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export function PatientsView() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["patient-search", search],
    queryFn: () => api.get<Patient[]>("/patients", { search, limit: 30 }),
    enabled: search.trim().length >= 2,
    ...apiClientError,
  });

  const results = data ?? [];

  return (
    <div className="space-y-3">
      <Card className="border-zinc-200">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Search by patient ID, mobile, name, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" className="h-9 bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => setCreating(true)}>
              <UserPlus className="size-3.5 mr-1" /> New patient
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200">
        <CardContent className="p-0">
          {search.trim().length < 2 ? (
            <div className="py-12 text-center">
              <Users className="size-8 mx-auto text-zinc-300 mb-2" />
              <p className="text-sm font-medium text-zinc-700">Patient registry</p>
              <p className="text-xs text-zinc-400 mt-1">Search for a patient or register a new one.</p>
            </div>
          ) : isFetching ? (
            <div className="p-3 space-y-1.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-zinc-700">No patients found</p>
              <p className="text-xs text-zinc-400 mt-1">Try a different search term.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {results.map((p) => (
                <div key={p.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-50">
                  <div className="size-8 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center text-xs font-medium">
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {p.firstName} {p.lastName}
                      <span className="ml-2 text-xs text-zinc-400 font-mono">{p.patientCode}</span>
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 mt-0.5">
                      <span className="flex items-center gap-1"><Phone className="size-3" /> {p.mobile}</span>
                      {p.email && <span>{p.email}</span>}
                      {p.gender && <span>{p.gender}</span>}
                      {p.createdAt && <span>Since {format(new Date(p.createdAt), "MMM yyyy")}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {creating && <CreatePatientDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreatePatientDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", mobile: "", email: "", gender: "" });
  const mutation = useMutation({
    mutationFn: () =>
      api.post("/patients", {
        firstName: form.firstName,
        lastName: form.lastName,
        mobile: form.mobile,
        email: form.email || undefined,
        gender: form.gender || undefined,
      }),
    onSuccess: () => {
      toast.success("Patient registered");
      qc.invalidateQueries({ queryKey: ["patient-search"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (e) => toast.error(mutationError(e)),
  });
  const can = form.firstName && form.lastName && form.mobile.length >= 4;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Register new patient</DialogTitle>
          <DialogDescription className="text-xs">A patient ID will be auto-generated.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">First name</Label>
            <Input className="h-9 text-sm" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Last name</Label>
            <Input className="h-9 text-sm" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Mobile</Label>
            <Input className="h-9 text-sm" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="03XXXXXXXXX" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Email <span className="text-zinc-300">(optional)</span></Label>
            <Input className="h-9 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-zinc-500">Gender <span className="text-zinc-300">(optional)</span></Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800" disabled={!can || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
