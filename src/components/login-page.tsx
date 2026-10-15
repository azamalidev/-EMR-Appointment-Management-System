"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@emr.local", password: "Admin@123" },
  { role: "Receptionist", email: "reception@emr.local", password: "Reception@123" },
  { role: "Doctor", email: "dr.khan@emr.local", password: "Doctor@123" },
  { role: "Doctor", email: "dr.ahmed@emr.local", password: "Doctor@123" },
];

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (err) {
      toast.error((err as Error).message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function fill(email: string, password: string) {
    form.setValue("email", email);
    form.setValue("password", password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">MediBook EMR</h1>
          <p className="text-sm text-zinc-500 mt-1">Appointment Management System</p>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-zinc-600">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-9"
                placeholder="you@hospital.org"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-rose-500">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-zinc-600">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-9"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-rose-500">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-9 bg-zinc-900 text-white hover:bg-zinc-800"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>

        <div className="mt-4 bg-white rounded-lg border border-zinc-200 p-4">
          <p className="text-xs font-medium text-zinc-500 mb-2">Test accounts — click to fill</p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => fill(a.email, a.password)}
                className="w-full flex items-center justify-between text-left text-xs px-2 py-1.5 rounded hover:bg-zinc-50 transition"
              >
                <span className="text-zinc-600">{a.role}</span>
                <span className="text-zinc-400 font-mono">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
