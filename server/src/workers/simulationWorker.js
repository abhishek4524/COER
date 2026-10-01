import Run from '../models/Run.js';
import Session from '../models/Session.js';
import Step from '../models/Step.js';
import Persona from '../models/Persona.js';

const EMOTIONS = ['neutral', 'curious', 'confused', 'frustrated', 'happy', 'angry'];
const ACTIONS = ['click', 'scroll', 'type', 'hover', 'navigate', 'rage_click', 'dead_click'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const stepThoughts = [
  "Where is the checkout button?",
  "This form is so confusing...",
  "Why isn't anything happening?",
  "I think I'm on the right page.",
  "This looks good! Let me proceed.",
  "Too many steps, I'm losing patience.",
  "The button is too small on mobile.",
  "I can't find what I'm looking for.",
  "Finally found it!",
  "This page took forever to load.",
];

/**
 * BullMQ worker that processes a single run:
 * - Creates sessions for each persona
 * - Simulates steps and emits Socket.io events
 * - Updates run status when done
 */
export async function processRun(runId, io) {
  const run = await Run.findById(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  const personas = await Persona.find().limit(run.personaCount);
  if (!personas.length) {
    console.warn(`[worker] No personas found in DB for run ${runId}. Using minimal simulation.`);
  }

  await Run.findByIdAndUpdate(runId, { status: 'running' });
  io?.to(`run:${runId}`).emit('run:started', { runId, personaCount: run.personaCount });

  const outcomes = { completed: 0, gave_up: 0 };

  for (let i = 0; i < run.personaCount; i++) {
    const persona = personas[i] || { _id: null, name: `Tester ${i + 1}`, traits: { patience: 50 } };

    // Create session
    const session = await Session.create({
      runId,
      personaId: persona._id || null,
      personaSnapshot: {
        name: persona.name,
        age: persona.age,
        traits: persona.traits,
        avatarSet: persona.avatarSet,
      },
      outcome: 'in_progress',
      totalTime: 0,
      frustrationScore: 0,
      clickCount: 0,
      rageClickCount: 0,
    });

    io?.to(`run:${runId}`).emit('session:started', {
      sessionId: session._id,
      personaName: persona.name,
      personaAvatar: persona.avatarSet?.default,
    });

    // Simulate 3-8 steps per persona
    const stepCount = rand(3, 8);
    let totalFrustration = 0;
    const startTs = Date.now();

    for (let s = 0; s < stepCount; s++) {
      const action = pick(ACTIONS);
      const emotion = pick(EMOTIONS);
      const frustration = rand(10, 90);
      totalFrustration += frustration;

      const step = await Step.create({
        sessionId: session._id,
        runId,
        stepIndex: s,
        action,
        target: pick(['button', 'input', 'link', 'image', 'form', 'nav']),
        x: rand(100, 1200),
        y: rand(100, 800),
        viewport: { width: 1440, height: 900 },
        thought: pick(stepThoughts),
        emotion,
        frustration,
        ts: new Date(startTs + s * rand(2000, 8000)),
      });

      io?.to(`run:${runId}`).emit('step', {
        sessionId: session._id,
        personaName: persona.name,
        stepIndex: s,
        action,
        x: step.x,
        y: step.y,
        thought: step.thought,
        emotion,
        frustration,
      });

      io?.to(`run:${runId}`).emit('emotion', {
        sessionId: session._id,
        personaName: persona.name,
        emotion,
        frustration,
      });

      // Small async pause to simulate timing
      await new Promise((r) => setTimeout(r, 50));
    }

    const patience = persona.traits?.patience ?? 50;
    const avgFrustration = totalFrustration / stepCount;
    const outcome = avgFrustration > (100 - patience) ? 'gave_up' : 'completed';
    outcomes[outcome]++;

    await Session.findByIdAndUpdate(session._id, {
      outcome,
      totalTime: Math.round((Date.now() - startTs) / 1000),
      frustrationScore: Math.round(avgFrustration),
      finalFeedback: outcome === 'completed'
        ? 'Managed to complete the task, though some steps were confusing.'
        : 'Could not complete — gave up due to frustration.',
    });

    io?.to(`run:${runId}`).emit('session:finished', {
      sessionId: session._id,
      personaName: persona.name,
      outcome,
      frustrationScore: Math.round(avgFrustration),
    });
  }

  // Finalize run
  const summary = {
    taskSuccessRate: Math.round((outcomes.completed / run.personaCount) * 100),
    avgFrustration: rand(30, 70),
    ctaMissRate: rand(10, 40),
    avgSessionTime: rand(45, 180),
    completed: outcomes.completed,
    gaveUp: outcomes.gave_up,
  };

  await Run.findByIdAndUpdate(runId, {
    status: 'completed',
    summary,
    completedAt: new Date(),
  });

  io?.to(`run:${runId}`).emit('run:finished', { runId, summary });
  return summary;
}
