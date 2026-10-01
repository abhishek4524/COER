// ─── Load env FIRST before any other import reads process.env ─────────────────
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';

import { connectDB } from './config/db.js';
import { redisConnection } from './config/redis.js';

import runsRouter from './routes/runs.js';
import personasRouter from './routes/personas.js';
import sessionsRouter from './routes/sessions.js';
import errorHandler from './middleware/errorHandler.js';
import { processAgentRun } from './workers/agent.js';

const app = express();
const httpServer = createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps) or matching origin
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  // Client joins a run room to receive live events
  socket.on('join:run', (runId) => {
    socket.join(`run:${runId}`);
    console.log(`[socket] ${socket.id} joined room run:${runId}`);
  });

  socket.on('leave:run', (runId) => {
    socket.leave(`run:${runId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

// ─── BullMQ Setup (optional — degrades gracefully if Redis is offline) ────────
let simulationQueue = null;

const AGENT_CONCURRENCY = Number(process.env.AGENT_CONCURRENCY) || 5;


async function setupQueue() {
  // Quick TCP probe — skip BullMQ entirely if Redis is unreachable
  const redisUp = await new Promise((resolve) => {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const match = url.match(/(?:redis:\/\/)?([^:]+):(\d+)/);
    const host = match?.[1] || '127.0.0.1';
    const port = Number(match?.[2]) || 6379;
    import('net').then(({ createConnection }) => {
      const s = createConnection({ host, port });
      s.setTimeout(1500);
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error',   () => { s.destroy(); resolve(false); });
      s.once('timeout', () => { s.destroy(); resolve(false); });
    }).catch(() => resolve(false));
  });

  if (!redisUp) {
    console.warn('[BullMQ] Redis not reachable — running in no-queue mode. Simulations will run inline.');
    return;
  }

  try {
    const { Queue, Worker } = await import('bullmq');

    simulationQueue = new Queue('simulation', { connection: redisConnection });
    app.set('simulationQueue', simulationQueue);

    // Worker that processes agent runs via Playwright + LLM
    const worker = new Worker(
      'simulation',
      async (job) => {
        const { runId } = job.data;
        console.log(`[worker] Processing agent run ${runId}`);
        return await processAgentRun(runId, io);
      },
      { connection: redisConnection, concurrency: AGENT_CONCURRENCY }
    );

    worker.on('completed', (job, result) => {
      console.log(`[worker] Job ${job.id} completed. Success rate: ${result?.taskSuccessRate ?? '?'}%`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[worker] Job ${job?.id} failed:`, err.message);
    });

    console.log(`[BullMQ] Queue and worker ready (concurrency=${AGENT_CONCURRENCY}).`);
  } catch (err) {
    console.warn('[BullMQ] Could not initialize:', err.message);
    console.warn('[BullMQ] Running in no-queue mode.');
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Serve Playwright screenshots
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use('/screenshots', express.static(join(__dirname, '../../screenshots')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    queue: simulationQueue ? 'active' : 'disabled (Redis offline)',
    agentConcurrency: AGENT_CONCURRENCY,
  });
});

app.use('/api/runs', runsRouter);
app.use('/api/personas', personasRouter);
app.use('/api/sessions', sessionsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Centralized error handler (must be last)
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await setupQueue();

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Personify server running on http://localhost:${PORT}`);
    console.log(`   Socket.io ready`);
    console.log(`   MongoDB connected`);
    console.log(`   BullMQ: ${simulationQueue ? 'active' : 'disabled'}\n`);
  });
}

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});

export { app, httpServer, io };
