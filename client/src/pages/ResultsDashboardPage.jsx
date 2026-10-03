import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, MessageSquare, Zap, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';
import Card from '../components/ui/Card';
import GlassPanel from '../components/ui/GlassPanel';
import Badge from '../components/ui/Badge';
import SmartImage from '../components/ui/SmartImage';
import Skeleton from '../components/ui/Skeleton';
import InteractiveHeatmap from '../components/dashboard/InteractiveHeatmap';
import { all50Personas } from '../mock/personas';
import OnboardingBanner from '../components/dashboard/OnboardingBanner';
import { useAuth } from '../context/AuthContext';
import {
  getRunReport,
  getRuns,
  getPersonas,
} from '../services/api';

// ─── Sparkline card ────────────────────────────────────────────────────────
const MetricCard = ({ title, value, unit = '', suffix = '', delta, sparkData, color, animate }) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    if (!animate) { setDisplayed(value); return; }
    let start = 0;
    const step = value / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplayed(value); clearInterval(timer); }
      else setDisplayed(Math.round(start));
    }, 20);
    return () => clearInterval(timer);
  }, [value, animate]);

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#6B6B70] dark:text-[#98989F] font-medium">{title}</p>
          <p className="text-3xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7] mt-1">
            {unit}{displayed}{suffix}
          </p>
        </div>
        {delta !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${delta >= 0 ? 'bg-[#8FB8A8]/20 text-[#8FB8A8]' : 'bg-[#F08A7E]/20 text-[#F08A7E]'}`}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
              fill={`url(#grad-${title})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

// ─── 50-avatar grid (stats) ────────────────────────────────────────────────
const AvatarGrid50 = ({ personas, highlightCount, animate }) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {personas.slice(0, 50).map((p, i) => {
        const isHighlighted = i < highlightCount;
        return (
          <motion.div
            key={p.id}
            initial={animate ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: animate ? i * 0.015 : 0, duration: 0.3 }}
            className={`w-6 h-6 rounded-full overflow-hidden ring-2 transition-all
              ${isHighlighted ? 'ring-[#F08A7E]' : 'ring-transparent opacity-30'}`}
          >
            <SmartImage
              src={p.avatar}
              fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${p.id}`}
              alt={p.name}
              className="w-full h-full object-cover"
            />
          </motion.div>
        );
      })}
    </div>
  );
};

// ─── Insight card ─────────────────────────────────────────────────────────
const InsightCard = ({ insight, personas }) => {
  const [expanded, setExpanded] = useState(false);
  const iconMap = { AlertTriangle, MessageSquare, Zap };
  const Icon = iconMap[insight.icon] ?? AlertTriangle;
  const severityColors = {
    critical: 'bg-[#F08A7E]/10 text-[#F08A7E] border-[#F08A7E]/30',
    high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    medium: 'bg-[#6C63FF]/10 text-[#6C63FF] border-[#6C63FF]/30',
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all ${severityColors[insight.severity] ?? severityColors.medium}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/60 dark:bg-black/20 shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={insight.severity === 'critical' ? 'friction' : 'default'} className="capitalize">
              {insight.severity}
            </Badge>
            <p className="font-heading font-semibold text-sm">{insight.issue}</p>
          </div>
          <p className="text-xs opacity-80 line-clamp-2">{insight.detail}</p>

          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            {expanded ? 'Collapse' : 'See fix'} <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-current/20 text-xs space-y-2">
                  <p className="font-semibold">Suggested Fix:</p>
                  <p className="opacity-80">{insight.suggestedFix}</p>
                  <p className="font-semibold mt-2">Affected Personas ({insight.affectedCount}):</p>
                  <div className="flex flex-wrap gap-1">
                    {personas
                      .filter(p => insight.affectedPersonaIds.includes(p.id))
                      .slice(0, 12)
                      .map(p => (
                        <div key={p.id} className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-current/30">
                          <SmartImage
                            src={p.avatar}
                            fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${p.id}`}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    {insight.affectedCount > 12 && (
                      <span className="text-[10px] font-semibold opacity-70 self-center">+{insight.affectedCount - 12} more</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─── Funnel bar ───────────────────────────────────────────────────────────
const FunnelBar = ({ stage, count, pct, maxCount }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-[#6B6B70] dark:text-[#98989F] w-32 shrink-0 truncate">{stage}</span>
    <div className="flex-1 h-6 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(count / maxCount) * 100}%` }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-[#8FB8A8] flex items-center justify-end pr-2"
      >
        <span className="text-[10px] font-semibold text-white">{count}</span>
      </motion.div>
    </div>
    <span className="text-xs font-mono-num font-semibold text-[#6B6B70] dark:text-[#98989F] w-8 text-right">{pct}%</span>
  </div>
);

// ─── Feedback masonry card ─────────────────────────────────────────────────
const FeedbackCard = ({ session }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="p-4 break-inside-avoid mb-4 cursor-pointer hover:shadow-float transition-shadow"
      onClick={() => setExpanded(e => !e)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2"
          style={{ '--tw-ring-color': session.persona.color }}>
          <SmartImage
            src={session.persona.avatar}
            fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${session.personaId}`}
            alt={session.persona.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{session.persona.name}</p>
          <Badge
            variant={session.status === 'converted' ? 'default' : 'friction'}
            className="text-[9px]"
          >
            {session.status}
          </Badge>
        </div>
        <span className="ml-auto text-xs font-mono-num text-[#6B6B70] dark:text-[#98989F]">
          {Math.round(session.totalTime)}s
        </span>
      </div>
      <p className="text-xs text-[#6B6B70] dark:text-[#98989F] italic leading-relaxed">
        "{session.finalFeedback}"
      </p>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-[#ECEAE5] dark:border-[#26262F] space-y-2">
              <p className="text-[10px] font-semibold text-[#6B6B70] dark:text-[#98989F]">STEP TIMELINE</p>
              {session.steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-white mt-0.5
                    ${i === session.steps.length - 1 && session.status !== 'converted' ? 'bg-[#F08A7E]' : 'bg-[#6C63FF]'}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{step.label}</p>
                    <p className="text-[9px] text-[#6B6B70] dark:text-[#98989F]">{step.duration}s · {step.expression}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-[9px] text-[#6C63FF] mt-2">{expanded ? 'Collapse ▲' : 'See timeline ▼'}</p>
    </Card>
  );
};

// ─── Main ResultsDashboardPage ─────────────────────────────────────────────
export const ResultsDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryRunId = searchParams.get('runId');

  const [runId, setRunId] = useState(queryRunId || '');
  const [run, setRun] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [insights, setInsights] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [personaTypeScores, setPersonaTypeScores] = useState([]);
  const [personas, setPersonas] = useState(all50Personas);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animateDone, setAnimateDone] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let activeId = queryRunId;
        if (!activeId) {
          const runs = await getRuns();
          if (runs && runs.length > 0) {
            activeId = runs[0].id || runs[0]._id;
          }
        }
        if (!activeId) {
          if (isMounted) { setLoading(false); setError('No runs found. Start a run from the New Run page.'); }
          return;
        }
        setRunId(activeId);

        // Fetch report as the single source of truth
        const report = await getRunReport(activeId);
        if (!isMounted) return;

        if (report) {
          setRun(report.run);
          setMetrics(report.metrics);
          setFunnel(Array.isArray(report.funnel) ? report.funnel : null);
          setInsights(Array.isArray(report.insights) ? report.insights : null);
          setSessions(Array.isArray(report.sessions) ? report.sessions : null);
          setPersonaTypeScores(report.personaTypeScores || []);
        }

        const personasDataRes = await getPersonas();
        if (isMounted && personasDataRes && personasDataRes.length > 0) {
          setPersonas(personasDataRes);
        }

      } catch (err) {
        console.error('[ResultsDashboardPage] Error loading run data:', err.message);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
          setTimeout(() => setAnimateDone(true), 200);
        }
      }
    }

    loadData();

    return () => { isMounted = false; };
  }, [queryRunId]);

  // Real persona type scores from report (no hardcoded fallback)
  const personaTypeData = personaTypeScores?.length > 0
    ? personaTypeScores.map(s => ({
        label: s.tag,
        success: s.successRate,
        total: s.sessionCount,
      }))
    : run?.summary?.personaTypeScores?.length > 0
      ? run.summary.personaTypeScores.map(s => ({
          label: s.tag,
          success: s.successRate,
          total: s.sessionCount,
        }))
      : [];

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Metric card skeletons */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-5 flex flex-col gap-3">
              <Skeleton width="40%" height="16px" className="rounded-md" />
              <Skeleton width="60%" height="32px" className="rounded-lg" />
              <Skeleton width="100%" height="56px" className="rounded-xl mt-2" />
            </Card>
          ))}
        </div>

        {/* Heatmap skeleton */}
        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <Skeleton width="30%" height="24px" className="rounded-md" />
            <Skeleton width="80px" height="24px" className="rounded-full" />
          </div>
          <Skeleton width="100%" height="480px" className="rounded-2xl" />
        </Card>

        {/* Insights skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <Skeleton width="30%" height="24px" className="rounded-md" />
            <Skeleton width="100%" height="120px" className="rounded-xl" />
            <Skeleton width="100%" height="80px" className="rounded-xl" />
          </Card>
          <Card className="p-5 flex flex-col gap-4">
            <Skeleton width="30%" height="24px" className="rounded-md" />
            <Skeleton width="100%" height="160px" className="rounded-xl" />
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#F08A7E] font-semibold">{error}</p>
        <button
          onClick={() => navigate('/app/new-run')}
          className="px-4 py-2 bg-[#6C63FF] text-white rounded-xl text-sm font-semibold hover:bg-[#5b52e0] transition-colors"
        >
          Start a New Run
        </button>
      </div>
    );
  }

  // Use real data or fall back to safe empty defaults (never mock)
  const safeMetrics = metrics || { taskSuccessRate: 0, avgFrustration: 0, ctaMissRate: 0, avgSessionTime: 0, sparklines: { taskSuccess: [], frustration: [], dropOff: [], sessionTime: [] } };
  const safeSessions = sessions || [];
  const safeFunnel = funnel || [];
  const safeInsights = insights || [];
  const isRunning = run?.status === 'running' || run?.status === 'queued';
  const isFailed = run?.status === 'failed';

  return (
    <div className="flex flex-col gap-6">

      <OnboardingBanner user={user} runCount={safeSessions.length} />

      {/* ── Run status banner ── */}
      {isRunning && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-[#6C63FF] text-sm font-medium"
        >
          <RefreshCw size={16} className="animate-spin shrink-0" />
          <span>Run is in progress — results will appear when complete. <button onClick={() => navigate(`/app/live?runId=${runId}`)} className="underline ml-1">Watch live →</button></span>
        </motion.div>
      )}
      {isFailed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#F08A7E]/10 border border-[#F08A7E]/20 text-[#F08A7E] text-sm font-medium"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>Run failed: {run?.summary?.errorMessage || 'Unknown error'}. <button onClick={() => navigate('/app/new-run')} className="underline ml-1">Start a new run →</button></span>
        </motion.div>
      )}

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Task Success Rate" value={safeMetrics.taskSuccessRate} suffix="%" delta={+12}
          sparkData={safeMetrics.sparklines?.taskSuccess || []} color="#8FB8A8" animate={animateDone} />
        <MetricCard title="Avg Frustration" value={safeMetrics.avgFrustration} unit="" suffix="/100" delta={-8}
          sparkData={safeMetrics.sparklines?.frustration || []} color="#F08A7E" animate={animateDone} />
        <MetricCard title="CTA Miss Rate" value={safeMetrics.ctaMissRate} suffix="%" delta={-5}
          sparkData={safeMetrics.sparklines?.dropOff || []} color="#6C63FF" animate={animateDone} />
        <MetricCard title="Avg Session" value={safeMetrics.avgSessionTime} suffix="s" delta={+3}
          sparkData={safeMetrics.sparklines?.sessionTime || []} color="#6B6B70" animate={animateDone} />
      </div>

      {/* ── High-Fidelity Interactive Heatmap ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="font-heading font-semibold text-lg text-[#1C1C1E] dark:text-[#F2F2F7]">
              Multi-Screen Interaction Heatmap
            </h2>
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-0.5">
              Aggregated thermal glow, rage clusters, and scroll depth across {safeSessions.length} testing sessions
              {run?.url ? ` on ${run.url}` : ''}
            </p>
          </div>
          <Badge variant="accent" pulse>
            Live Analytics
          </Badge>
        </div>

        <InteractiveHeatmap runId={runId} sessions={safeSessions} />
      </Card>

      {/* ── AI Insights + Funnel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Insights */}
        <Card className="p-5 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-lg text-[#1C1C1E] dark:text-[#F2F2F7]">AI Insights</h2>
          {/* Avatar friction count */}
          <div className="bg-[#F7F6F3] dark:bg-[#0F0F12] rounded-xl p-3">
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mb-2">
              <span className="text-[#F08A7E] font-bold font-mono-num text-base">
                {safeSessions.filter(s => s.outcome !== 'completed' || (s.frustrationScore || 0) > 40).length}
              </span>
              <span className="text-[#1C1C1E] dark:text-[#F2F2F7] font-bold font-mono-num text-base"> / {safeSessions.length || '–'}</span>
              {' '}personas encountered primary UX friction
            </p>
            <AvatarGrid50
              personas={personas}
              highlightCount={safeSessions.filter(s => s.outcome !== 'completed' || (s.frustrationScore || 0) > 40).length}
              animate={animateDone}
            />
          </div>
          <div className="flex flex-col gap-3">
            {safeInsights.length === 0 ? (
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F] text-center py-6">
                {isRunning ? 'AI insights will appear when the run completes.' : 'No insights generated yet.'}
              </p>
            ) : safeInsights.map(ins => (
              <InsightCard key={ins.id} insight={ins} personas={personas} />
            ))}
          </div>
        </Card>

        {/* Funnel + Persona scorecard */}
        <div className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-lg text-[#1C1C1E] dark:text-[#F2F2F7]">Drop-off Funnel</h2>
            <div className="flex flex-col gap-2.5">
              {safeFunnel.length === 0 ? (
                <p className="text-sm text-[#6B6B70] dark:text-[#98989F] text-center py-6">
                  {isRunning ? 'Funnel data will appear when the run completes.' : 'No funnel data yet.'}
                </p>
              ) : safeFunnel.map((f) => (
                <FunnelBar key={f.stage} {...f} maxCount={safeSessions.length || 1} />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg text-[#1C1C1E] dark:text-[#F2F2F7] mb-4">By Persona Type</h2>
            <div className="flex flex-col gap-3">
              {personaTypeData.map(({ label, success }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-[#6B6B70] dark:text-[#98989F] w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-4 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${success}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full rounded-full"
                      style={{ background: success > 50 ? '#8FB8A8' : success > 25 ? '#6C63FF' : '#F08A7E' }}
                    />
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-[#6B6B70] dark:text-[#98989F] w-8 text-right">{success}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Feedback masonry wall ── */}
      <Card className="p-5">
        <h2 className="font-heading font-semibold text-lg text-[#1C1C1E] dark:text-[#F2F2F7] mb-4">
          Persona Feedback ({safeSessions.length})
        </h2>
        {safeSessions.length === 0 ? (
          <div className="py-12 text-center text-[#6B6B70] dark:text-[#98989F]">
            <p className="text-sm">
              {isRunning ? 'Sessions are running — feedback will appear here when complete.' : 'No persona sessions recorded for this run yet.'}
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {safeSessions.slice(0, 24).map(session => (
              <FeedbackCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ResultsDashboardPage;
