/**
 * plans.js — Single Source of Truth for Pricing Plans & Feature Limits
 * Exposed via GET /api/plans so the UI never hardcodes limits or prices.
 */

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Ideal for quick developer testing and small side projects',
    price: {
      monthly: 0,
      yearly: 0,
    },
    currency: 'INR',
    limits: {
      maxRunsPerMonth: 3,
      maxPersonasPerRun: 5,
      historyDays: 7,
      allowedDevices: ['desktop'],
      maxSeats: 1,
    },
    features: [
      { text: '3 simulations per month', included: true },
      { text: 'Up to 5 personas per run', included: true },
      { text: 'Desktop device testing', included: true },
      { text: 'Basic UX friction report', included: true },
      { text: '7-day test history', included: true },
      { text: 'Mobile & Slow network simulation', included: false },
      { text: 'Interactive heatmaps & 3D view', included: false },
      { text: 'Run comparison tool', included: false },
      { text: 'Custom persona creation', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For professional developers, UX researchers, and growing products',
    popular: true,
    price: {
      monthly: 999,
      yearly: 9990, // ~17% discount for yearly
    },
    currency: 'INR',
    limits: {
      maxRunsPerMonth: 30,
      maxPersonasPerRun: 50,
      historyDays: 365,
      allowedDevices: ['desktop', 'mobile', 'slow'],
      maxSeats: 1,
    },
    features: [
      { text: '30 simulations per month', included: true },
      { text: 'Up to 50 personas per run', included: true },
      { text: 'Desktop, Mobile & Slow network', included: true },
      { text: 'Interactive heatmaps & 3D view', included: true },
      { text: 'Run comparison tool', included: true },
      { text: 'Unlimited test history', included: true },
      { text: 'PDF & JSON export', included: true },
      { text: 'Priority simulation queue', included: false },
      { text: 'Team seats & custom personas', included: false },
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'For design agencies, product teams, and high-frequency testing',
    price: {
      monthly: 2999,
      yearly: 29990,
    },
    currency: 'INR',
    limits: {
      maxRunsPerMonth: 500, // Fair use limit
      maxPersonasPerRun: 50,
      historyDays: 3650,
      allowedDevices: ['desktop', 'mobile', 'slow'],
      maxSeats: 5,
    },
    features: [
      { text: '500 simulations / month (Fair use)', included: true },
      { text: 'Up to 50 personas per run', included: true },
      { text: 'All Desktop, Mobile & Network options', included: true },
      { text: 'Interactive heatmaps & 3D view', included: true },
      { text: 'Run comparison & export tools', included: true },
      { text: 'Custom persona creation', included: true },
      { text: '5 Team member seats', included: true },
      { text: 'Priority execution queue', included: true },
      { text: 'Dedicated support & SLA', included: true },
    ],
  },
};

export function getPlanDetails(planId) {
  return PLANS[planId] || PLANS.free;
}
