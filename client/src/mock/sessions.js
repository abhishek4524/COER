import { all50Personas } from './personas.js';

// ─── Helpers ───────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

// ─── Expressions per status ────────────────────────────────────────────────
const expressionMap = {
  converted: ['neutral', 'focused', 'happy', 'satisfied'],
  confused:  ['neutral', 'confused', 'frustrated', 'confused'],
  abandoned: ['neutral', 'frustrated', 'angry', 'gave-up'],
  blocked:   ['neutral', 'confused', 'frustrated', 'blocked'],
  distracted:['neutral', 'distracted', 'confused', 'gave-up'],
  stuck:     ['neutral', 'confused', 'stuck', 'stuck'],
};

const actionPhrases = [
  'Scrolling page', 'Reading headline', 'Hovering CTA button', 'Clicking nav link',
  'Filling form field', 'Looking for price', 'Searching for FAQ', 'Rage clicking button',
  'Trying to zoom in', 'Waiting for page load', 'Reading error message', 'Closing popup',
  'Looking for back button', 'Checking footer', 'Scanning with screen reader',
];

const thoughtPhrases = [
  'Where is the checkout button?', 'This page is taking forever…', 'Why does clicking this do nothing?',
  'I already entered my address once!', 'Is this safe to enter my card?', 'Found it! That was hidden.',
  "Why is the font so small?", 'Okay, what does this icon mean?', 'Almost there, one more step…',
  "This layout is confusing on mobile.", 'I expected the cart here.', "Let me try clicking this instead.",
  'Loading… loading… loading…', "Error? What error? What do I do?", 'Nice, that was smooth.',
  'Where are the reviews?', 'I need to call my nephew to help me.', 'Too many steps in checkout.',
];

// ─── Page steps each persona walks through ────────────────────────────────
const stepTemplates = [
  { label: 'Landing Page', url: 'https://shop.demo/home', duration: 12, screenshot: '/assets/hero-scene.png' },
  { label: 'Product Page', url: 'https://shop.demo/products/item-42', duration: 18, screenshot: '/assets/step-product.png' },
  { label: 'Cart Review', url: 'https://shop.demo/cart', duration: 22, screenshot: '/assets/step-cart.png' },
  { label: 'Checkout Step 1', url: 'https://shop.demo/checkout/info', duration: 35, screenshot: '/assets/step-shipping.png' },
  { label: 'Checkout Step 2', url: 'https://shop.demo/checkout/payment', duration: 40, screenshot: '/assets/step-otp.png' },
  { label: 'Order Confirm', url: 'https://shop.demo/checkout/confirm', duration: 8, screenshot: '/assets/step-success.png' },
];

// ─── Generate steps for one session ───────────────────────────────────────
const generateSteps = (persona) => {
  const maxSteps = persona.status === 'converted' ? 6
    : persona.status === 'abandoned' ? rand(1, 3)
    : rand(2, 5);
  const expSeq = expressionMap[persona.status] || expressionMap.confused;

  return stepTemplates.slice(0, maxSteps).map((tpl, i) => ({
    id: `step-${i + 1}`,
    label: tpl.label,
    url: tpl.url,
    duration: tpl.duration + rand(-5, 10),
    expression: expSeq[Math.min(i, expSeq.length - 1)],
    frustration: Math.min(100, 10 + i * (persona.status === 'converted' ? 3 : 18) + rand(0, 10)),
    action: pick(actionPhrases),
    thought: pick(thoughtPhrases),
    screenshot: tpl.screenshot || '/assets/hero-scene.png',
    clicks: rand(1, 8),
    rageClicks: persona.status === 'abandoned' && i >= 2 ? rand(2, 6) : 0,
    scrollDepth: rand(20, 100),
  }));
};

// ─── Generate heatmap points ───────────────────────────────────────────────
export const generateHeatmapPoints = (count = 120) => {
  const hotspots = [
    { cx: 420, cy: 180, intensity: 0.95 }, // top CTA
    { cx: 380, cy: 320, intensity: 0.70 }, // mid section
    { cx: 600, cy: 240, intensity: 0.50 }, // right column
    { cx: 200, cy: 420, intensity: 0.40 }, // left column
    { cx: 500, cy: 450, intensity: 0.80 }, // checkout button
    { cx: 100, cy: 120, intensity: 0.30 }, // top-left logo
  ];
  const points = [];
  for (let i = 0; i < count; i++) {
    const hot = pick(hotspots);
    points.push({
      x: hot.cx + rand(-60, 60),
      y: hot.cy + rand(-40, 40),
      intensity: Math.min(1, hot.intensity + (Math.random() - 0.5) * 0.3),
      type: pick(['click', 'click', 'click', 'rage', 'dead', 'scroll']),
      personaId: `p${rand(1, 50)}`,
    });
  }
  return points;
};

// ─── Generate sparkline data (7-day) ──────────────────────────────────────
export const generateSparkline = (base, variance = 8) =>
  Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    value: Math.max(0, base + rand(-variance, variance)),
  }));

// ─── AI Insights ──────────────────────────────────────────────────────────
export const insightsData = [
  {
    id: 'ins1',
    severity: 'critical',
    issue: 'Primary CTA not visible on mobile',
    detail: '38 of 50 personas failed to locate the "Buy Now" button on screen sizes below 768px. The button sits below the fold on all Android devices tested.',
    affectedCount: 38,
    affectedPersonaIds: all50Personas.filter(p => p.missedCTA).map(p => p.id),
    suggestedFix: 'Add a sticky "Buy Now" button in the bottom navigation bar for mobile. Keep it above the fold at all breakpoints.',
    icon: 'AlertTriangle',
  },
  {
    id: 'ins2',
    severity: 'high',
    issue: 'SMS OTP causes abandonment spike',
    detail: '14 personas abandoned at the SMS OTP screen. Average frustration score jumped from 42 to 87 at this step.',
    affectedCount: 14,
    affectedPersonaIds: all50Personas.slice(0, 14).map(p => p.id),
    suggestedFix: 'Offer email OTP or magic-link as alternatives. Add a "Resend OTP" button visible without scrolling.',
    icon: 'MessageSquare',
  },
  {
    id: 'ins3',
    severity: 'medium',
    issue: 'Promo code field triggers rage-clicks',
    detail: '9 personas clicked the promo field 4+ times expecting dropdown suggestions. Average rage-click rate: 5.3 per session at this element.',
    affectedCount: 9,
    affectedPersonaIds: all50Personas.slice(6, 15).map(p => p.id),
    suggestedFix: 'Add autocomplete for saved promo codes. Show a subtle hint "Enter code and press Enter" placeholder.',
    icon: 'Zap',
  },
];

// ─── Build full 50-persona sessions ───────────────────────────────────────
export const allSessions = all50Personas.map((persona, i) => {
  const steps = generateSteps(persona);
  const totalTime = steps.reduce((s, st) => s + st.duration, 0);
  const maxFrustration = Math.max(...steps.map(s => s.frustration));

  return {
    id: `sess-${persona.id}`,
    personaId: persona.id,
    persona,
    runId: 'run-2024-001',
    url: 'https://shop.demo',
    goal: 'Complete checkout flow',
    status: persona.status,
    steps,
    totalTime,
    maxFrustration,
    expressionHistory: steps.map(s => s.expression),
    frustrationHistory: steps.map(s => s.frustration),
    finalFeedback: persona.status === 'converted'
      ? `Task completed in ${Math.round(totalTime / 60)} min. No major issues.`
      : `Could not complete the goal. Got stuck at "${steps[steps.length - 1]?.label}".`,
    heatmapPoints: generateHeatmapPoints(rand(30, 60)),
    clickCount: steps.reduce((s, st) => s + st.clicks, 0),
    rageClickCount: steps.reduce((s, st) => s + st.rageClicks, 0),
    scrollDepth: pick([45, 60, 75, 90, 100]),
  };
});

// ─── Aggregated run metrics ────────────────────────────────────────────────
export const runMetrics = {
  totalPersonas: 50,
  completed: allSessions.filter(s => s.status === 'converted').length,
  abandoned: allSessions.filter(s => s.status === 'abandoned').length,
  confused: allSessions.filter(s => ['confused','stuck','distracted','blocked'].includes(s.status)).length,
  avgSessionTime: Math.round(allSessions.reduce((s, sess) => s + sess.totalTime, 0) / 50),
  avgFrustration: Math.round(allSessions.reduce((s, sess) => s + sess.maxFrustration, 0) / 50),
  ctaMissRate: 76,
  taskSuccessRate: 24,
  sparklines: {
    taskSuccess: generateSparkline(24, 6),
    frustration: generateSparkline(68, 10),
    sessionTime: generateSparkline(142, 20),
    dropOff: generateSparkline(76, 8),
  },
};

// ─── Drop-off funnel ───────────────────────────────────────────────────────
export const funnelData = [
  { stage: 'Landing Page',      count: 50, pct: 100 },
  { stage: 'Product Page',      count: 44, pct: 88  },
  { stage: 'Cart Review',       count: 36, pct: 72  },
  { stage: 'Checkout Step 1',   count: 24, pct: 48  },
  { stage: 'Checkout Step 2',   count: 16, pct: 32  },
  { stage: 'Order Confirmed',   count: 12, pct: 24  },
];

// ─── Runs list (for Compare page) ─────────────────────────────────────────
export const allRuns = [
  {
    id: 'run-2024-001',
    label: 'v1.2 – Checkout Redesign',
    date: '2024-09-28',
    url: 'https://shop.demo/v1.2',
    personaCount: 50,
    taskSuccess: 24,
    avgFrustration: 68,
    ctaMissRate: 76,
    screenshot: '/assets/checkout-v1-broken.png',
    heatmapPoints: generateHeatmapPoints(120),
    color: '#6C63FF',
  },
  {
    id: 'run-2024-002',
    label: 'v1.3 – Sticky CTA + OTP Fix',
    date: '2024-10-01',
    url: 'https://shop.demo/v1.3',
    personaCount: 50,
    taskSuccess: 54,
    avgFrustration: 38,
    ctaMissRate: 32,
    screenshot: '/assets/checkout-v2-optimized.png',
    heatmapPoints: generateHeatmapPoints(90),
    color: '#8FB8A8',
  },
];

// ─── Persona group tags for New Run ───────────────────────────────────────
export const personaGroups = [
  { id: 'gen-z',    label: 'Gen-Z',        count: 12, avatar: '/assets/personas/riya.png' },
  { id: 'seniors',  label: 'Seniors 55+',  count: 8,  avatar: '/assets/personas/sharma.png' },
  { id: 'mobile',   label: 'Mobile-only',  count: 15, avatar: '/assets/personas/priya.png' },
  { id: 'a11y',     label: 'Accessibility',count: 5,  avatar: '/assets/personas/marcus.png' },
  { id: 'power',    label: 'Power Users',  count: 6,  avatar: '/assets/personas/devin.png' },
  { id: 'casual',   label: 'Casual',       count: 4,  avatar: '/assets/personas/aisha.png' },
];
