# Personify — Server

Express + Mongoose + Socket.io + BullMQ backend for the Personify AI UX testing platform.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| HTTP server | Express 5 (ES modules) |
| Database | MongoDB via Mongoose |
| Real-time | Socket.io |
| Job queue | BullMQ + ioredis (optional — degrades gracefully when Redis is offline) |
| Ownership verification | Fetch-based meta tag / txt file check |

---

## Prerequisites

- **Node.js** v18+
- **MongoDB** running locally on port 27017 (or set `MONGODB_URI` in `.env`)
- **Redis** on port 6379 _(optional)_ — BullMQ is disabled automatically when Redis is offline

---

## Setup

```bash
# From the /server directory:
npm install

# Copy and edit environment variables
cp .env.example .env
```

### `.env` variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP server port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/personify` | MongoDB connection string |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis URL (BullMQ) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `JWT_SECRET` | _(set this)_ | For future auth |
| `NODE_ENV` | `development` | Set `production` to enable strict ownership verification |

---

## Running the Server

```bash
# Development (auto-restarts on file change)
npm run dev

# Production
npm start
```

Server starts at **http://localhost:5000** (or your `PORT`).

---

## Seeding Personas

Populates MongoDB with 50 realistic personas (12 core + 38 generated from a trait matrix):

```bash
npm run seed
```

Personas cover: Gen-Z teens, Millennials, Adults, Seniors — across multiple devices, languages, and accessibility needs.

---

## API Routes

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + queue status |

### Runs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/runs` | Create a new test run (returns `verificationToken`) |
| GET | `/api/runs` | List all runs (query: `status`, `page`, `limit`) |
| GET | `/api/runs/:id` | Get a single run |
| PATCH | `/api/runs/:id` | Update run status/summary |
| GET | `/api/runs/:id/sessions` | Get all sessions for a run |
| POST | `/api/runs/:id/verify-ownership` | Verify domain ownership |

### Personas

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/personas` | List personas (query: `search`, `tag`, `page`, `limit`) |
| POST | `/api/personas` | Create a custom persona |
| GET | `/api/personas/:id` | Get a single persona |
| PATCH | `/api/personas/:id` | Update persona |
| DELETE | `/api/personas/:id` | Delete persona |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions/:id` | Get a session with persona + run details |
| GET | `/api/sessions/:id/steps` | Get all steps for a session |
| POST | `/api/sessions/:id/steps` | Add a step (used by workers) |

---

## Ownership Verification

When a run is created for a non-localhost URL, it starts in `pending_verification` status.

The API returns:
```json
{
  "verificationToken": "abc123...",
  "verificationInstructions": {
    "metaTag": "<meta name=\"personify-verify\" content=\"abc123...\">",
    "txtFile": "Create /personify-verify.txt containing: abc123..."
  }
}
```

Call `POST /api/runs/:id/verify-ownership` to trigger the check. The server will:
1. Fetch `{url}/personify-verify.txt` and look for the token
2. Fetch `{url}` HTML and look for the meta tag
3. In `NODE_ENV=development`, **localhost** / **127.0.0.1** auto-passes

On success: status moves to `queued` and BullMQ (if Redis is available) kicks off the simulation.

---

## Socket.io Events

Connect to `http://localhost:5000` with Socket.io and join a run room:

```js
const socket = io('http://localhost:5000');
socket.emit('join:run', runId);
```

### Emitted events

| Event | Payload |
|-------|---------|
| `run:created` | `{ runId, status, verificationToken }` |
| `run:started` | `{ runId, personaCount }` |
| `session:started` | `{ sessionId, personaName, personaAvatar }` |
| `step` | `{ sessionId, personaName, stepIndex, action, x, y, thought, emotion, frustration }` |
| `emotion` | `{ sessionId, personaName, emotion, frustration }` |
| `session:finished` | `{ sessionId, personaName, outcome, frustrationScore }` |
| `run:finished` | `{ runId, summary }` |

---

## Testing Routes

```bash
# Start the server first, then in another terminal:
npm run test:routes
```

Expected output:
```
=== Personify API Route Tests ===
✓ GET /health
✓ GET /api/personas (empty or seeded)
✓ POST /api/personas (create test persona)
✓ GET /api/personas/:id
✓ POST /api/runs (create run)
✓ GET /api/runs (list runs)
✓ GET /api/runs/:id
✓ GET /api/runs/:id/sessions (empty)
✓ POST /api/runs/:id/verify-ownership (localhost bypass in dev)
✓ GET /api/nonexistent (404 handler)

Results: 10 passed, 0 failed
```

---

## Project Structure

```
server/
├── src/
│   ├── index.js              # Entry point: Express + Socket.io + BullMQ
│   ├── config/
│   │   ├── db.js             # Mongoose connection
│   │   └── redis.js          # ioredis client (graceful offline)
│   ├── models/
│   │   ├── Run.js
│   │   ├── Persona.js
│   │   ├── Session.js
│   │   └── Step.js
│   ├── routes/
│   │   ├── runs.js
│   │   ├── personas.js
│   │   └── sessions.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── verifyOwnership.js
│   └── workers/
│       ├── personas.js        # Seed script (50 personas)
│       └── simulationWorker.js # BullMQ job processor
├── scripts/
│   └── testRoutes.js          # Route test runner
├── .env
├── .env.example
└── package.json
```
