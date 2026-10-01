/**
 * scripts/testAgent.js
 *
 * Runs 3 persona sessions against the demo-site using the real Playwright agent.
 * Picks 3 personas: one Gen-Z (low patience, high tech), one Senior (high patience, low tech),
 * one Millennial (medium patience, medium tech).
 *
 * Usage: node scripts/testAgent.js
 * Requires: GEMINI_API_KEY set in .env, MongoDB running, demo-site running on port 3456.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Persona from '../src/models/Persona.js';
import Run from '../src/models/Run.js';
import Session from '../src/models/Session.js';
import Step from '../src/models/Step.js';
import { runPersonaSession } from '../src/workers/agent.js';
import { buildRunMetrics, buildPerPersonaTypeScores, detectFriction } from '../src/services/aggregator.js';
import { callLLM, buildSummaryPrompt, SUMMARY_SCHEMA } from '../src/services/llm.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const DEMO_URL = process.env.DEMO_URL || 'http://localhost:3456';
const GOAL = 'Sign up for an account and complete the checkout process to buy the SoundMax Pro headphones.';

function log(emoji, msg) { console.log(`${emoji}  ${msg}`); }

async function main() {
  console.log(`\n${BOLD}${YELLOW}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Personify Agent Test — 3 Personas × Demo Site${RESET}`);
  console.log(`${BOLD}${YELLOW}═══════════════════════════════════════════════════${RESET}\n`);

  const provider = process.env.LLM_PROVIDER || 'gemini';
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY && provider !== 'mock') {
    console.error(`${RED}✗ No LLM API key set. Add GEMINI_API_KEY or OPENROUTER_API_KEY to .env, or set LLM_PROVIDER=mock for testing.${RESET}`);
    process.exit(1);
  }

  if (provider === 'mock') {
    log('🤖', `Running in MOCK mode (no real LLM calls)`);
  }

  log('🔌', 'Connecting to MongoDB...');
  await connectDB();

  // Create a test run
  const run = await Run.create({
    url: DEMO_URL,
    goal: GOAL,
    personaCount: 3,
    device: 'desktop',
    ownershipVerified: true,
    verificationMethod: 'localhost_bypass',
    status: 'running',
    verificationToken: 'test_token_' + Date.now(),
  });

  log('🚀', `Created Run: ${run._id}`);
  log('🎯', `Target URL: ${DEMO_URL}`);
  log('📋', `Goal: ${GOAL}\n`);

  // Pick 3 representative personas: Riya (teen), Uncle Sharma (senior), Priya (millennial)
  const genZ = await Persona.findOne({ name: 'Riya' }) || await Persona.findOne({ 'traits.ageGroup': 'teen' });
  const senior = await Persona.findOne({ name: 'Uncle Sharma' }) || await Persona.findOne({ 'traits.ageGroup': 'senior' });
  const millennial = await Persona.findOne({ name: 'Priya' }) || await Persona.findOne({ 'traits.ageGroup': 'young-adult' });

  const testPersonas = [genZ, senior, millennial].filter(Boolean);

  if (!testPersonas.length) {
    console.error(`${RED}✗ No personas found in DB. Run: npm run seed${RESET}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const results = [];

  for (const persona of testPersonas) {
    console.log(`\n${CYAN}${BOLD}━━━ Testing: ${persona.name} (${persona.age}y, ${persona.traits?.ageGroup}) ━━━${RESET}`);
    log('🧠', `Patience: ${persona.traits?.patience}/100 | Tech: ${persona.traits?.techSavviness}/100 | Device: ${persona.traits?.device}`);

    // Create session
    const session = await Session.create({
      runId: run._id,
      personaId: persona._id,
      personaSnapshot: {
        name: persona.name,
        age: persona.age,
        tag: persona.tag || persona.traits?.ageGroup || 'General',
        traits: persona.traits,
        avatarSet: persona.avatarSet,
      },
      outcome: 'in_progress',
    });

    const fakeJob = {
      data: {
        runId: run._id.toString(),
        sessionId: session._id.toString(),
        personaId: persona._id.toString(),
        goal: GOAL,
        url: DEMO_URL,
        device: 'desktop',
      },
    };

    const startTime = Date.now();
    try {
      const result = await runPersonaSession(fakeJob, null /* no socket in test */);
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      results.push({ persona, session: result, elapsed });

      const outcomeIcon = result.outcome === 'completed' ? `${GREEN}✅ COMPLETED${RESET}` : `${RED}❌ GAVE UP${RESET}`;
      console.log(`\n   ${outcomeIcon} in ${elapsed}s`);
      console.log(`   Frustration: ${result.avgFrustration}/100`);
      console.log(`   Feedback: "${result.finalFeedback?.slice(0, 120)}..."`);

    } catch (err) {
      console.error(`\n   ${RED}✗ Session error: ${err.message}${RESET}`);
      results.push({ persona, error: err.message });
    }
  }

  // ── Aggregate Results ─────────────────────────────────────────────────────
  console.log(`\n${BOLD}${YELLOW}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  AGGREGATED RESULTS${RESET}`);
  console.log(`${BOLD}${YELLOW}═══════════════════════════════════════════════════${RESET}\n`);

  const sessions = await Session.find({ runId: run._id }).lean();
  const allSteps = await Step.find({ runId: run._id }).lean();
  const sessionsWithSteps = sessions.map((s) => ({
    ...s,
    steps: allSteps.filter((st) => st.sessionId?.toString() === s._id?.toString()),
  }));

  const metrics = buildRunMetrics(sessionsWithSteps);
  const personaTypeScores = buildPerPersonaTypeScores(sessions);

  log('📊', `Task Success Rate:    ${metrics.taskSuccessRate}%`);
  log('😤', `Avg Frustration:     ${metrics.avgFrustration}/100`);
  log('⏱️ ', `Avg Session Time:    ${metrics.avgSessionTime}s`);
  log('🎯', `CTA Miss Rate:       ${metrics.ctaMissRate}%`);
  log('✅', `Completed:           ${metrics.completedCount}/${metrics.totalSessions}`);
  log('❌', `Gave Up:             ${metrics.gaveUpCount}/${metrics.totalSessions}`);

  if (metrics.frictionReport.rageClicks.length) {
    log('😡', `Rage Click Clusters: ${metrics.frictionReport.rageClicks.length}`);
    metrics.frictionReport.rageClicks.forEach((rc) => {
      console.log(`       → ${rc.personaName} — ${rc.count} clicks at (${rc.x}, ${rc.y})`);
    });
  }

  if (metrics.frictionReport.deadClicks.length) {
    log('💀', `Dead Clicks:         ${metrics.frictionReport.deadClicks.length}`);
  }

  if (metrics.frictionReport.loops.length) {
    log('🔄', `Navigation Loops:    ${metrics.frictionReport.loops.length}`);
  }

  // Per-persona-type breakdown
  if (personaTypeScores.length) {
    console.log(`\n${BOLD}  Per-Persona-Type Scores:${RESET}`);
    personaTypeScores.forEach((score) => {
      const bar = '█'.repeat(Math.round(score.successRate / 10));
      console.log(`   ${score.tag.padEnd(15)} ${bar.padEnd(10)} ${score.successRate}% success | ${score.avgFrustration} avg frustration`);
    });
  }

  // Step breakdown
  console.log(`\n${BOLD}  Step-by-Step Log:${RESET}`);
  for (const sess of sessionsWithSteps) {
    const name = sess.personaSnapshot?.name || 'Unknown';
    console.log(`\n   ${CYAN}${name}${RESET} (${sess.outcome})`);
    (sess.steps || []).forEach((step, i) => {
      const emotionEmoji = {
        neutral: '😐', curious: '🤔', confused: '😕',
        frustrated: '😤', happy: '😊', angry: '😡'
      }[step.emotion] || '❓';
      console.log(`   Step ${i + 1}: [${step.action}] ${emotionEmoji} frustration=${step.frustration} — "${step.thought?.slice(0, 80)}"`);
    });
    if (sess.finalFeedback) {
      console.log(`   💬 Feedback: "${sess.finalFeedback.slice(0, 150)}"`);
    }
  }

  // ── AI Insights Summary Step ──────────────────────────────────────────────
  console.log(`\n${BOLD}${YELLOW}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  AI UX INSIGHTS (Clustered by LLM)${RESET}`);
  console.log(`${BOLD}${YELLOW}═══════════════════════════════════════════════════${RESET}\n`);

  let topIssues = [];
  try {
    const feedbacks = sessions.map((s) => ({
      personaName: s.personaSnapshot?.name || 'Unknown',
      outcome: s.outcome,
      feedback: s.finalFeedback || '',
    })).filter((f) => f.feedback);

    const summarySystemPrompt = 'You are a senior UX researcher analyzing usability test results. Provide structured, actionable insights.';
    const summaryUserPrompt = buildSummaryPrompt(feedbacks, run.goal, run.url);
    topIssues = await callLLM(summarySystemPrompt, summaryUserPrompt, { schema: SUMMARY_SCHEMA });

    topIssues.forEach((issue, idx) => {
      const severityColor = issue.severity === 'critical' ? RED : issue.severity === 'high' ? YELLOW : CYAN;
      console.log(`  ${BOLD}${idx + 1}. ${issue.title}${RESET} [${severityColor}${issue.severity.toUpperCase()}${RESET}]`);
      console.log(`     Affected: ${issue.affectedCount}/${sessions.length} personas`);
      console.log(`     Details:  ${issue.description}`);
      console.log(`     Fix:      ${GREEN}${issue.suggestedFix}${RESET}\n`);
    });
  } catch (err) {
    console.warn(`  [AI Summary] Warning: ${err.message}`);
  }

  // Update Run
  await Run.findByIdAndUpdate(run._id, {
    status: 'completed',
    summary: { ...metrics, personaTypeScores, topIssues },
    scores: {
      taskSuccessRate: metrics.taskSuccessRate,
      avgFrustration: metrics.avgFrustration,
      ctaMissRate: metrics.ctaMissRate,
      avgSessionTime: metrics.avgSessionTime,
    },
    completedAt: new Date(),
  });

  console.log(`\n${GREEN}${BOLD}✅ Test complete. Run ID: ${run._id}${RESET}`);
  console.log(`   View in DB: db.runs.findOne({_id: ObjectId("${run._id}")})\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
