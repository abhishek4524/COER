import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Globe, Shield, Clock, DollarSign, Monitor, Smartphone, Wifi } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';
import Toast from '../components/ui/Toast';
import SmartImage from '../components/ui/SmartImage';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import { all50Personas } from '../mock/personas';
import { getPersonaGroups, getPersonas, submitNewRun } from '../services/api';

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
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [customGoal, setCustomGoal] = useState('');
  const [count, setCount] = useState(20);
  const [device, setDevice] = useState('desktop');
  const [groups, setGroups] = useState([]);
  const [personas, setPersonas] = useState(all50Personas);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPersonaGroups().then(setGroups);
    getPersonas().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setPersonas(data);
      }
      setPersonasLoading(false);
    }).catch(() => setPersonasLoading(false));
  }, []);

  const toggleGroup = (id) =>
    setSelectedGroups(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]);

  const estMins = Math.round((count * 12) / 60);
  const estCost = (count * 0.08).toFixed(2);

  const handleLaunch = async () => {
    if (!url.trim()) { setToast({ msg: 'Please enter a URL.', type: 'error' }); return; }
    setLoading(true);
    const chosenGoal = goal === 'Custom…' ? customGoal : goal;
    const res = await submitNewRun({ url, goal: chosenGoal, personaCount: count, device });
    setLoading(false);
    setToast({ msg: `🚀 ${count} testers deployed to ${url}!`, type: 'success' });
    const targetRunId = res.runId || res.data?._id || `run-${Date.now()}`;
    setTimeout(() => navigate(`/app/live?runId=${targetRunId}`), 1000);
  };

  const visiblePersonas = personas.slice(0, count);
  const crewPreview = personas.slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">

      {/* URL Input */}
      <motion.div {...fadeUp(0)}>
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
      <motion.div {...fadeUp(0.1)}>
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
          <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase">Persona Count</p>
          <span className="text-2xl font-mono-num font-bold text-[#6C63FF]">{count}</span>
        </div>
        <input
          type="range" min={5} max={50} value={count}
          onChange={e => setCount(+e.target.value)}
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

      {/* Device toggle */}
      <motion.div {...fadeUp(0.3)}>
        <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-2 tracking-widest uppercase">Device</p>
        <div className="flex gap-2">
          {DEVICES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border
                ${device === key
                  ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-md'
                  : 'bg-white dark:bg-[#17171B] text-[#6B6B70] dark:text-[#98989F] border-[#ECEAE5] dark:border-[#26262F] hover:border-[#6C63FF]/50'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
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
                  <p className="text-xs text-[#6B6B70] dark:text-[#98989F] truncate">{p.device}</p>
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

      {/* Time / cost estimate */}
      <motion.div {...fadeUp(0.45)} className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-4 flex items-center gap-3">
          <Clock size={18} className="text-[#6C63FF] shrink-0" />
          <div>
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">Estimated Time</p>
            <p className="text-xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">~{estMins} min</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-4 flex items-center gap-3">
          <DollarSign size={18} className="text-[#8FB8A8] shrink-0" />
          <div>
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">Estimated Cost</p>
            <p className="text-xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">${estCost}</p>
          </div>
        </div>
      </motion.div>

      {/* Ownership verification banner */}
      <motion.div {...fadeUp(0.5)}>
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-[#6C63FF]/8 border border-[#6C63FF]/20">
          <Shield size={18} className="text-[#6C63FF] shrink-0 mt-0.5" />
          <p className="text-sm text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
            <span className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">We'll verify you own this URL.</span>{' '}
            Add a quick DNS TXT record or a <code className="font-mono-num text-xs bg-[#ECEAE5] dark:bg-[#26262F] px-1.5 py-0.5 rounded">&lt;meta&gt;</code> tag — takes about 30 seconds.
          </p>
        </div>
      </motion.div>

      {/* Launch button */}
      <motion.div {...fadeUp(0.55)}>
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
