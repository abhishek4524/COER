import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlassPanel } from '../ui/GlassPanel';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { initiateCheckout } from '../../services/razorpay';
import {
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

export const PricingSection = () => {
  const [interval, setInterval] = useState('monthly'); // 'monthly' | 'yearly'
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();

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
      onSuccess: async () => {
        setCheckoutLoading(false);
        setSuccessMsg(`Congratulations! Upgraded to ${planId.toUpperCase()} plan.`);
        await checkAuth();
        setTimeout(() => {
          navigate('/app/account?tab=usage');
        }, 1500);
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

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* Header Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <Badge variant="pill" className="bg-[#6C63FF]/15 text-[#6C63FF] text-xs font-semibold px-4 py-1.5 uppercase tracking-wider inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Flexible & Transparent Pricing
        </Badge>

        <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-[var(--text-color)] tracking-tight">
          Start Free, Scale As You Test
        </h2>

        <p className="text-base text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
          Predict UX friction before real users experience it. Choose a plan tailored for your team.
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="pt-2 flex items-center justify-center gap-3">
          <span className={`text-sm font-semibold ${interval === 'monthly' ? 'text-[var(--text-color)]' : 'text-[#6B6B70] dark:text-[#98989F]'}`}>
            Monthly
          </span>

          <button
            onClick={() => setInterval(interval === 'monthly' ? 'yearly' : 'monthly')}
            className="w-14 h-8 rounded-full bg-[#ECEAE5] dark:bg-[#26262F] p-1 relative transition-colors focus:outline-none"
            aria-label="Toggle billing interval"
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

      {/* Messages */}
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
      <div className="pt-8 border-t border-[#ECEAE5] dark:border-[#26262F] grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
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
    </section>
  );
};

export default PricingSection;
