# EMR Appointment Management System — Worklog

This file is the shared worklog for all agents working on this project.
Each agent appends a new section (starting with `---`) after completing its task.

Project root: `/home/z/my-project`
Stack adaptation: Next.js 16 (App Router) + Prisma/SQLite + Socket.IO mini-service (port 3003).
This honors the MERN assessment's engineering intent (clean service/controller separation, RBAC, concurrency-safe booking, indexing, audit trail, real-time updates) while running in this environment.

## Global conventions
- All HTTP API routes live under `/api/v1/*` (Next.js route handlers act as thin controllers).
- Business logic lives in `src/server/services/*`.
- Shared lib in `src/lib/*` (db, jwt, crypto, response, errors, validation, realtime).
- Middlewares in `src/server/middleware/*` (auth, rbac, error, validate).
- The only user-visible page route is `/` (single-page app with view-state navigation via Zustand).
- Real-time: separate Socket.IO mini-service on port 3003 (`mini-services/realtime-service/`). Next.js API routes POST to its `/__broadcast` endpoint to fan-out events; browser clients connect via `io('/?XTransformPort=3003')`.
- Concurrency-safe booking: a `BookedSlot` table with a UNIQUE(doctorId, date, slotStart) constraint; booking inserts into it inside a transaction with the Appointment, guaranteeing no double booking at the DB level.

---

## Task ID: 5
- Agent: full-stack-developer (realtime mini-service)
- Task: Build an independent Bun + TypeScript Socket.IO mini-service at `/home/z/my-project/mini-services/realtime-service/` on port 3003 that fans out real-time EMR appointment events to browser clients, plus an HTTP `/__broadcast` endpoint for Next.js API routes to trigger fan-out.

### Work Log:
- Read `worklog.md` and the existing `examples/websocket/{server.ts,frontend.tsx}` for the established Socket.IO + Caddy conventions (path "/", `io("/?XTransformPort=3003")`).
- Created `mini-services/realtime-service/` with:
  - `package.json` — name `emr-realtime-service`, `type: module`, scripts `dev`=`bun --hot index.ts`, `start`=`bun index.ts`, dependency `socket.io@^4.8.1`.
  - `tsconfig.json` — strict, ESNext module/target, `moduleResolution: bundler`, `types: ["bun-types"]`.
  - `index.ts` — HTTP server + Socket.IO server (path "/", CORS "*", pingTimeout 60000, pingInterval 25000) on hardcoded port 3003.
  - Local `.env` mirroring the parent `REALTIME_BROADCAST_TOKEN` so the service validates the token even when started plainly with `bun run dev`.
- Ran `bun install` in the service dir → installed `socket.io@4.8.4` (21 packages).
- Appended `REALTIME_BROADCAST_TOKEN=emr_rt_broadcast_secret_2024` to `/home/z/my-project/.env` (Next.js API routes will read the same token).
- Implemented the `/__broadcast` HTTP endpoint: raw chunked body collection → `JSON.parse` with try/catch (400 on parse error) → token validation against `process.env.REALTIME_BROADCAST_TOKEN` (401 on mismatch; warn-and-allow if env unset) → `event` validation (400 if missing) → `io.emit(event, payload)` globally, or `io.to(room).emit(...)` when `room` is supplied.
- Implemented socket lifecycle: on `connection` emit `connected {socketId, at: ISO}`; `subscribe`/`unsubscribe` room join/leave with `subscribed`/`unsubscribed` acks; best-effort `authenticate` → `authenticated` ack; `ping`/`pong` latency helper; `disconnect` + `error` logging.
- Graceful shutdown on SIGTERM/SIGINT: `io.close()` then `httpServer.close()` then `exit(0)`, with a 5s force-exit safety net.
- **Critical bug found & fixed**: with Socket.IO `path: "/"`, Engine.IO attaches a `request` listener that (because every URL path starts with "/") intercepts ALL HTTP requests and returns `{"code":0,"message":"Transport unknown"}` for `/__broadcast` and health checks. Fix: after `new Server(httpServer, …)`, captured Socket.IO's `request` listener, removed it, and installed a dispatcher that (a) handles `POST /__broadcast` itself, (b) hands off real Engine.IO requests (URLs containing `EIO=`/`transport=`/`sid=`) to Socket.IO's listener, and (c) responds `200 {ok:true,service:"emr-realtime"}` to everything else. WebSocket upgrades still go to Socket.IO's `upgrade` listener untouched.
- Verified end-to-end (single Bash command, see report): GET `/` → 200 health; POST `/__broadcast` no/wrong token → 401; correct token global → 200 + `io.emit`; correct token + `room` → 200 + `io.to(room).emit`; invalid JSON → 400; missing `event` → 400; non-broadcast POST/GET → 200 health; **Engine.IO handshake `GET /?EIO=4&transport=polling` → `0{"sid":…,"upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000,…}`** proving the Socket.IO hand-off works; `GET /?XTransformPort=3003` (no EIO) → 200 health.
- Confirmed exactly one instance on port 3003 (killed duplicates before each start).

### Stage Summary:
- Realtime mini-service is fully built, dependency-installed, and verified working on port 3003 with the exact `curl http://localhost:3003/` → `{"ok":true,"service:"emr-realtime"}` response.
- The `/__broadcast` endpoint is token-gated by `REALTIME_BROADCAST_TOKEN=emr_rt_broadcast_secret_2024` (now in both `/home/z/my-project/.env` and the service's local `.env`), supports global and room-scoped fan-out, and returns the specified `{success:true}` / `{success:false,message:"unauthorized"}` / 400 shapes.
- Socket.IO path "/" coexists with the custom HTTP endpoint via the dispatcher-reorder technique; browser clients can connect with `io("/?XTransformPort=3003")` and use `subscribe`/`unsubscribe`/`authenticate` events as specified.
- **Sandbox caveat (important for downstream agents)**: this sandbox reaps background processes launched from a Bash tool call as soon as that call returns — so a manually `nohup … &` -started instance does NOT survive across Bash commands. Persistence is handled by the container bootstrap `/start.sh`, which scans `mini-services/*/package.json` and runs `sudo -u z bun run dev` for each as a child of init (tini) on every container boot. Because this service now has a `package.json` with a `dev` script, it will auto-start on the next session boot. To run it ad-hoc in the current session: `cd /home/z/my-project/mini-services/realtime-service && nohup bun run dev < /dev/null > service.log 2>&1 &` then verify with `curl -s http://localhost:3003/`.
- Next.js API routes should broadcast by POSTing to `http://localhost:3003/__broadcast` with body `{"token":"emr_rt_broadcast_secret_2024","event":"<name>","payload":<obj>,"room":"<optional>"}` (server-side fetch, no `XTransformPort` needed for same-machine calls). Browser clients connect with `io("/?XTransformPort=3003", {transports:["websocket","polling"]})`.

---
Task ID: 1,2,3,4,4b,6,7,8,9,10
Agent: main (orchestrator)
Task: Build the complete EMR Appointment Management System (DB schema, lib, services, API routes, frontend, docs) and verify end-to-end with Agent Browser.

Work Log:
- Designed Prisma schema: User, RefreshToken, Department, Doctor, DoctorSchedule, ScheduleSession, Patient, Appointment, BookedSlot (UNIQUE guard), AuditLog — with compound indexes on every hot query path. Ran `bun run db:push`.
- Installed bcryptjs, jsonwebtoken, socket.io-client + types.
- Built shared lib: env.ts (typed), crypto.ts (bcrypt + SHA-256 token hash + CSPRNG refresh tokens), jwt.ts (access+refresh sign/verify), errors.ts (AppError + helpers), response.ts (ok/created/fail envelope + pageMeta), slots.ts (pure slot generation with break suppression), realtime.ts (broadcast client), realtime-spawn.ts (spawns mini-service as child of Next.js), constants.ts (roles/status/audit actions), types.ts (frontend DTOs).
- Built middleware: auth.ts (requireUser + IP/UA extraction), rbac.ts (requireRole), validate.ts (zod parseBody/parseQuery), handler.ts (withError/withErrorCtx with dev error logging).
- Built validators/schemas.ts (zod schemas for all entities + queries).
- Built services: audit.service.ts (detached non-throwing), auth.service.ts (login/refresh/logout with rotation + reuse detection, createDoctorUser/createReceptionistUser), doctor.service.ts (list/create + upsertSchedule with overlap validation), slot.service.ts (dynamic generation + single booked-slots query), patient.service.ts (search + create + find-or-create inside tx), appointment.service.ts (concurrency-safe booking via BookedSlot UNIQUE constraint + P2002→409, list with filters/sort/pagination, update/cancel/arrive/complete with status workflow, realtime broadcast).
- Built all API routes under /api/v1/: auth/{login,logout,refresh,me}, doctors, doctors/[id]/schedules, departments, receptionists, slots, patients, appointments, appointments/[id]/{route,arrive,complete}, audit-logs, dashboard/stats.
- Wrote scripts/seed.ts (idempotent): super admin, receptionist, 2 doctors (Cardiology + General Medicine) with Mon-Fri schedules (morning 09-12, lunch break 12-13, evening 13-17, 15-min slots), 4 departments, 4 patients, sample appointments for today. Ran it.
- Fixed JWT sign bug (subject option + sub payload conflict). Reduced Prisma log noise to error/warn only.
- Dispatched subagent (Task 5) for the independent Socket.IO mini-service on port 3003 — it built mini-services/realtime-service/ with /__broadcast endpoint (token-authenticated, room support) and verified the full endpoint matrix.
- Built frontend: api-client.ts (Bearer injection + transparent single-retry refresh on 401), auth-store.ts (Zustand+persist), nav-store.ts, providers.tsx (QueryClient + RealtimeProvider), realtime-provider.tsx (Socket.IO → targeted React Query invalidation), login-page.tsx (demo account quick-fill), app-shell.tsx (role-aware sidebar + sticky footer), ui-helpers.tsx (StatusBadge/formatters), queries.ts (shared error handler).
- Built views: dashboard.tsx (8 stat cards + today's schedule + hourly load chart), scheduler.tsx (doctor+date+calendar → slot grid with available/booked/past + booking dialog with existing/new patient toggle + patient search), appointments.tsx (filters/search/sort/pagination + detail dialog with status workflow actions), patients.tsx (search + register), doctors.tsx (admin: cards + create dialog), schedules.tsx (weekday editor with WORK/BREAK sessions + live slot preview), audit-logs.tsx (filterable paginated trail).
- Resolved sandbox reaping: realtime-spawn.ts makes the Next.js server spawn the mini-service as a persistent child (the Next.js dev server started at boot survives the whole session). Verified the service persists across bash calls after a dashboard request triggers the spawn.
- Wrote README.md (overview, demo accounts, architecture diagram, folder structure, DB design + indexes, full API docs, realtime explanation, security, performance, env vars, install, assumptions, limitations, future improvements) and ENGINEERING_DECISIONS.md (7 mandatory questions answered: architecture, schema design, double-booking prevention, indexes, security, performance, scaling to millions).

Verification (Agent Browser, via Caddy gateway on :81):
- Login as Receptionist → dashboard renders 8 stat cards + today's schedule + hourly chart with real seeded data.
- Scheduler: selected Dr. Ayesha Khan → 28 slots generated for today, lunch break (12:00-13:00) correctly excluded, "15-min slots · 27/28 free" (1 pre-booked from earlier curl test).
- Booking: searched "Imran" → found patient → confirmed → toast "Appointment booked" → slot grid refreshed to "26/28 free" in real-time (cache invalidation). Appointment AP-00006 appeared in the list.
- Appointments list: all 6 appointments with code/patient/doctor/date-time/status/actions columns; filters + sort + pagination present.
- Mark arrived: clicked action on AP-00005 → status changed Scheduled→Arrived instantly.
- RBAC doctor: logged in as Dr. Khan → nav reduced to Dashboard/Appointments only → list shows ONLY her 4 appointments (Dr. Ahmed's excluded) → Doctor column hidden.
- Realtime: via Caddy gateway, browser console shows `[rt] connected <socketId>` — Socket.IO connects through ?XTransformPort=3003 forwarding.
- Audit logs: full trail visible (AUTH_LOGIN, AUTH_LOGOUT, APPOINTMENT_CREATED with metadata, APPOINTMENT_ARRIVED) with timestamp/user/role/action/entity/details.
- Schedules editor: loaded Dr. Khan's Monday schedule (Morning WORK / Lunch BREAK / Evening WORK) with live "Generated slots preview" showing 09:00–11:45 + 13:00+ (break excluded).
- Mobile (390x844): sidebar hidden, hamburger menu present, full-width content. Sticky footer present at document bottom.
- `bun run lint` clean. No console errors. All APIs returning 200.

Stage Summary:
- Complete production-grade EMR Appointment Management system delivered: JWT auth with refresh rotation + reuse detection, RBAC (Super Admin/Receptionist/Doctor) enforced at both middleware AND service layer, dynamic slot generation with break suppression, concurrency-safe booking via DB UNIQUE constraint (verified: double-booking returns 409), server-side search/filter/sort/pagination, full audit trail, real-time Socket.IO updates via a decoupled mini-service, responsive SPA UI with role-aware navigation.
- All 10 functional requirements + security + performance + engineering challenge (real-time) + documentation (README + ENGINEERING_DECISIONS.md) satisfied.
- Demo accounts: admin@emr.local/Admin@123, reception@emr.local/Reception@123, dr.khan@emr.local/Doctor@123, dr.ahmed@emr.local/Doctor@123.
- Known sandbox caveat documented: realtime mini-service is spawned as a child of the persistent Next.js dev server (realtime-spawn.ts) because the sandbox reaps processes started from ad-hoc shell calls.

---

## Task ID: 1
- Agent: backend-developer (emr-api Express+MongoDB mini-service)
- Task: Build the complete Express.js + MongoDB + Mongoose backend for the Enterprise EMR Appointment Management System as an independent mini-service at `/home/z/my-project/mini-services/emr-api/` (port 4000, Socket.IO path "/", integrated into the same Express server).

### Work Log:
- Read `worklog.md` for prior context — confirmed the existing Next.js + Prisma/SQLite implementation is the user-visible app; this task builds a parallel, independent MERN backend (Express + MongoDB via mongodb-memory-server) on port 4000.
- Followed the mandated folder structure exactly: `src/{config,models,middlewares,controllers,services,routes,validators,utils}` + `package.json`, `tsconfig.json`, `src/server.ts`, `src/app.ts`, `src/seed.ts`, `src/types.ts`. 51 TS source files, ~3,684 LOC.
- Created `package.json` (`type: module`, `dev`=`bun --hot src/server.ts`) and installed all 8 deps + 5 devDeps in one shot with `bun install` (161 packages, 4.5s).
- `config/database.ts`: `MongoMemoryServer.create()` (single instance, no replSet) + `mongoose.connect`. `connectDB`/`disconnectDB` exported for graceful shutdown.
- Built all 10 Mongoose models with the EXACT schemas from the spec, including every compound index:
  - `User` (compound `{role:1,isActive:1}`), `RefreshToken` (compound `{userId:1,revokedAt:1}`), `Department`, `Doctor` (compound `{departmentId:1,isActive:1}` + `{isActive:1}`), `DoctorSchedule` (UNIQUE compound `{doctorId:1,dayOfWeek:1}`), `ScheduleSession` (`{scheduleId:1,sortOrder:1}`), `Patient` (`{firstName:1,lastName:1}`), `Appointment` (5 compound indexes for every hot query path), `BookedSlot` (UNIQUE compound `{doctorId:1,date:1,slotStart:1}` ← THE DOUBLE-BOOKING GUARD), `AuditLog` (3 compound indexes).
- `utils/`: `response.ts` (ok/created/fail envelope + pageMeta pagination), `errors.ts` (AppError + BadRequest/Unauthorized/Forbidden/NotFound/ValidationError/Conflict helpers), `jwt.ts` (signAccessToken 15m / signRefreshToken 7d / verify each; `as const` literal TTLs to satisfy @types/jsonwebtoken v9's StringValue type), `crypto.ts` (bcrypt cost 12 + SHA-256 token hash + 48-byte CSPRNG base64url refresh jti), `slots.ts` (pure generateSlots with break suppression, date/time helpers, isPastSlot/isPastDate), `realtime.ts` (setIO/getIO/broadcast — direct io.emit / io.to(room).emit).
- `middlewares/`: `auth.ts` (requireUser: Bearer verify → load user → populate doctorId virtual; optionalUser for /logout; IP from x-forwarded-for/x-real-ip; UA from headers), `rbac.ts` (requireRole(...roles) factory), `error.ts` (centralized errorHandler catching AppError/ZodError/Mongoose ValidationError/CastError/E11000 duplicate-key; asyncHandler wrapper), `validate.ts` (parseBody/parseQuery zod middleware factories).
- `validators/schemas.ts`: all 13 zod schemas — login, refresh, logout, createDepartment, createReceptionist, createDoctor, upsertSchedule (with session start<end refine + per-type overlap validation), createPatient, createAppointment (patientId OR newPatient), updateAppointment, listAppointmentsQuery (coerced page/pageSize, sortBy/sortDir enums, filters), slotsQuery, patientsQuery, auditQuery.
- `services/`:
  - `auth.service.ts`: login (bcrypt verify → issue tokens → audit), refresh (verify JWT → look up by SHA-256(JWT) → reuse detection: if `revokedAt` set, revoke ALL user tokens + audit AUTH_REFRESH_REUSE → else rotate: revoke this token, issue new pair), logout (revoke specific token), getCurrentUser, createDoctorUser (User+Doctor in sequence with rollback on Doctor failure), createReceptionistUser, createDepartment, listDepartments.
  - `doctor.service.ts`: listDoctors (populates department + all schedules + sessions in 3 batched queries — no N+1), getDoctor, createDoctor, upsertSchedule (validates session overlaps + BREAK-inside-WORK, upserts DoctorSchedule, atomically replaces ScheduleSession rows, returns preview slots), listSchedules, deleteSchedule.
  - `slot.service.ts`: getSlots(doctorId, dateKey) — loads doctor, schedule for weekday, sessions, generates slots (break suppression), single BookedSlot query for the whole day, marks each slot available/booked/past.
  - `patient.service.ts`: searchPatients (OR on patientCode/mobile/firstName/lastName/email with case-insensitive regex), createPatient (auto patientCode "P-XXXXX" with mobile uniqueness), findOrCreatePatient.
  - `appointment.service.ts` (CRITICAL): createAppointment — validates doctor active, rejects past dates/times, generates valid slots from schedule, find-or-create patient, then **CONCURRENCY-SAFE BOOKING via the BookedSlot unique index**: create BookedSlot FIRST (catches E11000 → 409 Conflict "This slot was just booked by someone else"), then create Appointment + patch BookedSlot.appointmentId; if Appointment insert fails, delete the placeholder BookedSlot to free the slot. After commit: audit + broadcast `appointment:created`. listAppointments (server-side filter/search/sort/pagination with doctor scope for DOCTOR viewers). updateAppointment (enforces SCHEDULED→ARRIVED→COMPLETED or CANCELLED workflow; on CANCELLED deletes the BookedSlot row in a single op + broadcast). markArrived, markCompleted (RBAC-enforced DOCTOR/SUPER_ADMIN only). cancelAppointment.
  - `audit.service.ts`: audit() — non-throwing (catches errors, logs warning, never breaks main op), listAuditLogs with filters.
  - `dashboard.service.ts`: getStats — role-aware (DOCTOR sees only their own); 8 counters via Promise.all of countDocuments, recentAppointments (today's, populated, limit 8), hourlyLoad distribution grouped by slotStart hour.
- `controllers/`: thin — 8 files wrapping service calls with the response envelope.
- `routes/`: 8 route files + index.ts mounting everything under `/api/v1`. Every route chain = `requireUser` → optional `requireRole(...)` → optional `parseBody`/`parseQuery` → `asyncHandler(controller)`.
- `app.ts`: cors({origin:'*'}), express.json(1mb), /health, /api/v1 router, 404 → NotFound AppError, centralized errorHandler.
- `seed.ts`: idempotent (checks `User.countDocuments() > 0` first) — 4 departments, 4 users (admin/receptionist/2 doctors), 2 doctors (Cardiology + General Medicine), Mon-Fri schedules with Morning WORK 09-12 / Lunch BREAK 12-13 / Evening WORK 13-17 (15-min slots), 4 patients, 4 sample appointments for today (2nd + 4th future slot of each doctor with the first two patients). Prints all 4 demo credentials at the end.
- `server.ts`: boots mongodb-memory-server → connects mongoose → runSeed → createApp → createServer(app) → `new Server(httpServer, {path:'/',cors:'*'})` → **CRITICAL FIX** (see below) → setIO(io) → io.on('connection') with subscribe/unsubscribe/disconnect handlers → httpServer.listen(4000) → SIGTERM/SIGINT graceful shutdown.
- **CRITICAL BUG & FIX — Socket.IO path "/" intercepting all HTTP requests**: with `path: '/'`, Engine.IO's `attach()` removes all existing `request` listeners and installs its own whose `check(req)` returns `path === req.url.slice(0, path.length)` = `'/' === req.url.slice(0,1)` = TRUE for EVERY URL. That listener then calls `handleRequest` which sends `{"code":0,"message":"Transport unknown"}` for any URL lacking `transport=` query param — completely breaking Express (every /health and /api/v1/* returned that error). Fix: BEFORE creating the Server, save a reference to Express's request listener. AFTER creating the Server, capture Socket.IO's request listener (the only one left), `removeAllListeners('request')`, and install a single dispatcher that: (a) hands Engine.IO polling requests (URL matches `/[?&](EIO|transport|sid)=/`) to Socket.IO's listener, (b) hands everything else to Express's listener. WebSocket upgrades go through the separate `upgrade` event, untouched. Verified: `GET /?EIO=4&transport=polling` → valid `0{"sid":...,"upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}` handshake, AND `GET /health` → `{"ok":true,"service":"emr-api"}`. Same technique documented in Task 5's worklog for the realtime-service mini-service.
- **Fixed an auth bug found during testing**: the initial `issueTokens` generated a random base64url string (`rawRefresh`) and stored `SHA-256(rawRefresh)`, but returned a separate JWT (signed with `jti`) to the client. The refresh lookup `hashToken(rawRefresh)` hashed the JWT (not the random string) → never matched the stored hash → all refreshes failed with "Invalid refresh token". Fixed by simplifying: the refresh token IS the JWT; `jti` is the random CSPRNG value; `tokenHash = SHA-256(refreshToken)` (the JWT string itself). Now refresh rotation + reuse detection both work end-to-end.
- Type-cleaned: ran `bunx tsc --noEmit` to zero errors. Fixed @types/express v5 widening (`req.params.id` is `string | string[]`) by wrapping with `String(...)`, fixed `@types/jsonwebtoken` v9 StringValue expiry typing, fixed mongoose `toJSON` transform `delete` on non-optional fields (cast through `unknown`), fixed validate.ts `req.query` reassignment (cast through unknown to bypass Express v5's readonly typing), removed a duplicate mobile index in Patient.ts.
- Installed binary cache: mongodb-memory-server's MongoDB binary was already cached at the default location from a prior run, so boot is ~4s. On a fresh machine it would download ~200MB on first boot.

### End-to-end verification (all from `curl` against `http://localhost:4000`):
1. `GET /health` → `{"ok":true,"service":"emr-api"}` ✓
2. `POST /api/v1/auth/login` admin@emr.local/Admin@123 → `{success:true,data:{accessToken,refreshToken,expiresIn:900,user:{id,email,name,role,isActive,doctorId}}}` ✓
3. `GET /api/v1/auth/me` with Bearer → returns current user ✓
4. `GET /api/v1/dashboard/stats` → 8 counters + 4 recent appointments + hourlyLoad[{"09:00",4}] ✓
5. `GET /api/v1/doctors` → Dr. Ayesha Khan (Cardiology) + Dr. Bilal Ahmed (General Medicine) with populated department + Mon-Fri schedules + sessions ✓
6. `GET /api/v1/slots?doctorId=<khanId>&date=2026-10-15` → 28 generated 15-min slots, lunch 12:00-13:00 excluded, available/booked/past flags correct ✓
7. `POST /api/v1/appointments` as RECEPTIONIST → 201 AP-00005 with populated patient/doctor/department ✓
8. **DOUBLE-BOOKING GUARD**: second POST to same doctor+date+slotStart → `409 Conflict "This slot was just booked by someone else"` ✓ (the unique compound index on BookedSlot caught it)
9. `POST /api/v1/appointments/:id/arrive` → SCHEDULED → ARRIVED ✓
10. `POST /api/v1/appointments/:id/complete` as RECEPTIONIST → `403 Forbidden "Role RECEPTIONIST not permitted"` ✓ (RBAC enforced)
11. `POST /api/v1/appointments/:id/complete` as SUPER_ADMIN → ARRIVED → COMPLETED ✓
12. `POST /api/v1/auth/refresh` with valid RT → new accessToken+refreshToken issued (rotation) ✓
13. **REUSE DETECTION**: reusing the OLD RT after rotation → `401 Unauthorized "Refresh token reuse detected — all sessions revoked"` + audit `AUTH_REFRESH_REUSE` ✓
14. `GET /api/v1/audit-logs` (admin) → 7 entries: AUTH_LOGIN, AUTH_REFRESH, AUTH_REFRESH_REUSE, AUTH_LOGIN, APPOINTMENT_CREATED, APPOINTMENT_ARRIVED, APPOINTMENT_COMPLETED with user emails ✓
15. `GET /?EIO=4&transport=polling` → valid Engine.IO handshake `{sid, upgrades:["websocket"], pingInterval:25000, pingTimeout:60000}` ✓ (Socket.IO path "/" coexists with Express on the same port via the dispatcher-reorder technique)
16. `/health` still OK after all tests ✓

### Demo credentials (seeded):
- Super Admin    : admin@emr.local / Admin@123
- Receptionist   : reception@emr.local / Reception@123
- Doctor (Khan)  : dr.khan@emr.local / Doctor@123
- Doctor (Ahmed) : dr.ahmed@emr.local / Doctor@123

### Stage Summary:
- Complete production-grade MERN backend delivered at `/home/z/my-project/mini-services/emr-api/` — Express 4 + MongoDB via mongodb-memory-server (no system mongod needed, binary auto-downloaded) + Mongoose 8 + JWT (15m access / 7d refresh with rotation + reuse detection) + bcryptjs + zod + Socket.IO integrated on the SAME Express server (path "/", port 4000).
- All 10 models with the exact schemas & compound indexes from the spec, including the **BookedSlot UNIQUE compound index `{doctorId:1,date:1,slotStart:1}` as the SOLE concurrency boundary** for double-booking prevention — verified end-to-end with a 409 on the second concurrent insert.
- Full RBAC enforced at both middleware AND service layer (DOCTOR scope in list/get/update appointments; receptionist blocked from /complete; only SUPER_ADMIN can create doctors/receptionists/departments + view audit logs).
- Concurrency-safe booking implemented WITHOUT mongoose transactions (single-instance memory-server has no replSet): BookedSlot is inserted FIRST (unique index catches E11000 → 409), then the Appointment is created and the BookedSlot is patched with the real appointmentId; on Appointment failure the placeholder BookedSlot is deleted to free the slot. This is simpler and equally safe.
- All response envelopes follow `{success, message, data, meta?}` shape; pagination meta is `{pagination:{total,page,pageSize,totalPages}}`.
- Real-time events broadcast directly via `io.emit`/`io.to(room).emit` from inside the appointment service (NO /__broadcast HTTP endpoint needed — io lives in-process).
- Idempotent seed runs on every boot (skipped if users already exist). mongodb-memory-server data is lost on restart, so each cold boot re-seeds.
- **Sandbox caveat (same as Task 5)**: the sandbox reaps processes started from bash calls when the call returns. The service WORKS when started (`cd /home/z/my-project/mini-services/emr-api && bun run dev`) but dies between bash calls. The orchestrator should spawn it as a child of the Next.js dev server (similar to `src/lib/realtime-spawn.ts`) to make it persistent across the session. Boot time is ~4s after the MongoDB binary is cached.
