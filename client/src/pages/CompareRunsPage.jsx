/**
 * CompareRunsPage.jsx
 *
 * Two-tab layout:
 *   "Fix preview" (new, default after a run) — Simulated fix emulator
 *   "Run vs run"  (existing, real data)       — Side-by-side heatmap comparison
 *
 * Simulated preview content is clearly labeled and never mixed with real run data.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, Eye, MousePointer,
  Flame, ChevronDown, Wrench, BarChart3,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FixPreviewTab from '../components/fix/FixPreviewTab';
import { getRuns, getRunReport } from '../services/api';

// ─── Canvas heatmap renderer ────────────────────────────────────────────────
const drawHeatmap = (canvas, points, filter) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const typeColors = { click: '#6C63FF', rage: '#F08A7E', dead: '#6B6B70', scroll: '#8FB8A8' };
  const filtered = filter === 'all' ? points : points.filter(p => p.type === filter);

  filtered.forEach(p => {
    const px = (p.x / 760) * W;
    const py = (p.y / 480) * H;
    const r = 28 * p.intensity;
    const color = typeColors[p.type] ?? typeColors.click;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, color + 'AA');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  });
};

// ─── Split heatmap viewer ──────────────────────────────────────────────────
const HeatmapSplit = ({ runA, runB, filter }) => {
  const containerRef = useRef(null);
  const canvasARef = useRef(null);
  const canvasBRef = useRef(null);
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);

  useEffect(() => {
    if (runA?.heatmapPoints) drawHeatmap(canvasARef.current, runA.heatmapPoints, filter);
  }, [runA, filter]);

  useEffect(() => {
    if (runB?.heatmapPoints) drawHeatmap(canvasBRef.current, runB.heatmapPoints, filter);
  }, [runB, filter]);

  const onMouseDown = () => { dragging.current = true; };

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setSplitPct(Math.max(5, Math.min(95, (x / rect.width) * 100)));
  }, []);

  const onMouseUp = () => { dragging.current = false; };

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden select-none cursor-col-resize"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Background image full width — Run A */}
      <img src={runA?.screenshot || "/assets/steps/product.png"} alt={runA?.label || "Run A"} className="w-full h-full object-cover absolute inset-0" />

      {/* Run A canvas — clipped to left side */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}>
        <canvas ref={canvasARef} width={760} height={428} className="w-full h-full" />
      </div>

      {/* Run B overlay — clipped to right side */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${splitPct}%)` }}>
        <img src={runB?.screenshot || "/assets/steps/product.png"} alt={runB?.label || "Run B"} className="w-full h-full object-cover absolute inset-0" />
        <canvas ref={canvasBRef} width={760} height={428} className="w-full h-full" />
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 w-1 bg-white shadow-xl cursor-col-resize z-20 flex items-center justify-center"
        style={{ left: `${splitPct}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center border border-[#ECEAE5]">
          <span className="text-[10px] font-bold text-[#6B6B70]">⇔</span>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-10">
        <span className="px-2.5 py-1 text-xs font-semibold text-white rounded-full"
          style={{ background: runA?.color ?? '#6C63FF' }}>
          {runA?.label ?? 'Run A'}
          {runA?.simulated && <span className="ml-1 opacity-80">· Simulated preview</span>}
        </span>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <span className="px-2.5 py-1 text-xs font-semibold text-white rounded-full"
          style={{ background: runB?.color ?? '#8FB8A8' }}>
          {runB?.label ?? 'Run B'}
          {runB?.simulated && <span className="ml-1 opacity-80">· Simulated preview</span>}
        </span>
      </div>
    </div>
  );
};

// ─── Delta metric card ─────────────────────────────────────────────────────
const DeltaCard = ({ label, aVal, bVal, unit = '', higherIsBetter = true }) => {
  const delta = bVal - aVal;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = delta === 0;
  const Icon = neutral ? Minus : improved ? TrendingUp : TrendingDown;
  const color = neutral ? 'text-[#6B6B70]' : improved ? 'text-[#8FB8A8]' : 'text-[#F08A7E]';
  const bg = neutral ? 'bg-[#6B6B70]/10' : improved ? 'bg-[#8FB8A8]/10' : 'bg-[#F08A7E]/10';

  return (
    <Card className="p-5">
      <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mb-2">{label}</p>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-[#6B6B70] dark:text-[#98989F]">Before</p>
          <p className="text-2xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">{aVal}{unit}</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${bg} ${color} text-xs font-semibold mb-1`}>
          <Icon size={12} />
          {delta > 0 ? '+' : ''}{delta}{unit}
        </div>
        <div>
          <p className="text-[10px] text-[#6B6B70] dark:text-[#98989F]">After</p>
          <p className="text-2xl font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">{bVal}{unit}</p>
        </div>
      </div>
    </Card>
  );
};

// ─── Run vs Run Tab ────────────────────────────────────────────────────────
const RunVsRunTab = ({ allRuns }) => {
  const [runAId, setRunAId] = useState('');
  const [runBId, setRunBId] = useState('');
  const [runAReport, setRunAReport] = useState(null);
  const [runBReport, setRunBReport] = useState(null);
  const [heatmapFilter, setHeatmapFilter] = useState('all');

  useEffect(() => {
    if (allRuns.length > 0) {
      setRunAId(allRuns[0]?.id || allRuns[0]?._id || '');
      setRunBId(allRuns[1]?.id || allRuns[1]?._id || allRuns[0]?.id || '');
    }
  }, [allRuns]);

  useEffect(() => {
    if (!runAId) return;
    getRunReport(runAId).then(r => {
      if (r) setRunAReport({
        id: runAId,
        label: r.run?.url || runAId,
        date: r.run?.createdAt ? new Date(r.run.createdAt).toLocaleDateString() : '',
        color: '#6C63FF',
        simulated: r.run?.simulated || false,
        taskSuccess: r.metrics?.taskSuccessRate ?? 0,
        avgFrustration: r.metrics?.avgFrustration ?? 0,
        ctaMissRate: r.metrics?.ctaMissRate ?? 0,
        personaCount: r.run?.personaCount ?? 0,
        heatmapPoints: r.heatmapPoints || [],
      });
    });
  }, [runAId]);

  useEffect(() => {
    if (!runBId || runBId === runAId) return;
    getRunReport(runBId).then(r => {
      if (r) setRunBReport({
        id: runBId,
        label: r.run?.url || runBId,
        date: r.run?.createdAt ? new Date(r.run.createdAt).toLocaleDateString() : '',
        color: '#8FB8A8',
        simulated: r.run?.simulated || false,
        taskSuccess: r.metrics?.taskSuccessRate ?? 0,
        avgFrustration: r.metrics?.avgFrustration ?? 0,
        ctaMissRate: r.metrics?.ctaMissRate ?? 0,
        personaCount: r.run?.personaCount ?? 0,
        heatmapPoints: r.heatmapPoints || [],
      });
    });
  }, [runBId, runAId]);

  const runA = runAReport;
  const runB = runBReport;

  const filters = [
    { key: 'all',    label: 'All',    icon: Eye },
    { key: 'click',  label: 'Clicks', icon: MousePointer },
    { key: 'rage',   label: 'Rage',   icon: Flame },
    { key: 'scroll', label: 'Scroll', icon: ChevronDown },
    { key: 'dead',   label: 'Dead',   icon: Minus },
  ];

  const SelectRun = ({ value, onChange, label }) => (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-2xl border border-[#ECEAE5] dark:border-[#26262F]
            bg-white dark:bg-[#17171B] text-sm text-[#1C1C1E] dark:text-[#F2F2F7]
            focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition-all"
        >
          {allRuns.map(r => (
            <option key={r.id || r._id} value={r.id || r._id}>
              {r.url || r.label || r.id} — {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
              {r.simulated ? ' · Simulated preview' : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B70] pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Run selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectRun value={runAId} onChange={setRunAId} label="Before (Run A)" />
        <SelectRun value={runBId} onChange={setRunBId} label="After (Run B)" />
      </div>

      {/* Simulated warning if any run is simulated */}
      {(runA?.simulated || runB?.simulated) && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-2xl text-xs text-[#6C63FF]">
          <Wrench size={12} />
          One or more selected runs is a simulated patched run. Metrics are labeled accordingly.
        </div>
      )}

      {/* Delta metrics */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {runA && runB && (<>
          <DeltaCard label="Task Success Rate" aVal={runA.taskSuccess} bVal={runB.taskSuccess} unit="%" higherIsBetter />
          <DeltaCard label="Avg Frustration"   aVal={runA.avgFrustration} bVal={runB.avgFrustration} unit="" higherIsBetter={false} />
          <DeltaCard label="CTA Miss Rate"     aVal={runA.ctaMissRate} bVal={runB.ctaMissRate} unit="%" higherIsBetter={false} />
          <DeltaCard label="Persona Count"     aVal={runA.personaCount} bVal={runB.personaCount} unit="" higherIsBetter />
        </>)}
      </motion.div>

      {/* Heatmap filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mr-1">Show:</span>
        {filters.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setHeatmapFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border
              ${heatmapFilter === key
                ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow'
                : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/30'}`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* Split heatmap */}
      <Card className="p-0 overflow-hidden">
        <HeatmapSplit runA={runA} runB={runB} filter={heatmapFilter} />
      </Card>

      {/* Summary table */}
      {runA && runB && (
        <Card className="p-5">
          <h2 className="font-heading font-semibold text-lg text-[#1C1C1E] dark:text-[#F2F2F7] mb-4">Side-by-Side Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#ECEAE5] dark:border-[#26262F]">
                  <th className="py-2 text-left text-xs font-semibold text-[#6B6B70] dark:text-[#98989F]">Metric</th>
                  <th className="py-2 text-right text-xs font-semibold" style={{ color: runA.color }}>{runA.label}</th>
                  <th className="py-2 text-right text-xs font-semibold" style={{ color: runB.color }}>
                    {runB.label}
                    {runB.simulated && <span className="ml-1 text-[#6B6B70] font-normal">(sim)</span>}
                  </th>
                  <th className="py-2 text-right text-xs font-semibold text-[#6B6B70] dark:text-[#98989F]">Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Task Success', a: runA.taskSuccess, b: runB.taskSuccess, unit: '%', hib: true },
                  { label: 'CTA Miss Rate', a: runA.ctaMissRate, b: runB.ctaMissRate, unit: '%', hib: false },
                  { label: 'Avg Frustration', a: runA.avgFrustration, b: runB.avgFrustration, unit: '', hib: false },
                  { label: 'Personas Tested', a: runA.personaCount, b: runB.personaCount, unit: '', hib: true },
                ].map(({ label, a, b, unit, hib }) => {
                  const d = b - a;
                  const improved = hib ? d > 0 : d < 0;
                  return (
                    <tr key={label} className="border-b border-[#ECEAE5]/50 dark:border-[#26262F]/50">
                      <td className="py-3 text-[#1C1C1E] dark:text-[#F2F2F7]">{label}</td>
                      <td className="py-3 text-right font-mono-num text-[#6B6B70] dark:text-[#98989F]">{a}{unit}</td>
                      <td className="py-3 text-right font-mono-num font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{b}{unit}</td>
                      <td className="py-3 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                          ${d === 0 ? 'bg-[#6B6B70]/10 text-[#6B6B70]'
                            : improved ? 'bg-[#8FB8A8]/15 text-[#8FB8A8]'
                            : 'bg-[#F08A7E]/15 text-[#F08A7E]'}`}>
                          {d > 0 ? '+' : ''}{d}{unit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── Main CompareRunsPage ──────────────────────────────────────────────────
export const CompareRunsPage = () => {
  const [allRuns, setAllRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('fix'); // 'fix' | 'compare'
  const [selectedRunId, setSelectedRunId] = useState('');

  // Load runs from API
  useEffect(() => {
    getRuns().then(runs => {
      if (Array.isArray(runs) && runs.length > 0) {
        setAllRuns(runs);
        // Default to first non-simulated run for fix preview
        const realRun = runs.find(r => !r.simulated) || runs[0];
        setSelectedRunId(realRun?.id || realRun?._id || '');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const tabs = [
    { id: 'fix', label: 'Fix preview', icon: Wrench, badge: 'New' },
    { id: 'compare', label: 'Run vs run', icon: BarChart3, badge: null },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[#6B6B70] dark:text-[#98989F] text-sm">Loading runs…</div>;
  }

  if (allRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-lg font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">No Runs Yet</p>
        <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
          Start your first run from the{' '}
          <a href="/app/new-run" className="text-[#6C63FF] underline">New Run page</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Tab selector ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-[#F7F6F3] dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative
              ${activeTab === tab.id
                ? 'bg-white dark:bg-[#1E1E24] text-[#1C1C1E] dark:text-[#F2F2F7] shadow-sm'
                : 'text-[#6B6B70] dark:text-[#98989F] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7]'}`}
          >
            <tab.icon size={15} />
            {tab.label}
            {tab.badge && (
              <span className="text-[9px] bg-[#6C63FF] text-white px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Run selector for Fix Preview tab ───────────────────────────────── */}
      {activeTab === 'fix' && allRuns.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] uppercase tracking-widest">Run:</span>
          <div className="relative">
            <select
              value={selectedRunId}
              onChange={e => setSelectedRunId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-2xl border border-[#ECEAE5] dark:border-[#26262F]
                bg-white dark:bg-[#17171B] text-sm text-[#1C1C1E] dark:text-[#F2F2F7]
                focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition-all min-w-[280px]"
            >
              {allRuns.filter(r => !r.simulated).map(r => (
                <option key={r.id || r._id} value={r.id || r._id}>
                  {r.url || r.id} — {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B70] pointer-events-none" />
          </div>
        </div>
      )}

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'fix' ? (
          <motion.div
            key="fix"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <FixPreviewTab runId={selectedRunId} />
          </motion.div>
        ) : (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {allRuns.length < 2 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <p className="text-lg font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">Not Enough Runs</p>
                <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
                  You need at least 2 runs to compare. Start a new run or use the Fix preview tab.
                </p>
              </div>
            ) : (
              <RunVsRunTab allRuns={allRuns} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompareRunsPage;
