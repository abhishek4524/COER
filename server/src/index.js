// ─── Load env FIRST before any other import reads process.env ─────────────────
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';

import { connectDB } from './config/db.js';
import { redisConnection } from './config/redis.js';

import User from './models/User.js';
import Run from './models/Run.js';
import { JWT_SECRET } from './middleware/auth.js';

import authRouter from './routes/auth.js';
import meRouter from './routes/me.js';
import runsRouter from './routes/runs.js';
import personasRouter from './routes/personas.js';
import sessionsRouter from './routes/sessions.js';
import errorHandler from './middleware/errorHandler.js';
import { processAgentRun } from './workers/agent.js';
import { runMigration } from '../scripts/migrateUser.js';

const app = express();
const httpServer = createServer(app);

// ─── Security Middlewares ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());

const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === allowedOrigin || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Socket Authentication Middleware
io.use(async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie;
    let token = null;

    if (rawCookie) {
      const parsed = parseCookie(rawCookie);
      token = parsed.token;
    }

    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      return next(new Error('Authentication required: Token missing'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error('Authentication required: User not found'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication required: Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[socket] Authenticated user connected: ${socket.user.email} (${socket.id})`);

  // Client joins a run room ONLY if they own the run
  socket.on('join:run', async (runId) => {
    try {
      const run = await Run.findById(runId);
      if (!run || !run.userId.equals(socket.user._id)) {
        socket.emit('error', { message: 'Access denied: You do not own this run.' });
        return;
      }
      socket.join(`run:${runId}`);
      console.log(`[socket] ${socket.user.email} joined room run:${runId}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to join run room.' });
    }
  });

  socket.on('leave:run', (runId) => {
    socket.leave(`run:${runId}`);
  });

  // ── Live Persona Preview: watch/unwatch a session's full stream ──
  socket.on('watch:session', async ({ sessionId, runId } = {}) => {
    if (!sessionId) return;
    // Verify ownership of the run
    try {
      if (runId) {
        const run = await Run.findById(runId);
        if (!run || !run.userId.equals(socket.user._id)) {
          socket.emit('error', { message: 'Access denied: You do not own this run.' });
          return;
        }
      }
    } catch {}

    if (!io._sessionWatchers) io._sessionWatchers = new Map();
    if (!io._sessionWatchers.has(sessionId)) {
      io._sessionWatchers.set(sessionId, new Set());
    }
    io._sessionWatchers.get(sessionId).add(socket.id);

    // Track which sessions this socket is watching (for cleanup)
    if (!socket._watchingSessions) socket._watchingSessions = new Set();
    socket._watchingSessions.add(sessionId);

    const count = io._sessionWatchers.get(sessionId).size;
    console.log(`[socket] ${socket.user.email} watching session ${sessionId} (total: ${count})`);
    socket.emit('watch:ack', { sessionId, watching: true });
  });

  socket.on('unwatch:session', ({ sessionId } = {}) => {
    if (!sessionId) return;
    if (io._sessionWatchers?.has(sessionId)) {
      io._sessionWatchers.get(sessionId).delete(socket.id);
    }
    socket._watchingSessions?.delete(sessionId);
    socket.emit('watch:ack', { sessionId, watching: false });
  });

  socket.on('disconnect', () => {
    // Clean up all watcher subscriptions on disconnect
    if (socket._watchingSessions && io._sessionWatchers) {
      for (const sessionId of socket._watchingSessions) {
        io._sessionWatchers.get(sessionId)?.delete(socket.id);
      }
    }
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

// ─── BullMQ Setup (optional — degrades gracefully if Redis is offline) ────────
let simulationQueue = null;

const AGENT_CONCURRENCY = Number(process.env.AGENT_CONCURRENCY) || 5;

async function setupQueue() {
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

// ─── Serve Screenshots ────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
const SCREENSHOTS_DIR = path.resolve('screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// ─── Lifecycle Cleanup ────────────────────────────────────────────────────────
async function cleanupLifecycleRuns() {
  try {
    const { default: Session } = await import('./models/Session.js');
    const { default: Step } = await import('./models/Step.js');

    const staleRuns = await Run.find({ status: { $in: ['running', 'queued'] } });
    for (const r of staleRuns) {
      r.status = 'failed';
      r.summary = {
        ...(r.summary || {}),
        schemaVersion: 2,
        errorMessage: 'Server restarted',
      };
      r.completedAt = new Date();
      await r.save();

      await Session.updateMany(
        { runId: r._id, outcome: 'in_progress' },
        { outcome: 'gave_up', finalFeedback: 'Session aborted: server restarted.' }
      );
    }
    if (staleRuns.length > 0) {
      console.log(`[lifecycle] Marked ${staleRuns.length} stale running runs as failed (Server restarted).`);
    }
  } catch (err) {
    console.error('[lifecycle] Stale runs cleanup warning:', err.message);
  }
}

app.get(['/health', '/api/health'], async (req, res) => {
  let mongo = 'unknown';
  try {
    const { default: mongoose } = await import('mongoose');
    mongo = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch { mongo = 'error'; }

  const redisUp = await new Promise((resolve) => {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const match = url.match(/(?:redis:\/\/)?([^:]+):(\d+)/);
    const host = match?.[1] || '127.0.0.1';
    const port = Number(match?.[2]) || 6379;
    import('net').then(({ createConnection }) => {
      const s = createConnection({ host, port });
      s.setTimeout(800);
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => { s.destroy(); resolve(false); });
      s.once('timeout', () => { s.destroy(); resolve(false); });
    }).catch(() => resolve(false));
  });

  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    services: {
      mongo,
      redis: redisUp ? 'connected' : 'offline',
      bullmq: simulationQueue ? 'active' : 'disabled (Redis offline — inline mode)',
      llm: `${process.env.LLM_PROVIDER || 'mock'} / ${process.env.OPENROUTER_MODEL || 'n/a'}`,
      playwright: 'installed',
    },
    agentConcurrency: AGENT_CONCURRENCY,
  });
});

import billingRouter from './routes/billing.js';
import webhookRouter from './routes/webhooks.js';
import { PLANS } from './config/plans.js';

// ─── Mount API Routes ────────────────────────────────────────────────────────
app.use('/api/webhooks', webhookRouter);
app.get('/api/plans', (req, res) => res.json({ success: true, data: PLANS }));

// Public shared report route (unprotected, read-only)
app.get('/api/shared/:token', async (req, res, next) => {
  try {
    const { default: Run } = await import('./models/Run.js');
    const { default: Session } = await import('./models/Session.js');
    const { default: Step } = await import('./models/Step.js');
    const { buildRunMetrics, buildPerPersonaTypeScores, buildDropOffFunnel } = await import('./services/aggregator.js');

    const run = await Run.findOne({ shareToken: req.params.token });
    if (!run) return res.status(404).json({ success: false, error: 'Shared report not found or link revoked.' });

    if (run.shareExpiresAt && new Date() > new Date(run.shareExpiresAt)) {
      return res.status(410).json({ success: false, error: 'Shared report link has expired.' });
    }

    const sessions = await Session.find({ runId: run._id })
      .populate('personaId', 'name age traits avatarSet avatar')
      .sort({ createdAt: 1 })
      .lean();

    const allSteps = await Step.find({ runId: run._id }).sort({ stepIndex: 1, ts: 1 }).lean();

    const sessionsWithSteps = sessions.map((s) => ({
      ...s,
      steps: allSteps.filter((st) => st.sessionId?.toString() === s._id?.toString()),
    }));

    const metrics = buildRunMetrics(sessionsWithSteps);
    const personaTypeScores = (run.summary?.personaTypeScores?.length > 0)
      ? run.summary.personaTypeScores
      : buildPerPersonaTypeScores(sessions);
    const funnel = (run.summary?.funnel?.length > 0)
      ? run.summary.funnel
      : buildDropOffFunnel(sessionsWithSteps);

    res.json({
      success: true,
      data: {
        run: {
          url: run.url,
          goal: run.goal,
          status: run.status,
          personaCount: run.personaCount,
          device: run.device,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
        },
        metrics,
        insights: run.summary?.topIssues || [],
        funnel,
        personaTypeScores,
        heatmapPoints: metrics.heatmapPoints,
      },
    });
  } catch (err) {
    next(err);
  }
});
import projectsRouter from './routes/projects.js';
import notificationsRouter from './routes/notifications.js';
import adminRouter from './routes/admin.js';

app.use('/api/billing', billingRouter);
app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/runs', runsRouter);
app.use('/api/personas', personasRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Centralized error handler (must be last)
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start(port = PORT) {
  await connectDB();
  await runMigration();
  await cleanupLifecycleRuns();
  await setupQueue();

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.log(`\n🚀 Personify server running on http://localhost:${port}`);
      console.log(`   Socket.io ready (Authenticated)`);
      console.log(`   MongoDB connected`);
      console.log(`   BullMQ: ${simulationQueue ? 'active' : 'disabled'}\n`);
      resolve(httpServer);
    });
  });
}

const mainFile = process.argv[1]?.replace(/\\/g, '/');
if (mainFile && import.meta.url.endsWith(mainFile)) {
  start().catch((err) => {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
  });
}

export { app, httpServer, io, start };
