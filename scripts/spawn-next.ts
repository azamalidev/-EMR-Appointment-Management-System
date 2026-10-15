// Spawns Next.js dev server as a fully detached process that survives
// the sandbox's process-reaping. Same technique as the /api/init route.
import { spawn } from "child_process";

const child = spawn("bun", ["run", "dev"], {
  cwd: process.cwd(),
  stdio: "ignore",
  detached: true,
  env: { ...process.env },
});
child.unref();
console.log("Next.js spawned as detached child, pid:", child.pid);
process.exit(0);
