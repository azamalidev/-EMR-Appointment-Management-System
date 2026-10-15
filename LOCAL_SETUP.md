# Local Setup — Run on Your Machine

This project is **MERN**: Express + MongoDB (backend) + React/Next.js (frontend).
Follow these steps to run both locally.

## Prerequisites

Install these first:

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 18+ | https://nodejs.org |
| **Bun** | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| **Git** | any | https://git-scm.com |

> **Why Bun?** It's a fast all-in-one runtime that replaces Node + npm. The
> backend uses `bun --hot` for instant reloads on file changes. You *can* use
> `npm`/`node` instead if you prefer — see the note at the bottom.

---

## Step 1 — Clone the repo

```bash
git clone <your-repo-url> emr
cd emr
```

---

## Step 2 — Start the backend (Express + MongoDB)

The backend uses `mongodb-memory-server`, which **downloads a real MongoDB
binary automatically** on first run — no need to install MongoDB separately.

```bash
cd mini-services/emr-api

# Install dependencies
bun install

# Start the dev server (with hot reload)
bun run dev
```

You'll see output like:
```
[db] MongoDB connected (memory-server) mongodb://127.0.0.1:44035/
[seed] Departments created: Cardiology, General Medicine, ...
[seed] Users + Doctors created.
[seed] Schedules created for both doctors (Mon-Fri, 09-17 with lunch break).
[seed] Patients created: 4
[seed] Sample appointments booked for ...
[server] EMR API (Express + MongoDB) on port 4000
[server] Socket.IO listening on path "/" (CORS "*")
```

**The backend is now running on http://localhost:4000**

Test it in another terminal:
```bash
curl http://localhost:4000/health
# → {"ok":true,"service":"emr-api"}
```

> **Note:** Data lives in RAM (mongodb-memory-server). It auto-seeds on every
> restart, so you always start fresh. If you want a persistent MongoDB instead,
> see "Using a real MongoDB" at the bottom.

---

## Step 3 — Start the frontend (Next.js + React)

Open a **new terminal** (keep the backend running in the first one):

```bash
# From the project root (not inside mini-services/emr-api)
cd ..   # if you're still in mini-services/emr-api

# Install dependencies
bun install

# Create your local env file
cp .env.local.example .env.local
```

Check `.env.local` — it should contain:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```
This tells the frontend where the backend is. (Without it, the frontend tries
the sandbox gateway and won't find the backend.)

Now start the dev server:
```bash
bun run dev
```

You'll see:
```
▲ Next.js 16.1.3 (Turbopack)
- Local: http://localhost:3000
✓ Ready in 600ms
```

**The frontend is now running on http://localhost:3000**

---

## Step 4 — Open the app

Go to **http://localhost:3000** in your browser.

### Demo accounts (auto-seeded)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@emr.local` | `Admin@123` |
| Receptionist | `reception@emr.local` | `Reception@123` |
| Doctor (Cardiology) | `dr.khan@emr.local` | `Doctor@123` |
| Doctor (Gen. Medicine) | `dr.ahmed@emr.local` | `Doctor@123` |

Click any account on the login page to autofill, then sign in.

---

## Step 5 — Verify it works

1. **Login** as Receptionist → you should see the dashboard with today's stats.
2. Click **Book Appointment** → pick a doctor → pick a date → click an available
   slot → search for a patient → confirm. You should see "Appointment booked".
3. Click **Appointments** → the new appointment should appear in the list.
4. Log out, log in as **Doctor** (dr.khan) → you should only see that doctor's
   appointments (RBAC scoping).

---

## Project structure (what runs where)

```
emr/
├── mini-services/
│   └── emr-api/          ← BACKEND: Express + MongoDB (port 4000)
│       ├── src/
│       │   ├── server.ts        # Entry point
│       │   ├── models/          # Mongoose schemas
│       │   ├── routes/          # Express routers (/api/v1/*)
│       │   ├── services/        # Business logic
│       │   └── seed.ts          # Auto-seeds on startup
│       └── package.json
│
├── src/                  ← FRONTEND: Next.js + React (port 3000)
│   ├── app/page.tsx             # Root page
│   ├── components/views/        # Dashboard, Scheduler, Appointments, etc.
│   └── lib/api-client.ts        # Calls the backend
│
├── .env.local            ← Tells frontend where backend is
└── package.json
```

---

## Common commands

| Command | Where | What it does |
|---------|-------|-------------|
| `bun run dev` | `mini-services/emr-api/` | Start backend (port 4000, hot reload) |
| `bun run dev` | project root | Start frontend (port 3000, hot reload) |
| `bun run lint` | project root | Check code quality |
| `curl localhost:4000/health` | any terminal | Check backend is alive |

---

## Troubleshooting

**"Cannot find module" / import errors**
→ Make sure you ran `bun install` in **both** the project root AND
  `mini-services/emr-api/`.

**Frontend shows "Network request failed" or blank page**
→ Check the backend is running (`curl localhost:4000/health`).
→ Check `.env.local` exists and has `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`.
→ Restart the frontend (`Ctrl+C`, then `bun run dev` again).

**Port 4000 already in use**
→ Another process is using it. Either kill it or change the port in
  `mini-services/emr-api/src/server.ts` (search for `4000`) AND update
  `.env.local` to match.

**MongoDB download is slow on first run**
→ `mongodb-memory-server` downloads ~200MB MongoDB binary on first start.
  It's cached after that. Be patient the first time (~1-2 min).

---

## Optional: Using a real persistent MongoDB

If you want data to persist across restarts (instead of in-memory):

1. Install MongoDB locally or use MongoDB Atlas (free tier).
2. Edit `mini-services/emr-api/src/config/database.ts`:

```typescript
// Replace the mongodb-memory-server block with:
await mongoose.connect('mongodb://localhost:27017/emr');
// or for Atlas: 'mongodb+srv://<user>:<pass>@cluster.mongodb.net/emr'
```

3. Comment out or remove the `MongoMemoryServer` lines.
4. Restart the backend. The seed will run once (it's idempotent — won't
   duplicate data on restart).

---

## Optional: Using npm/node instead of Bun

If you don't want to install Bun, you can use npm:

**Backend:**
```bash
cd mini-services/emr-api
npm install
npm run dev    # uses: bun --hot src/server.ts
# If you don't have bun, change the script in package.json to:
#   "dev": "tsx watch src/server.ts"
# and install tsx: npm install -D tsx
```

**Frontend:**
```bash
npm install
npm run dev
```

Bun is recommended (faster, better hot reload), but npm works too.
