import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Globe, Shield, Clock, DollarSign, Monitor, Smartphone, Wifi, Lock, Sparkles, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';
import Toast from '../components/ui/Toast';
import SmartImage from '../components/ui/SmartImage';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { all50Personas } from '../mock/personas';
import { getPersonaGroups, getPersonas, submitNewRun } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { initiateCheckout } from '../services/razorpay';

const GOALS = [
  'Complete checkout flow',
  'Sign up & onboarding',
  'Find a product',
  'Read FAQ & support',
  'Custom…',
];

const DEVICES = [
  { key: 'desktop', label: 'Desktop', icon: Monitor },
  { key: 'mobile',  label: 'Mobile',  icon: Smartphone },
  { key: 'slow',    label: 'Slow 3G', icon: Wifi },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export const NewRunPage = () => {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();

  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [customGoal, setCustomGoal] = useState('');
  const [count, setCount] = useState(user?.plan === 'free' ? 5 : 20);
  const [device, setDevice] = useState('desktop');
  const [groups, setGroups] = useState([]);
  const [personas, setPersonas] = useState(all50Personas);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Billing & Quota state
  const [usage, setUsage] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  const isFreePlan = user?.plan === 'free';
  const maxPersonasAllowed = isFreePlan ? 5 : 50;

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    getPersonaGroups().then(setGroups);
    getPersonas().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setPersonas(data);
      }
      setPersonasLoading(false);
    }).catch(() => setPersonasLoading(false));

    // Fetch user usage info
    fetch(`${API_URL}/billing/me`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.usage) {
          setUsage(json.data.usage);
        }
      })
      .catch(() => null);
  }, [user]);

  const toggleGroup = (id) =>
    setSelectedGroups(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]);

  const estMins = Math.round((count * 12) / 60);

  const handleDeviceSelect = (deviceKey) => {
    if (isFreePlan && deviceKey !== 'desktop') {
      setUpgradeReason(`Simulating ${deviceKey} devices requires a Pro or Team plan.`);
      setShowUpgradeModal(true);
      return;
    }
    setDevice(deviceKey);
  };

  const handlePersonaCountChange = (val) => {
    if (isFreePlan && val > 5) {
      setCount(5);
      setUpgradeReason('Free plan is limited to 5 personas per run. Upgrade to Pro for up to 50 personas.');
      setShowUpgradeModal(true);
      return;
    }
    setCount(val);
  };

  const handleLaunch = async () => {
    if (!url.trim()) {
      setToast({ msg: 'Please enter a URL.', type: 'error' });
      return;
    }

    setLoading(true);
    const chosenGoal = goal === 'Custom…' ? (customGoal || 'Explore website') : goal;
    const res = await submitNewRun({ url, goal: chosenGoal, personaCount: count, device });
    setLoading(false);

    if (!res.success) {
      if (res.error?.includes('limit') || res.error?.includes('quota') || res.error?.includes('402')) {
        setUpgradeReason(res.error || 'You have reached your monthly run limit.');
        setShowUpgradeModal(true);
      } else {
        setToast({ msg: `❌ ${res.error || 'Failed to start run'}`, type: 'error' });
      }
      return;
    }

    const targetRunId = res.runId || res.data?._id || res.data?.id;
    setToast({ msg: `🚀 ${count} tester${count > 1 ? 's' : ''} deployed to ${url}!`, type: 'success' });
    setTimeout(() => navigate(`/app/live/${targetRunId}`), 800);
  };

  const handleUpgradeCheckout = () => {
    setShowUpgradeModal(false);
    initiateCheckout({
      plan: 'pro',
      interval: 'monthly',
      onSuccess: async () => {
        setToast({ msg: '🎉 Upgraded to Pro plan successfully!', type: 'success' });
        await checkAuth();
      },
      onError: (err) => {
        setToast({ msg: err || 'Payment failed', type: 'error' });
      },
    });
  };

  const visiblePersonas = personas.slice(0, count);
  const crewPreview = personas.slice(0, Math.min(count, 5));

  const runsUsed = usage?.runsUsed ?? 0;
  const runsLimit = usage?.runsLimit ?? 3;
  const runsRemaining = Math.max(0, runsLimit - runsUsed);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-12">

      {/* Quota Info Banner */}
      <motion.div {...fadeUp(0)}>
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#6C63FF]/10 text-[#6C63FF] flex items-center justify-center font-bold">
              ⚡
            </div>
            <div>
              <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F]">
                Plan: <strong className="text-[var(--text-color)] uppercase">{user?.plan || 'Free'}</strong>
              </p>
              <p className="text-sm font-bold text-[var(--text-color)]">
                {runsRemaining} run{runsRemaining === 1 ? '' : 's'} remaining this month ({runsUsed}/{runsLimit} used)
              </p>
            </div>
          </div>

          {isFreePlan && (
            <Button
              variant="primary"
              size="sm"
              pill
              onClick={() => navigate('/pricing')}
              icon={Sparkles}
            >
              Upgrade
            </Button>
          )}
        </div>
      </motion.div>

      {/* URL Input */}
      <motion.div {...fadeUp(0.1)}>
        <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-2 tracking-widest uppercase">Website URL</p>
        <Input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://your-website.com"
          startIcon={Globe}
          pill
          className="text-base shadow-sm"
        />
      </motion.div>

      {/* Goal selector */}
      <motion.div {...fadeUp(0.15)}>
        <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-2 tracking-widest uppercase">Testing Goal</p>
        <select
          value={goal}
          onChange={e => setGoal(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-[#ECEAE5] dark:border-[#26262F]
            bg-white dark:bg-[#17171B] text-[#1C1C1E] dark:text-[#F2F2F7]
            text-sm focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition-all"
        >
          {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <AnimatePresence>
          {goal === 'Custom…' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2"
            >
              <Input
                value={customGoal}
                onChange={e => setCustomGoal(e.target.value)}
                placeholder="Describe your testing goal…"
                className="w-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Persona count slider */}
      <motion.div {...fadeUp(0.2)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase">Persona Count</p>
            {isFreePlan && (
              <Badge variant="pill" className="bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                Free max: 5
              </Badge>
            )}
          </div>
          <span className="text-2xl font-mono-num font-bold text-[#6C63FF]">{count}</span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={count}
          onChange={e => handlePersonaCountChange(+e.target.value)}
          className="w-full accent-[#6C63FF] h-2 rounded-full cursor-pointer"
        />
        <div className="flex flex-wrap gap-1 mt-3 min-h-[44px]">
          <AnimatePresence>
            {visiblePersonas.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, delay: i < 5 ? i * 0.04 : 0 }}
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white dark:ring-[#17171B] shrink-0"
              >
                <SmartImage
                  src={p.avatar}
                  fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${p.id}`}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Device toggle with plan locking */}
      <motion.div {...fadeUp(0.3)}>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase">Device</p>
        </div>
        <div className="flex gap-2">
          {DEVICES.map(({ key, label, icon: Icon }) => {
            const isLocked = isFreePlan && key !== 'desktop';
            return (
              <button
                key={key}
                onClick={() => handleDeviceSelect(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border relative ${
                  device === key
                    ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-md'
                    : 'bg-white dark:bg-[#17171B] text-[#6B6B70] dark:text-[#98989F] border-[#ECEAE5] dark:border-[#26262F] hover:border-[#6C63FF]/50'
                } ${isLocked ? 'opacity-70' : ''}`}
                title={isLocked ? 'Pro plan required for Mobile / Slow network simulation' : ''}
              >
                <Icon size={14} />
                <span>{label}</span>
                {isLocked && <Lock size={12} className="text-amber-400" />}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Persona group chips */}
      <motion.div {...fadeUp(0.35)}>
        <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-2 tracking-widest uppercase">Persona Groups</p>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => {
            const active = selectedGroups.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                  ${active
                    ? 'bg-[#6C63FF]/10 border-[#6C63FF]/40 text-[#6C63FF]'
                    : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/30'}`}
              >
                <div className="w-5 h-5 rounded-full overflow-hidden">
                  <SmartImage src={g.avatar} fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${g.id}`} alt={g.label} className="w-full h-full object-cover" />
                </div>
                {g.label}
                <span className="opacity-60">{g.count}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Tester crew preview */}
      <motion.div {...fadeUp(0.4)}>
        <GlassPanel className="rounded-2xl p-4">
          <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-3 tracking-widest uppercase">Your Tester Crew</p>
          <div className="flex flex-col gap-2">
            {crewPreview.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                  <SmartImage src={p.avatar} fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${p.id}`} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate">{p.name}</p>
                  <p className="text-xs text-[#6B6B70] dark:text-[#98989F] truncate">{device} • {p.device}</p>
                </div>
                <Badge variant={p.status === 'converted' ? 'default' : 'accent'} className="shrink-0 text-[10px]">
                  {p.tag}
                </Badge>
              </div>
            ))}
            {count > 5 && (
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] text-center mt-1">
                + {count - 5} more testers
              </p>
            )}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Time estimate */}
      <motion.div {...fadeUp(0.45)}>
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-4 flex items-center gap-3">
          <Clock size={18} className="text-[#6C63FF] shrink-0" />
          <div>
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">Estimated Simulation Time</p>
            <p className="text-xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">~{estMins} min</p>
          </div>
        </div>
      </motion.div>

      {/* Launch button */}
      <motion.div {...fadeUp(0.5)}>
        <Button
          variant="primary"
          size="lg"
          pill
          onClick={handleLaunch}
          disabled={loading}
          className="w-full text-base font-semibold shadow-lg"
        >
          {loading ? 'Deploying testers…' : `🚀 Launch ${count} Testers`}
        </Button>
      </motion.div>

      {/* Upgrade Modal for Quota Exceeded */}
      <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Upgrade to Pro Plan">
        <div className="space-y-4 text-center py-2">
          <div className="w-12 h-12 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold font-heading text-[var(--text-color)]">
            Plan Limit Reached
          </h3>
          <p className="text-sm text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
            {upgradeReason || 'You need a Pro plan to use this feature.'}
          </p>

          <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 text-left text-xs space-y-2">
            <p className="font-bold text-[var(--text-color)]">Pro Plan Includes:</p>
            <ul className="space-y-1 text-[#6B6B70] dark:text-[#98989F]">
              <li>✓ 30 simulations / month</li>
              <li>✓ Up to 50 personas per run</li>
              <li>✓ Mobile & Slow network simulation</li>
              <li>✓ Interactive heatmaps & 3D view</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowUpgradeModal(false)} className="w-full sm:w-auto">
              Maybe Later
            </Button>
            <Button variant="primary" size="md" pill onClick={handleUpgradeCheckout} className="w-full sm:w-auto">
              Upgrade Now (₹999/mo)
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        message={toast?.msg}
        type={toast?.type ?? 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
};

export default NewRunPage;
