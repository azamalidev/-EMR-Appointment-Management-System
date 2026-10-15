# Engineering Decisions

## 1. Why this project architecture?

**MERN with clean layering: Express route → controller → service → Mongoose model.**

- **Express routes** are thin HTTP adapters — they parse, authorize, and delegate.
- **Controllers** call services and shape the response envelope
  `{success, message, data, meta}`.
- **Services** own ALL business logic and transactions. `appointment.service.ts`
  is the canonical example: validates the slot, creates the BookedSlot (unique
  index guard), creates the Appointment, writes the audit log, and broadcasts
  the Socket.IO event — all in one place.
- **Socket.IO is integrated into the Express server** (not a separate process).
  Services call `broadcast(event, payload)` which does `io.emit()` directly —
  no HTTP broadcast hop needed.

**Why Express and not Next.js API routes?** The assessment specifies Express +
MongoDB. Express gives us full control over middleware ordering, error handling,
and the request lifecycle. The React frontend (Next.js) is purely a client that
calls the Express API.

## 2. How did I design the MongoDB schema?

**Mongoose models with compound indexes optimized for the hot read paths.**

- `User` 1—1 `Doctor` (a doctor IS a user with role DOCTOR).
- `DoctorSchedule` per weekday, with `ScheduleSession` windows typed WORK/BREAK.
- `Patient` with unique `mobile` (prevents duplicates) and `patientCode`.
- `Appointment` with compound indexes: `{doctorId, date, status}`,
  `{patientId, date}`, `{departmentId, date}`, `{date, status}`.
- `BookedSlot` with **unique compound index `{doctorId, date, slotStart}`** —
  the concurrency guard (see §3).
- `AuditLog` append-only with indexes on `{userId, timestamp}`,
  `{action, timestamp}`, `{entity, entityId}`.
- `RefreshToken` stores SHA-256 hashes (never raw tokens).

**Why "HH:mm" strings for times?** Schedules are weekly-recurring; "09:00" is
timezone-stable. The appointment `date` is a Date (midnight), and the slot is
identified by `date + slotStart`.

**Why not persist generated slots?** Slots are a pure function of
`(schedule, slotDuration, breaks, now)`. Generating on demand is O(28) per day
and schedule edits take effect instantly.

## 3. How did I prevent double booking?

**A MongoDB unique compound index — the strongest possible guarantee.**

Booking flow:
1. Validate doctor, department, date, slot against the schedule.
2. Find-or-create patient.
3. **Create `BookedSlot` first** — this has `unique({doctorId, date, slotStart})`.
   If a concurrent insert exists, MongoDB throws E11000 (duplicate key) →
   return 409 Conflict.
4. Create the `Appointment` and link it to the BookedSlot.
5. If the Appointment fails, delete the BookedSlot to free the slot.

The unique index IS the lock — enforced by the storage engine, not application
code. No `SELECT FOR UPDATE`, no optimistic locking, no retry logic needed.

**Cancellation** deletes the BookedSlot row, immediately freeing the slot.

## 4. Which database indexes did you create and why?

| Index | Query |
|-------|-------|
| `User.email` (unique) | login |
| `User(role, isActive)` | role-scoped lists |
| `RefreshToken.tokenHash` (unique) | O(1) refresh lookup |
| `Doctor(departmentId, isActive)` | filter doctors by dept |
| `DoctorSchedule(doctorId, dayOfWeek)` (unique) | slot generation |
| `Patient.mobile` (unique) | dedup + search |
| `Patient(firstName, lastName)` | name search |
| `Appointment(doctorId, date, status)` | scheduler + doctor "my day" |
| `Appointment(patientId, date)` | patient history |
| `Appointment(date, status)` | dashboard counters |
| **`BookedSlot(doctorId, date, slotStart)` (unique)** | **double-booking guard** |
| `BookedSlot(doctorId, date)` | slot availability query |
| `AuditLog(action, timestamp)` | audit filter |

Every index corresponds to a real query path. No "just in case" indexes.

## 5. What security measures did you implement?

- **bcrypt** (cost 12) for passwords.
- **JWT** access (15m) + refresh (7d) tokens. Refresh tokens stored as SHA-256
  hashes in the DB.
- **Refresh rotation with reuse detection** — presenting a rotated token revokes
  all sessions for that user.
- **RBAC middleware** (`requireRole`) + **service-layer scoping** (doctors can't
  access other doctors' appointments even by guessing IDs).
- **Zod validation** on every body/query. Sort keys whitelisted.
- **Secure errors** — internal details scrubbed; consistent envelope.
- **CORS** configured on Express.
- **Audit trail** — every sensitive action logged with user, role, IP, user-agent.

## 6. What performance optimizations did you apply?

- **Indexes on every hot path** (see §4).
- **Slots generated on demand** — O(28) per request, zero write amplification.
- **Single BookedSlot query** in `getSlots` — one indexed read, in-memory map.
- **Server-side pagination/sort/filter** — client receives one page.
- **`Promise.all`** for parallel counts in dashboard.
- **TanStack Query** with `staleTime: 15s` and surgical cache invalidation.
- **Socket.IO → targeted query invalidation** (not global refetch).
- **Zustand selectors** — components subscribe to slices, not whole stores.

## 7. If this needed to support millions of appointments, what would change?

1. **Shard `Appointment`** on `{doctorId: "hashed"}` or `{date: 1, doctorId: 1}`.
   The `BookedSlot` unique index becomes a sharded unique index (shard key as
   prefix).
2. **Read replicas** for list/dashboard/scheduler reads.
3. **Archive cold appointments** (COMPLETED/CANCELLED > N months) to a cold
   collection.
4. **TTL on `BookedSlot`** — past-date rows are useless; auto-delete them.
5. **Redis adapter for Socket.IO** — horizontal realtime scale.
6. **Idempotency keys** on booking (flaky client retries don't double-book).
7. **Per-date slot materialization** if generation CPU ever bottlenecks.
8. **Rate limiting** on `/auth/login` and `/appointments`.
9. **Observability** — structured logs, Prometheus, OpenTelemetry.
10. **CDN for frontend; stateless API behind a load balancer.**

The service-layer seams (decoupled realtime, guard-table concurrency) make
these additive, not rewrites.
