import { NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";

/**
 * GET /api/init — spawns the Express + MongoDB backend as a child of this
 * persistent Next.js process. The sandbox reaps ad-hoc shell processes, but
 * a child of the long-running Next.js dev server survives.
 *
 * Idempotent: if already spawned, returns ok without re-spawning.
 */

const globalForBackend = globalThis as unknown as {
  __emrBackendChild?: ChildProcess;
};

export async function GET() {
  if (globalForBackend.__emrBackendChild) {
    return NextResponse.json({ ok: true, alreadyRunning: true });
  }

  const serviceDir = path.resolve(process.cwd(), "mini-services/emr-api");
  if (!existsSync(serviceDir)) {
    return NextResponse.json({ ok: false, error: "backend service not found" }, { status: 500 });
  }

  try {
    const child = spawn("bun", ["src/server.ts"], {
      cwd: serviceDir,
      stdio: "ignore",
      detached: true,
      env: { ...process.env },
    });
    child.unref();
    globalForBackend.__emrBackendChild = child;
    child.on?.("exit", () => {
      globalForBackend.__emrBackendChild = undefined;
    });
    return NextResponse.json({ ok: true, pid: child.pid });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
