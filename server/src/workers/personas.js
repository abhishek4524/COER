import Persona from '../models/Persona.js';

// ─── Trait Matrices ───────────────────────────────────────────────────────────

const ageGroups = [
  { label: 'teen',        range: [13, 19], techBias: 70, patienceBias: 30 },
  { label: 'young-adult', range: [20, 35], techBias: 65, patienceBias: 55 },
  { label: 'adult',       range: [36, 54], techBias: 45, patienceBias: 60 },
  { label: 'senior',      range: [55, 80], techBias: 20, patienceBias: 70 },
];

const devices = [
  'iPhone 15 Pro', 'Samsung Galaxy S23', 'MacBook Air', 'Windows Desktop',
  'iPad Air', 'Old Android (Redmi)', 'Budget Android', 'Tablet (Android)',
];

const languages = ['en', 'hi', 'es', 'fr', 'de', 'zh', 'ar', 'ta'];

const accessibilityOptions = [
  'none', 'none', 'none', 'none',  // weighted towards none
  'screen_reader', 'low_vision', 'motor_impairment', 'color_blind',
];

const firstNames = {
  teen:        ['Riya', 'Arjun', 'Zara', 'Dev', 'Priya', 'Kai', 'Mia', 'Leo'],
  'young-adult': ['Marcus', 'Aisha', 'Liam', 'Sofia', 'Kenji', 'Elena', 'Noah', 'Fatima'],
  adult:       ['Raj', 'Sunita', 'Tom', 'Maria', 'James', 'Anita', 'Carlos', 'Mei'],
  senior:      ['Uncle Sharma', 'Grace', 'George', 'Dorothy', 'Suresh', 'Kamala', 'Walter', 'Rose'],
};

const backstoryTemplates = {
  teen:        (p) => `${p.name} is a ${p.age}-year-old Gen-Z student from ${p.city}. ` +
    `Uses ${p.device} for everything. Has ${p.patience < 40 ? 'very little' : 'moderate'} patience for slow UIs.`,
  'young-adult': (p) => `${p.name} is a ${p.age}-year-old young professional from ${p.city}. ` +
    `Tech-${p.techSavviness > 60 ? 'savvy' : 'moderate'}. Values efficiency and clean design.`,
  adult:       (p) => `${p.name} is a ${p.age}-year-old working professional from ${p.city}. ` +
    `Prefers desktop browsing. Gets ${p.patience < 50 ? 'frustrated easily' : 'patient'} with confusing flows.`,
  senior:      (p) => `${p.name} is a ${p.age}-year-old from ${p.city}. ` +
    `Relies on ${p.device}. Struggles with small text and complex navigation. ` +
    `${p.accessibility !== 'none' ? `Uses ${p.accessibility.replace('_', ' ')}.` : ''}`,
};

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata',
  'London', 'New York', 'Tokyo', 'Lagos', 'São Paulo', 'Paris'];

const tagMap = {
  teen: 'Gen-Z',
  'young-adult': 'Millennial',
  adult: 'Adult',
  senior: 'Senior',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function biased(base, bias, spread = 25) {
  return Math.min(100, Math.max(0, base + rand(-spread, spread)));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSystemPrompt(persona) {
  const langNote = persona.traits.language !== 'en'
    ? `You primarily communicate in ${persona.traits.language} and may switch to it when confused. `
    : '';
  const a11yNote = persona.traits.accessibility !== 'none'
    ? `You use ${persona.traits.accessibility.replace('_', ' ')} assistive technology. ` : '';

  return `You are ${persona.name}, a ${persona.age}-year-old ${tagMap[persona.traits.ageGroup] || 'user'} ` +
    `testing a website. ${persona.backstory} ` +
    `Your patience level is ${persona.traits.patience}/100 — ` +
    `${persona.traits.patience < 35 ? 'you give up quickly if things are confusing.' : 'you are somewhat persistent.'} ` +
    `Your tech savviness is ${persona.traits.techSavviness}/100. ` +
    langNote + a11yNote +
    `Narrate your actions and thoughts naturally. Express emotion when frustrated. ` +
    `React authentically to UI problems, confusing copy, or broken flows.`;
}

// ─── Core 12 Personas ─────────────────────────────────────────────────────────

const corePersonas = [
  {
    name: 'Riya', age: 17, city: 'Mumbai',
    traits: { patience: 25, techSavviness: 85, device: 'iPhone 15 Pro', language: 'hi', accessibility: 'none', ageGroup: 'teen' },
    tag: 'Gen-Z',
    avatarSet: { default: '/assets/personas/riya.png', hover: '/assets/personas/riya-hover.png', confused: '/assets/personas/riya-hover.png', happy: '/assets/personas/riya.png', frustrated: '/assets/personas/riya-hover.png' },
  },
  {
    name: 'Uncle Sharma', age: 58, city: 'Delhi',
    traits: { patience: 70, techSavviness: 15, device: 'Old Android (Redmi)', language: 'hi', accessibility: 'low_vision', ageGroup: 'senior' },
    tag: 'Senior',
    avatarSet: { default: '/assets/personas/sharma.png', hover: '/assets/personas/sharma-hover.png', confused: '/assets/personas/sharma-hover.png', happy: '/assets/personas/sharma.png', frustrated: '/assets/personas/sharma-hover.png' },
  },
  {
    name: 'Priya', age: 29, city: 'Bangalore',
    traits: { patience: 60, techSavviness: 70, device: 'MacBook Air', language: 'en', accessibility: 'none', ageGroup: 'young-adult' },
    tag: 'Millennial',
    avatarSet: { default: '/assets/personas/priya.png', hover: '/assets/personas/priya-hover.png', confused: '/assets/personas/priya-hover.png', happy: '/assets/personas/priya.png', frustrated: '/assets/personas/priya-hover.png' },
  },
  {
    name: 'Marcus', age: 34, city: 'New York',
    traits: { patience: 40, techSavviness: 80, device: 'Windows Desktop', language: 'en', accessibility: 'none', ageGroup: 'young-adult' },
    tag: 'Power User',
    avatarSet: { default: '/assets/personas/marcus.png', hover: '/assets/personas/marcus-hover.png', confused: '/assets/personas/marcus-hover.png', happy: '/assets/personas/marcus.png', frustrated: '/assets/personas/marcus-hover.png' },
  },
  {
    name: 'Devin', age: 22, city: 'Lagos',
    traits: { patience: 35, techSavviness: 55, device: 'Budget Android', language: 'en', accessibility: 'none', ageGroup: 'young-adult' },
    tag: 'Mobile',
    avatarSet: { default: '/assets/personas/devin.png', hover: '/assets/personas/devin-hover.png', confused: '/assets/personas/devin-hover.png', happy: '/assets/personas/devin.png', frustrated: '/assets/personas/devin-hover.png' },
  },
  {
    name: 'Aisha', age: 45, city: 'London',
    traits: { patience: 65, techSavviness: 50, device: 'iPad Air', language: 'ar', accessibility: 'motor_impairment', ageGroup: 'adult' },
    tag: 'Accessibility',
    avatarSet: { default: '/assets/personas/aisha.png', hover: '/assets/personas/aisha-hover.png', confused: '/assets/personas/aisha-hover.png', happy: '/assets/personas/aisha.png', frustrated: '/assets/personas/aisha-hover.png' },
  },
  {
    name: 'Liam', age: 19, city: 'Paris',
    traits: { patience: 20, techSavviness: 90, device: 'iPhone 15 Pro', language: 'fr', accessibility: 'none', ageGroup: 'teen' },
    tag: 'Gen-Z',
    avatarSet: { default: '/assets/personas/liam.png', hover: '/assets/personas/liam-hover.png', confused: '/assets/personas/liam-hover.png', happy: '/assets/personas/liam.png', frustrated: '/assets/personas/liam-hover.png' },
  },
  {
    name: 'Grace', age: 72, city: 'Chennai',
    traits: { patience: 80, techSavviness: 12, device: 'iPad Air', language: 'ta', accessibility: 'screen_reader', ageGroup: 'senior' },
    tag: 'Senior',
    avatarSet: { default: '/assets/personas/grace.png', hover: '/assets/personas/grace-hover.png', confused: '/assets/personas/grace-hover.png', happy: '/assets/personas/grace.png', frustrated: '/assets/personas/grace-hover.png' },
  },
  {
    name: 'Kenji', age: 31, city: 'Tokyo',
    traits: { patience: 55, techSavviness: 88, device: 'MacBook Air', language: 'ja', accessibility: 'none', ageGroup: 'young-adult' },
    tag: 'Power User',
    avatarSet: { default: '/assets/personas/kenji.png', hover: '/assets/personas/kenji-hover.png', confused: '/assets/personas/kenji-hover.png', happy: '/assets/personas/kenji.png', frustrated: '/assets/personas/kenji-hover.png' },
  },
  {
    name: 'Elena', age: 26, city: 'São Paulo',
    traits: { patience: 50, techSavviness: 60, device: 'Samsung Galaxy S23', language: 'es', accessibility: 'color_blind', ageGroup: 'young-adult' },
    tag: 'Mobile',
    avatarSet: { default: '/assets/personas/elena.png', hover: '/assets/personas/elena-hover.png', confused: '/assets/personas/elena-hover.png', happy: '/assets/personas/elena.png', frustrated: '/assets/personas/elena-hover.png' },
  },
  {
    name: 'Fatima', age: 38, city: 'Cairo',
    traits: { patience: 60, techSavviness: 45, device: 'Samsung Galaxy S23', language: 'ar', accessibility: 'none', ageGroup: 'adult' },
    tag: 'Casual',
    avatarSet: { default: '/assets/personas/fatima.png', hover: '/assets/personas/fatima-hover.png', confused: '/assets/personas/fatima-hover.png', happy: '/assets/personas/fatima.png', frustrated: '/assets/personas/fatima-hover.png' },
  },
  {
    name: 'Noah', age: 16, city: 'Hyderabad',
    traits: { patience: 18, techSavviness: 95, device: 'iPhone 15 Pro', language: 'en', accessibility: 'none', ageGroup: 'teen' },
    tag: 'Gen-Z',
    avatarSet: { default: '/assets/personas/noah.png', hover: '/assets/personas/noah-hover.png', confused: '/assets/personas/noah-hover.png', happy: '/assets/personas/noah.png', frustrated: '/assets/personas/noah-hover.png' },
  },
];

// ─── Generator for 38 additional personas ────────────────────────────────────

function generatePersonas(startIndex = 13, count = 38) {
  const generated = [];
  for (let i = 0; i < count; i++) {
    const ageGroup = ageGroups[i % ageGroups.length];
    const age = rand(ageGroup.range[0], ageGroup.range[1]);
    const techSavviness = biased(ageGroup.techBias, 0, 20);
    const patience = biased(ageGroup.patienceBias, 0, 20);
    const device = pick(devices);
    const language = pick(languages);
    const accessibility = pick(accessibilityOptions);
    const city = pick(cities);
    const nameList = firstNames[ageGroup.label];
    const name = `${nameList[i % nameList.length]} ${startIndex + i}`;
    const idx = startIndex + i;

    const persona = {
      name,
      age,
      city,
      traits: { patience, techSavviness, device, language, accessibility, ageGroup: ageGroup.label },
      tag: tagMap[ageGroup.label],
      avatarSet: {
        default: `/assets/personas/p${(idx % 12) + 1}.png`,
        hover: `/assets/personas/p${(idx % 12) + 1}-hover.png`,
        confused: `/assets/personas/p${(idx % 12) + 1}-hover.png`,
        happy: `/assets/personas/p${(idx % 12) + 1}.png`,
        frustrated: `/assets/personas/p${(idx % 12) + 1}-hover.png`,
      },
    };
    generated.push(persona);
  }
  return generated;
}

// ─── Seed Function ────────────────────────────────────────────────────────────

export async function seedPersonas() {
  const allPersonaData = [
    ...corePersonas,
    ...generatePersonas(13, 38),
  ];

  let created = 0;
  let skipped = 0;

  for (const pd of allPersonaData) {
    try {
      const backstory = backstoryTemplates[pd.traits.ageGroup]?.({
        name: pd.name, age: pd.age, city: pd.city,
        patience: pd.traits.patience, techSavviness: pd.traits.techSavviness,
        device: pd.traits.device, accessibility: pd.traits.accessibility,
      }) || `${pd.name} is a ${pd.age}-year-old tester.`;

      const systemPrompt = generateSystemPrompt({ ...pd, backstory });

      await Persona.findOneAndUpdate(
        { name: pd.name },
        {
          name: pd.name,
          age: pd.age,
          traits: {
            patience: pd.traits.patience,
            techSavviness: pd.traits.techSavviness,
            device: pd.traits.device,
            language: pd.traits.language,
            accessibility: pd.traits.accessibility,
          },
          backstory,
          avatarSet: pd.avatarSet,
          systemPrompt,
          isCustom: false,
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      created++;
    } catch (err) {
      console.warn(`[seed] Skipped persona "${pd.name}":`, err.message);
      skipped++;
    }
  }

  return { created, skipped, total: allPersonaData.length };
}

export { generateSystemPrompt, corePersonas, generatePersonas };

// ─── CLI Entry ────────────────────────────────────────────────────────────────

// Run directly: node src/workers/personas.js
if (process.argv[1] && process.argv[1].endsWith('personas.js')) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  const { connectDB } = await import('../config/db.js');

  console.log('[seed] Connecting to MongoDB...');
  await connectDB();

  console.log('[seed] Seeding 50 personas...');
  const result = await seedPersonas();
  console.log(`[seed] Done. Created/updated: ${result.created}, Skipped: ${result.skipped}`);
  process.exit(0);
}
