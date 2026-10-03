import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Navbar } from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { initiateCheckout } from '../services/razorpay';
import {
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  Lock,
  ChevronDown,
  HelpCircle,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

export default function PricingPage() {
  const [interval, setInterval] = useState('monthly'); // 'monthly' | 'yearly'
  const [openFaq, setOpenFaq] = useState(null);
  const [plans, setPlans] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPlans(data.data);
      })
      .catch(() => null);
  }, []);

  const handleSelectPlan = (planId) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (planId === 'free') {
      if (user) navigate('/app/dashboard');
      else navigate('/signup');
      return;
    }

    if (!user) {
      navigate('/signup?redirect=/pricing');
      return;
    }

    setCheckoutLoading(true);
    initiateCheckout({
      plan: planId,
      interval,
      onSuccess: async (data) => {
        setCheckoutLoading(false);
        setSuccessMsg(`Congratulations! You have upgraded to the ${planId.toUpperCase()} plan.`);
        await checkAuth();
        setTimeout(() => {
          navigate('/app/account?tab=usage');
        }, 2000);
      },
      onError: (err) => {
        setCheckoutLoading(false);
        setErrorMsg(err || 'Payment initialization failed.');
      },
      onCancel: () => {
        setCheckoutLoading(false);
      },
    });
  };

  const faqs = [
    {
      q: 'How does persona testing work on Personify?',
      a: 'Personify runs headless Playwright browsers powered by realistic AI models. Each persona behaves like a real user with defined patience levels, technical confidence, and goal orientation.',
    },
    {
      q: 'Can I cancel or change my plan anytime?',
      a: 'Yes, you can upgrade, downgrade, or cancel your subscription at any time from your Account Billing page. If you cancel, you keep full access until the end of your billing cycle.',
    },
    {
      q: 'What payment methods are supported via Razorpay?',
      a: 'We support all major credit/debit cards, UPI (GPay, PhonePe, Paytm), Net Banking, and Wallet payments via Razorpay secure checkout.',
    },
    {
      q: 'What counts as a single simulation run?',
      a: 'A single run consists of initiating a test against your target URL with your selected persona count (e.g. 5 or 50 personas) completing their tasks.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16 w-full">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <Badge variant="pill" className="bg-[#6C63FF]/15 text-[#6C63FF] text-xs font-semibold px-4 py-1.5 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Simple & Transparent Pricing
          </Badge>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-[var(--text-color)] tracking-tight">
            Predict UX Friction Before Real Users Experience It.
          </h1>

          <p className="text-base text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
            Choose the plan that fits your testing volume. Upgrade or cancel anytime.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-sm font-semibold ${interval === 'monthly' ? 'text-[var(--text-color)]' : 'text-[#6B6B70] dark:text-[#98989F]'}`}>
              Monthly
            </span>
            
            <button
              onClick={() => setInterval(interval === 'monthly' ? 'yearly' : 'monthly')}
              className="w-14 h-8 rounded-full bg-[#ECEAE5] dark:bg-[#26262F] p-1 relative transition-colors focus:outline-none"
            >
              <div className={`w-6 h-6 rounded-full bg-[#6C63FF] transition-transform duration-300 ${interval === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>

            <span className={`text-sm font-semibold flex items-center gap-1.5 ${interval === 'yearly' ? 'text-[var(--text-color)]' : 'text-[#6B6B70] dark:text-[#98989F]'}`}>
              Yearly
              <Badge variant="pill" className="bg-[#8FB8A8]/20 text-[#8FB8A8] text-[10px] font-bold px-2 py-0.5">
                Save 17%
              </Badge>
            </span>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-[#8FB8A8]/15 border border-[#8FB8A8]/30 text-[#8FB8A8] text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-[#F08A7E]/15 border border-[#F08A7E]/30 text-[#F08A7E] text-sm flex items-center gap-3">
            <X className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* FREE PLAN */}
          <Card hoverEffect className="p-8 flex flex-col justify-between relative border-[#ECEAE5] dark:border-[#26262F]">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold font-heading text-[var(--text-color)] mb-1">Free</h3>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">Ideal for quick testing and side projects.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold font-heading text-[var(--text-color)]">₹0</span>
                <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">/ month</span>
              </div>

              <ul className="space-y-3 pt-4 border-t border-[#ECEAE5] dark:border-[#26262F] text-xs">
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span><strong>3 runs</strong> per month</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>Up to <strong>5 personas</strong> per run</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>Desktop Chrome device</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>7-day history retention</span>
                </li>
                <li className="flex items-center gap-2.5 text-[#6B6B70] dark:text-[#98989F] opacity-50">
                  <X className="w-4 h-4 shrink-0" />
                  <span>Mobile & Slow network</span>
                </li>
                <li className="flex items-center gap-2.5 text-[#6B6B70] dark:text-[#98989F] opacity-50">
                  <X className="w-4 h-4 shrink-0" />
                  <span>Heatmaps & 3D view</span>
                </li>
              </ul>
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => handleSelectPlan('free')}
              className="w-full mt-8"
            >
              {user ? 'Current Plan' : 'Get Started Free'}
            </Button>
          </Card>

          {/* PRO PLAN (HIGHLIGHTED) */}
          <GlassPanel className="p-8 flex flex-col justify-between relative border-2 border-[#6C63FF] shadow-2xl scale-[1.02]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge variant="pill" className="bg-[#6C63FF] text-white text-[11px] font-bold px-4 py-1 uppercase tracking-wider shadow-md">
                Most Popular
              </Badge>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold font-heading text-[var(--text-color)] mb-1 flex items-center gap-2">
                  Pro
                  <Sparkles className="w-4 h-4 text-[#6C63FF]" />
                </h3>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">For developers, UX researchers, and growing products.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold font-heading text-[var(--text-color)]">
                  ₹{interval === 'yearly' ? '9,990' : '999'}
                </span>
                <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                  / {interval === 'yearly' ? 'year' : 'month'}
                </span>
              </div>

              <ul className="space-y-3 pt-4 border-t border-[#ECEAE5] dark:border-[#26262F] text-xs">
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#6C63FF] shrink-0" />
                  <span><strong>30 runs</strong> per month</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#6C63FF] shrink-0" />
                  <span>Up to <strong>50 personas</strong> per run</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#6C63FF] shrink-0" />
                  <span>Desktop, Mobile & Slow network</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#6C63FF] shrink-0" />
                  <span>Interactive heatmaps & 3D view</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#6C63FF] shrink-0" />
                  <span>Run comparison tool & PDF export</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#6C63FF] shrink-0" />
                  <span>Unlimited history retention</span>
                </li>
              </ul>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => handleSelectPlan('pro')}
              disabled={checkoutLoading}
              className="w-full mt-8 shadow-lg shadow-[#6C63FF]/30"
            >
              {checkoutLoading ? 'Processing...' : user?.plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
            </Button>
          </GlassPanel>

          {/* TEAM PLAN */}
          <Card hoverEffect className="p-8 flex flex-col justify-between relative border-[#ECEAE5] dark:border-[#26262F]">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold font-heading text-[var(--text-color)] mb-1">Team</h3>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">For design agencies and high-frequency teams.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold font-heading text-[var(--text-color)]">
                  ₹{interval === 'yearly' ? '29,990' : '2,999'}
                </span>
                <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                  / {interval === 'yearly' ? 'year' : 'month'}
                </span>
              </div>

              <ul className="space-y-3 pt-4 border-t border-[#ECEAE5] dark:border-[#26262F] text-xs">
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span><strong>500 runs</strong> / month (Fair use)</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>Up to <strong>50 personas</strong> per run</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>5 Team member seats</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>Custom persona creation</span>
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-color)]">
                  <Check className="w-4 h-4 text-[#8FB8A8] shrink-0" />
                  <span>Priority simulation queue</span>
                </li>
              </ul>
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => handleSelectPlan('team')}
              disabled={checkoutLoading}
              className="w-full mt-8"
            >
              {user?.plan === 'team' ? 'Current Plan' : 'Upgrade to Team'}
            </Button>
          </Card>

        </div>

        {/* Trust Badges Row */}
        <div className="py-8 border-y border-[#ECEAE5] dark:border-[#26262F] grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <ShieldCheck className="w-6 h-6 text-[#8FB8A8] mx-auto mb-2" />
            <p className="text-xs font-bold text-[var(--text-color)]">Razorpay Encrypted</p>
            <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">256-bit SSL checkout</p>
          </div>
          <div className="space-y-1">
            <Zap className="w-6 h-6 text-[#6C63FF] mx-auto mb-2" />
            <p className="text-xs font-bold text-[var(--text-color)]">Instant Upgrade</p>
            <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">Limits unlocked immediately</p>
          </div>
          <div className="space-y-1">
            <CreditCard className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-[var(--text-color)]">Test Cards Allowed</p>
            <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">Razorpay Test Mode</p>
          </div>
          <div className="space-y-1">
            <CheckCircle2 className="w-6 h-6 text-[#8FB8A8] mx-auto mb-2" />
            <p className="text-xs font-bold text-[var(--text-color)]">Cancel Anytime</p>
            <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">No hidden lock-ins</p>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold font-heading text-[var(--text-color)]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <GlassPanel key={idx} className="p-5 cursor-pointer" onClick={() => setOpenFaq(isOpen ? null : idx)}>
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-sm font-bold text-[var(--text-color)]">{faq.q}</h4>
                    <ChevronDown className={`w-4 h-4 text-[#6B6B70] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {isOpen && (
                    <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-3 leading-relaxed pt-3 border-t border-[#ECEAE5] dark:border-[#26262F]">
                      {faq.a}
                    </p>
                  )}
                </GlassPanel>
              );
            })}
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
