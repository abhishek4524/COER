import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, CheckCircle2, XCircle, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import GlassPanel from '../components/ui/GlassPanel';
import Badge from '../components/ui/Badge';
import SmartImage from '../components/ui/SmartImage';
import Skeleton from '../components/ui/Skeleton';
import { createLiveSource } from '../services/liveSource';
import { allSessions } from '../mock/sessions';

const EXPRESSION_EMOJI = {
  neutral: '😐', focused: '🎯', happy: '😊', satisfied: '😌',
  confused: '😕', frustrated: '😤', angry: '😠', 'gave-up': '😞',
  blocked: '🚫', distracted: '😵', stuck: '🤔',
};

const ExpressionTag = ({ expression, frustration }) => {
  const emoji = EXPRESSION_EMOJI[expression] || '😐';
  const color = frustration > 75 ? 'bg-[#F08A7E]/20 text-[#F08A7E]'
    : frustration > 45 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-[#8FB8A8]/20 text-[#8FB8A8]';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {emoji} {expression}
    </span>
  );
};

const FrustrationBar = ({ value }) => {
  const color = value > 75 ? 'bg-[#F08A7E]' : value > 45 ? 'bg-amber-400' : 'bg-[#8FB8A8]';
  return (
    <div className="w-full h-1 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
};

// Canvas cursor layer
const CursorLayer = ({ cursors }) => {
  return (
    <>
      {cursors.map(c => (
        <motion.div
          key={c.personaId}
          className="absolute pointer-events-none z-20 flex items-start gap-1"
          animate={{ x: c.x, y: c.y }}
          transition={{ duration: 0.5, ease: 'linear' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
              fill={c.color || '#6C63FF'} stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span className="px-2 py-0.5 text-[10px] font-semibold text-white rounded-full shadow-md whitespace-nowrap"
            style={{ backgroundColor: c.color || '#6C63FF' }}>
            {c.name.split(' ')[0]}
          </span>
          {c.isRageClick && (
            <motion.span
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute w-6 h-6 rounded-full border-2 border-[#F08A7E]"
            />
          )}
        </motion.div>
      ))}
    </>
  );
};

export const LiveSimulationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId') || 'run-2024-001';
  const isRealRun = Boolean(searchParams.get('runId'));

  const [personaStates, setPersonaStates] = useState(() => {
    if (isRealRun) return {};
    // initialise 50 persona slots for mock preview
    return allSessions.reduce((acc, s) => {
      acc[s.personaId] = {
        personaId: s.personaId,
        persona: s.persona,
        expression: 'neutral',
        frustration: 10,
        action: 'Starting…',
        currentStep: s.steps[0],
        isComplete: false,
        status: 'active',
      };
      return acc;
    }, {});
  });

  const [cursors, setCursors] = useState({});
  const [thoughts, setThoughts] = useState([]);
  const [counters, setCounters] = useState({
    active: isRealRun ? 0 : 50,
    completed: 0,
    abandoned: 0,
  });
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [scrubberPos, setScrubberPos] = useState(0);
  const [runFinished, setRunFinished] = useState(false);
  const sourceRef = useRef(null);
  const thoughtsRef = useRef([]);

  useEffect(() => {
    const source = createLiveSource(runId);
    sourceRef.current = source;

    source.on('runStarted', (data) => {
      if (data.personaCount) {
        setCounters(prev => ({ ...prev, active: data.personaCount }));
      }
    });

    source.on('personaUpdate', (data) => {
      setPersonaStates(prev => {
        const existing = prev[data.personaId] || {};
        return {
          ...prev,
          [data.personaId]: {
            ...existing,
            personaId: data.personaId,
            persona: data.persona || existing.persona || { name: 'Tester', avatar: '/assets/personas/default.png', color: '#6C63FF' },
            expression: data.expression || existing.expression || 'neutral',
            frustration: data.frustration ?? existing.frustration ?? 10,
            action: data.action || existing.action || 'Interacting…',
            currentStep: data.currentStep || existing.currentStep,
            isComplete: data.isComplete ?? existing.isComplete ?? false,
            status: data.status || existing.status || 'active',
          },
        };
      });

      if (data.isComplete) {
        setCounters(prev => {
          const abandoned = data.status === 'abandoned' || data.persona?.status === 'abandoned' || data.persona?.status === 'confused';
          return {
            active: Math.max(0, prev.active - 1),
            completed: abandoned ? prev.completed : prev.completed + 1,
            abandoned: abandoned ? prev.abandoned + 1 : prev.abandoned,
          };
        });
        setProgress(p => Math.min(100, p + (isRealRun ? 20 : 2)));
      }
    });

    source.on('cursorMove', (data) => {
      setCursors(prev => ({ ...prev, [data.personaId]: data }));
    });

    source.on('thought', (data) => {
      const item = { ...data, id: `${data.personaId}-${Date.now()}` };
      thoughtsRef.current = [item, ...thoughtsRef.current].slice(0, 40);
      setThoughts([...thoughtsRef.current]);
    });

    source.on('runComplete', () => {
      setProgress(100);
      setRunFinished(true);
      setCounters(prev => ({ ...prev, active: 0 }));
    });

    source.start();

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    return () => {
      source.stop();
      clearInterval(timer);
    };
  }, [runId, isRealRun]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const personaList = Object.values(personaStates);
  const activeCursors = Object.values(cursors);

  return (
    <div className="flex flex-col gap-4 h-full min-h-[calc(100vh-80px)]">
      {/* ── Header counters + progress ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: counters.active, color: 'text-[#6C63FF]', icon: Activity },
          { label: 'Completed', value: counters.completed, color: 'text-[#8FB8A8]', icon: CheckCircle2 },
          { label: 'Gave Up', value: counters.abandoned, color: 'text-[#F08A7E]', icon: XCircle },
          { label: 'Elapsed', value: formatTime(elapsed), color: 'text-[#6B6B70]', icon: null },
        ].map(({ label, value, color, icon: Icon }) => (
          <GlassPanel key={label} className="p-4 rounded-2xl flex items-center gap-3">
            {Icon && <Icon size={20} className={color} />}
            <div>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">{label}</p>
              <p className={`text-2xl font-mono-num font-bold ${color}`}>{value}</p>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#6C63FF] to-[#8FB8A8] rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 flex-1">

        {/* Left: Persona tile grid */}
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-3 overflow-y-auto max-h-[600px]">
          <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-2 px-1">PERSONAS</p>
          <div className="grid grid-cols-2 gap-2">
            {personaList.slice(0, 20).map((state) => (
              <motion.div
                key={state.personaId}
                layout
                className={`rounded-xl p-2 border transition-colors text-left
                  ${state.isComplete
                    ? 'border-[#8FB8A8]/40 bg-[#8FB8A8]/5 dark:bg-[#8FB8A8]/10'
                    : 'border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#1E1E24]'}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2"
                    style={{ ringColor: state.persona.color }}>
                    <SmartImage
                      src={state.persona.avatar}
                      fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${state.personaId}`}
                      alt={state.persona.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate leading-tight">
                      {state.persona.name.split(' ')[0]}
                    </p>
                    <ExpressionTag expression={state.expression} frustration={state.frustration} />
                  </div>
                </div>
                <p className="text-[9px] text-[#6B6B70] dark:text-[#98989F] truncate mb-1">{state.action}</p>
                <FrustrationBar value={state.frustration} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Center: Browser view with cursors */}
        <div className="rounded-2xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B] flex flex-col">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#ECEAE5] dark:border-[#26262F] shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F08A7E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#8FB8A8]" />
            <span className="flex-1 px-3 py-1 text-[10px] font-mono-num bg-[#F7F6F3] dark:bg-[#0F0F12] rounded-full text-[#6B6B70] dark:text-[#98989F] border border-[#ECEAE5] dark:border-[#26262F] ml-2">
              https://shop.demo/checkout/step-2
            </span>
            <Badge variant="accent" pulse>Live</Badge>
          </div>

          {/* Viewport with cursor layer */}
          <div className="relative flex-1 overflow-hidden">
            <img
              src="/assets/hero-scene.png"
              alt="Live simulation viewport"
              className="w-full h-full object-cover object-top"
            />
            <CursorLayer cursors={activeCursors} />
          </div>
        </div>

        {/* Right: Thought feed */}
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-3 overflow-y-auto max-h-[600px] flex flex-col gap-2">
          <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-1 px-1 shrink-0">LIVE THOUGHTS</p>
          <AnimatePresence initial={false}>
            {thoughts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className={`rounded-xl p-2.5 border text-left
                  ${t.variant === 'friction'
                    ? 'border-[#F08A7E]/30 bg-[#F08A7E]/5 dark:bg-[#F08A7E]/10'
                    : 'border-[#ECEAE5] dark:border-[#26262F] bg-[#F7F6F3] dark:bg-[#1E1E24]'}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                    <SmartImage
                      src={t.avatar}
                      fallbackSrc={t.fallbackAvatar}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate">
                    {t.name.split(' ')[0]}
                  </span>
                  {t.variant === 'friction' && (
                    <span className="ml-auto text-[9px] text-[#F08A7E] font-bold">friction</span>
                  )}
                </div>
                <p className="text-[11px] text-[#1C1C1E] dark:text-[#F2F2F7] leading-relaxed">"{t.text}"</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {thoughts.length === 0 && (
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F] text-center mt-8">Waiting for first thoughts…</p>
          )}
        </div>
      </div>

      {/* ── Bottom timeline scrubber ── */}
      <GlassPanel className="rounded-2xl p-4 flex items-center gap-4">
        <span className="text-xs text-[#6B6B70] dark:text-[#98989F] font-mono-num shrink-0">0:00</span>
        <div className="flex-1 relative h-6 flex items-center">
          <div className="w-full h-1.5 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full" />
          <motion.div
            className="absolute h-1.5 bg-gradient-to-r from-[#6C63FF] to-[#8FB8A8] rounded-full"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range" min={0} max={100} value={scrubberPos}
            onChange={e => setScrubberPos(+e.target.value)}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
          <motion.div
            className="absolute w-4 h-4 rounded-full bg-[#6C63FF] border-2 border-white dark:border-[#17171B] shadow-md"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>
        <span className="text-xs text-[#6B6B70] dark:text-[#98989F] font-mono-num shrink-0">{formatTime(elapsed)}</span>
        <button
          onClick={() => navigate(runId && isRealRun ? `/app/dashboard?runId=${runId}` : '/app/dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6C63FF] text-white text-xs font-semibold rounded-full hover:bg-[#5B54E8] transition-colors"
        >
          Results <ArrowRight size={12} />
        </button>
      </GlassPanel>

      {/* ── Run Complete Notification ── */}
      <AnimatePresence>
        {runFinished && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-gradient-to-r from-[#6C63FF]/15 to-[#8FB8A8]/20 border border-[#6C63FF]/30 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-sm text-[#1C1C1E] dark:text-[#F2F2F7]">
              <Sparkles size={16} className="text-[#6C63FF]" />
              <span className="font-semibold">All Persona Sessions Completed!</span>
              <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">Aggregated heatmap and insights are ready.</span>
            </div>
            <button
              onClick={() => navigate(runId && isRealRun ? `/app/dashboard?runId=${runId}` : '/app/dashboard')}
              className="px-3.5 py-1.5 bg-[#6C63FF] text-white text-xs font-semibold rounded-xl hover:bg-[#5B54E8] flex items-center gap-1.5 shadow-sm"
            >
              View Full Results Dashboard <ArrowRight size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveSimulationPage;
