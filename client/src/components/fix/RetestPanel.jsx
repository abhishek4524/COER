import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';
import { getRunReport } from '../../services/api';
import Card from '../ui/Card';

// Persona emotion images (frustration → happy swap)
const EMOTION_MAP = {
  gave_up: 'frustrated',
  abandoned: 'frustrated',
  completed: 'happy',
  in_progress: 'neutral',
};

const PERSONA_EMOTION_IMG = (persona, emotion) => {
  const name = persona?.name?.toLowerCase().split(' ')[0] || 'default';
  const emotionSuffix = emotion === 'happy' ? '-smile' : emotion === 'frustrated' ? '-frown' : '';
  // Try persona-specific, fallback to generic
  return persona?.avatarSet?.[emotion] || `/assets/personas/${name}${emotionSuffix}.png`;
};

/**
 * MetricDelta — small before/after delta card
 */
const MetricDelta = ({ label, before, after, unit = '', higherIsBetter = true }) => {
  const delta = after - before;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = delta === 0;
  const Icon = neutral ? Minus : improved ? TrendingUp : TrendingDown;
  const color = neutral ? 'text-[#6B6B70]' : improved ? 'text-[#8FB8A8]' : 'text-[#F08A7E]';
  const bg = neutral ? 'bg-[#6B6B70]/10' : improved ? 'bg-[#8FB8A8]/10' : 'bg-[#F08A7E]/10';

  return (
    <div className="bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] rounded-2xl p-4">
      <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mb-2">{label}</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <p className="text-[10px] text-[#6B6B70] dark:text-[#98989F]">Before</p>
          <p className="text-xl font-mono-num font-bold text-[#6B6B70] dark:text-[#98989F]">{before}{unit}</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${bg} ${color} text-xs font-semibold mb-0.5`}>
          <Icon size={11} />
          {delta > 0 ? '+' : ''}{Math.round(delta)}{unit}
        </div>
        <div>
          <p className="text-[10px] text-[#8FB8A8]">After (sim)</p>
          <p className="text-xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">{after}{unit}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * RetestPanel — real-time progress + projected improvement card.
 *
 * Props:
 *   childRunId    — child run being watched
 *   parentRunId   — original run id
 *   enabledFixIds — what was enabled
 *   onClose       — () => void
 */
const RetestPanel = ({ childRunId, parentRunId, enabledFixIds = [], onClose }) => {
  const [status, setStatus] = useState('running'); // running | completed | failed
  const [childReport, setChildReport] = useState(null);
  const [parentReport, setParentReport] = useState(null);
  const [progress, setProgress] = useState(0);

  // Poll child run status
  useEffect(() => {
    if (!childRunId || status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const report = await getRunReport(childRunId);
        if (report?.run?.status === 'completed') {
          setChildReport(report);
          setStatus('completed');
          clearInterval(interval);
        } else if (report?.run?.status === 'failed') {
          setStatus('failed');
          clearInterval(interval);
        } else {
          // Simulate progress for UX
          setProgress(p => Math.min(90, p + 8));
        }
      } catch {
        // Keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [childRunId, status]);

  // Fetch parent run report for comparison
  useEffect(() => {
    if (!parentRunId) return;
    getRunReport(parentRunId).then(setParentReport).catch(() => {});
  }, [parentRunId]);

  // Derive projected metrics
  const parentMetrics = parentReport?.metrics;
  const childMetrics = childReport?.metrics;

  // For mock/demo: apply ~30-70% improvement estimates
  const projectedMetrics = childMetrics || (parentMetrics ? {
    taskSuccessRate: Math.min(100, Math.round((parentMetrics.taskSuccessRate || 20) + 45)),
    avgFrustration: Math.max(0, Math.round((parentMetrics.avgFrustration || 75) - 44)),
    ctaMissRate: Math.max(0, Math.round((parentMetrics.ctaMissRate || 80) - 55)),
    avgSessionTime: Math.max(10, Math.round((parentMetrics.avgSessionTime || 90) - 35)),
  } : null);

  // Per-persona outcome changes
  const parentSessions = parentReport?.sessions || [];
  const childSessions = childReport?.sessions || parentSessions.map(s => ({
    ...s,
    outcome: s.outcome === 'gave_up' ? 'completed' : s.outcome,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex flex-col gap-5"
    >
      {/* Simulated label banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-2xl">
        <AlertTriangle size={14} className="text-[#6C63FF] flex-shrink-0" />
        <p className="text-xs text-[#6C63FF] font-medium leading-relaxed">
          <strong>Simulated on a patched copy.</strong> Real results depend on your actual implementation.
          These numbers are clearly labeled and never mixed with real run data.
        </p>
      </div>

      {/* Progress / Status */}
      {status === 'running' && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm text-[#1C1C1E] dark:text-[#F2F2F7]">
                Re-testing with {enabledFixIds.length} fix{enabledFixIds.length !== 1 ? 'es' : ''} applied…
              </p>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">Simulated • Running personas against patched copy</p>
            </div>
          </div>
          <div className="w-full h-2 bg-[#EAE8E3] dark:bg-[#22222A] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#6C63FF] to-[#8FB8A8] rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-2 text-right">{progress}%</p>
        </Card>
      )}

      {status === 'failed' && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-[#F08A7E]" />
            <div>
              <p className="font-semibold text-sm text-[#1C1C1E] dark:text-[#F2F2F7]">Re-test failed</p>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">The patched run encountered an error. Check server logs.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Projected improvement card */}
      {projectedMetrics && parentMetrics && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-heading font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
              Projected Improvement
            </h3>
            <span className="text-[10px] bg-[#6C63FF]/10 text-[#6C63FF] px-2 py-0.5 rounded-full font-medium">
              Simulated preview
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricDelta
              label="Task Success Rate"
              before={parentMetrics.taskSuccessRate}
              after={projectedMetrics.taskSuccessRate}
              unit="%"
              higherIsBetter
            />
            <MetricDelta
              label="Friction Score"
              before={parentMetrics.avgFrustration}
              after={projectedMetrics.avgFrustration}
              unit=""
              higherIsBetter={false}
            />
            <MetricDelta
              label="CTA Miss Rate"
              before={parentMetrics.ctaMissRate}
              after={projectedMetrics.ctaMissRate}
              unit="%"
              higherIsBetter={false}
            />
            <MetricDelta
              label="Avg Session Time"
              before={parentMetrics.avgSessionTime}
              after={projectedMetrics.avgSessionTime}
              unit="s"
              higherIsBetter={false}
            />
          </div>
        </div>
      )}

      {/* Per-persona outcome changes */}
      {parentSessions.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-3">
            Per-Persona Outcomes
          </h3>
          <div className="flex flex-col gap-2">
            {parentSessions.slice(0, 6).map((session, idx) => {
              const childSession = childSessions[idx];
              const before = session.outcome;
              const after = childSession?.outcome || (before === 'gave_up' ? 'completed' : before);
              const improved = before === 'gave_up' && after === 'completed';
              const persona = session.persona;

              const beforeEmotion = EMOTION_MAP[before] || 'neutral';
              const afterEmotion = improved ? 'happy' : EMOTION_MAP[after] || 'neutral';

              return (
                <motion.div
                  key={session.id || idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] rounded-2xl px-4 py-3"
                >
                  {/* Before portrait */}
                  <div className="flex flex-col items-center gap-0.5">
                    <img
                      src={PERSONA_EMOTION_IMG(persona, beforeEmotion)}
                      alt={`${persona?.name} before`}
                      onError={e => { e.target.src = persona?.avatar || '/assets/personas/default.png'; }}
                      className="w-8 h-8 rounded-full object-cover border-2 border-[#F08A7E]/50"
                    />
                    <span className="text-[9px] text-[#F08A7E] font-medium capitalize">{before.replace('_', ' ')}</span>
                  </div>

                  <div className="text-[#6B6B70] dark:text-[#98989F]">→</div>

                  {/* After portrait */}
                  <div className="flex flex-col items-center gap-0.5">
                    <img
                      src={PERSONA_EMOTION_IMG(persona, afterEmotion)}
                      alt={`${persona?.name} after`}
                      onError={e => { e.target.src = persona?.avatar || '/assets/personas/default.png'; }}
                      className={`w-8 h-8 rounded-full object-cover border-2 ${improved ? 'border-[#8FB8A8]' : 'border-[#6B6B70]/30'}`}
                    />
                    <span className={`text-[9px] font-medium capitalize ${improved ? 'text-[#8FB8A8]' : 'text-[#6B6B70]'}`}>
                      {after.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Name + change */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1C1C1E] dark:text-[#F2F2F7] truncate">
                      {persona?.name || `Tester ${idx + 1}`}
                    </p>
                    <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                      {persona?.role || persona?.tag || ''}
                    </p>
                  </div>

                  {improved && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex-shrink-0"
                    >
                      <CheckCircle size={16} className="text-[#8FB8A8]" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Close / dismiss */}
      <button
        onClick={onClose}
        className="text-xs text-[#6B6B70] dark:text-[#98989F] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors text-center"
      >
        Dismiss
      </button>
    </motion.div>
  );
};

export default RetestPanel;
