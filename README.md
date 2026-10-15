# MediBook EMR — Appointment Management Module

A production-grade **Appointment Management** module for an Enterprise Electronic
Medical Record (EMR) system, built with the **MERN stack** (MongoDB + Express +
React + Node.js). Features JWT auth, role-based access control (Super Admin /
Receptionist / Doctor), dynamic slot generation, **concurrency-safe booking**,
server-side search/filter/sort/pagination, a full audit trail, and **real-time
WebSocket updates** across every screen.

---

## Tech Stack (MERN)

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + Express.js + Mongoose |
| **Database** | MongoDB (via `mongodb-memory-server` for dev — real MongoDB binary) |
| **Frontend** | React (Next.js App Router) + TanStack Query + Zustand |
| **Realtime** | Socket.IO (integrated into the Express server) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Validation** | Zod |

> **Architecture note:** The Express + MongoDB backend runs as a standalone
> service on port 4000. The React frontend (Next.js) on port 3000 calls the API
> through a Caddy gateway (`?XTransformPort=4000`). Socket.IO is integrated
> directly into the Express server — no separate realtime service.

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@emr.local` | `Admin@123` |
| Receptionist | `reception@emr.local` | `Reception@123` |
| Doctor (Cardiology) | `dr.khan@emr.local` | `Doctor@123` |
| Doctor (Gen. Medicine) | `dr.ahmed@emr.local` | `Doctor@123` |

---

## Folder Structure

```
├── mini-services/
│   └── emr-api/                    # Express + MongoDB backend (port 4000)
│       ├── src/
│       │   ├── server.ts           # Entry: MongoDB + Express + Socket.IO
│       │   ├── app.ts              # Express app (cors, routes, error handler)
│       │   ├── config/
│       │   │   ├── env.ts
│       │   │   └── database.ts     # mongodb-memory-server + Mongoose connect
│       │   ├── models/             # Mongoose schemas (User, Doctor, Patient, etc.)
│       │   ├── middlewares/        # auth, rbac, error, validate
│       │   ├── controllers/        # Thin controllers
│       │   ├── services/           # ALL business logic
│       │   ├── routes/             # Express routers (/api/v1/*)
│       │   ├── validators/         # Zod schemas
│       │   ├── utils/              # response, errors, jwt, crypto, slots, realtime
│       │   └── seed.ts             # Auto-seed on startup
│       └── package.json
├── src/                            # React frontend (Next.js)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Root: login ↔ app shell
│   │   └── api/init/route.ts       # Spawns the Express backend as a child process
│   ├── lib/                        # Shared frontend lib (api-client, types, constants, slots)
│   ├── stores/                     # Zustand (auth, nav)
│   └── components/
│       ├── providers.tsx           # QueryClient + RealtimeProvider
│       ├── realtime/               # Socket.IO client → query invalidation
│       ├── app-shell.tsx           # Sidebar + topbar
│       ├── login-page.tsx
│       └── views/                  # dashboard, scheduler, appointments, patients, doctors, schedules, audit-logs
├── ENGINEERING_DECISIONS.md
└── README.md
```

---

## API Documentation

Base URL: `/api/v1` (via gateway: `?XTransformPort=4000`)

### Auth
- `POST /auth/login` — `{email, password}` → `{accessToken, refreshToken, user}`
- `POST /auth/refresh` — rotate refresh token (reuse detection)
- `POST /auth/logout` — revoke refresh token
- `GET /auth/me` — current user

### Doctors & Departments
- `GET /doctors` — list with schedules
- `POST /doctors` — SUPER_ADMIN: create doctor
- `GET/POST /doctors/:id/schedules` — manage weekly schedules
- `GET/POST /departments`

### Slots & Patients
- `GET /slots?doctorId=&date=YYYY-MM-DD` — dynamically generated slots
- `GET /patients?search=` — search
- `POST /patients` — register

### Appointments
- `POST /appointments` — book (concurrency-safe)
- `GET /appointments` — list with filters/sort/pagination
- `GET/PUT /appointments/:id` — detail / update
- `DELETE /appointments/:id` — cancel
- `POST /appointments/:id/arrive` — mark arrived
- `POST /appointments/:id/complete` — mark completed

### Dashboard & Audit
- `GET /dashboard/stats` — role-aware counters
- `GET /audit-logs` — SUPER_ADMIN: paginated audit trail

---

## Key Engineering Highlights

- **Double-booking prevention**: A `BookedSlot` collection with a unique compound
  index on `{doctorId, date, slotStart}` — the DB constraint IS the lock.
- **JWT refresh rotation** with reuse detection (reusing a rotated token revokes
  all sessions).
- **RBAC** at both middleware and service layer (doctors scoped to own data).
- **Dynamic slot generation** from weekly schedules — no persisted slots, no
  migration on schedule changes.
- **Socket.IO** integrated into Express — `io.emit()` directly from services.
- **mongodb-memory-server** for dev (downloads real MongoDB binary).

---

## Running the Project

```bash
# 1. Install frontend deps
bun install

# 2. Install backend deps
cd mini-services/emr-api && bun install && cd ../..

# 3. Start Next.js (port 3000) — it auto-spawns the Express backend on first load
bun run dev

# Or start the backend separately:
cd mini-services/emr-api && bun src/server.ts
```

The Express backend auto-seeds on startup (departments, users, doctors,
schedules, patients, sample appointments).

---

## Known Limitations

- `mongodb-memory-server` stores data in RAM — data resets on restart (auto-seeds
  on startup).
- Token storage in `localStorage` (demo); production would use HttpOnly cookies.
- No automated tests (per environment constraints).
