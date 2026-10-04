import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Download, Play, Layers, ChevronRight,
  LayoutPanelLeft, Columns, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import Card from '../ui/Card';
import BeforeAfterSlider from './BeforeAfterSlider';
import FixList from './FixList';
import RetestPanel from './RetestPanel';
import { getRunFixes, previewFixes, retestWithFixes, exportFixes, getRunReport, getSessions } from '../../services/api';

/**
 * FixPreviewTab — "Fix preview" tab content.
 * Sits inside CompareRunsPage after a run is selected.
 *
 * Props:
 *   runId — the source run to fix
 */
const FixPreviewTab = ({ runId }) => {
  const [loading, setLoading] = useState(true);
  const [fixes, setFixes] = useState([]);
  const [previewable, setPreviewable] = useState(false);
  const [childRunId, setChildRunId] = useState(null);
  const [enabledFixIds, setEnabledFixIds] = useState(new Set());
  const [runReport, setRunReport] = useState(null);
  const [sessions, setSessions] = useState([]);

  // Pages visited in this run
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState('/');

  // Before/after preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [activeFixId, setActiveFixId] = useState(null); // from pin hover

  // View modes
  const [sideBySide, setSideBySide] = useState(false);
  const [showChangesOnly, setShowChangesOnly] = useState(false);

  // Retest state
  const [retesting, setRetesting] = useState(false);
  const [showRetestPanel, setShowRetestPanel] = useState(false);
  const [retestRunId, setRetestRunId] = useState(null);
  const [retestError, setRetestError] = useState(null);

  // Debounce preview requests when enabledFixIds changes
  const previewTimer = useRef(null);

  // ─── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    if (!runId) return;
    setLoading(true);

    Promise.all([
      getRunFixes(runId),
      getRunReport(runId),
      getSessions(runId),
    ]).then(([fixData, report, sess]) => {
      if (fixData) {
        setFixes(fixData.fixes || []);
        setPreviewable(fixData.previewable ?? true);
        if (fixData.childRunId) setChildRunId(fixData.childRunId);

        // Enable all fixes by default
        const allIds = new Set((fixData.fixes || []).map(f => f.id));
        setEnabledFixIds(allIds);
      }

      if (report) {
        setRunReport(report);
        // Extract unique pages visited
        const pageSet = new Set();
        (report.screens || []).forEach(s => {
          try { pageSet.add(new URL(s.url || '').pathname || '/'); } catch { pageSet.add('/'); }
        });
        if (pageSet.size === 0) pageSet.add('/');
        setPages([...pageSet]);
        setActivePage([...pageSet][0]);
      }

      if (sess) setSessions(sess);
    }).finally(() => setLoading(false));
  }, [runId]);

  // ─── Auto-preview when enabledFixIds or activePage changes ───────────────
  const triggerPreview = useCallback(() => {
    if (!runId || !previewable) return;
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      const result = await previewFixes(runId, {
        enabledFixIds: [...enabledFixIds],
        pagePath: activePage,
      });
      setPreviewResult(result);
      setPreviewLoading(false);
    }, 600);
  }, [runId, previewable, enabledFixIds, activePage]);

  useEffect(() => {
    triggerPreview();
    return () => clearTimeout(previewTimer.current);
  }, [triggerPreview]);

  // ─── Fix toggle handlers ──────────────────────────────────────────────────
  const handleToggle = (fixId) => {
    setEnabledFixIds(prev => {
      const next = new Set(prev);
      if (next.has(fixId)) next.delete(fixId);
      else next.add(fixId);
      return next;
    });
  };

  const handleApplyAll = () => {
    setEnabledFixIds(new Set(fixes.map(f => f.id)));
  };

  const handleReset = () => {
    setEnabledFixIds(new Set());
  };

  // ─── Re-test handler ─────────────────────────────────────────────────────
  const handleRetest = async () => {
    if (enabledFixIds.size === 0) {
      setRetestError('Enable at least one fix before re-testing.');
      return;
    }
    setRetesting(true);
    setRetestError(null);
    const result = await retestWithFixes(runId, { enabledFixIds: [...enabledFixIds] });
    setRetesting(false);
    if (result?.childRunId) {
      setRetestRunId(result.childRunId);
      setChildRunId(result.childRunId);
      setShowRetestPanel(true);
    } else {
      setRetestError('Failed to start re-test. Please try again.');
    }
  };

  // ─── Export handler ───────────────────────────────────────────────────────
  const handleExport = async () => {
    const url = await exportFixes(runId);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `fix-report-${runId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="h-10 bg-[#EAE8E3] dark:bg-[#22222A] rounded-2xl w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <div className="h-80 bg-[#EAE8E3] dark:bg-[#22222A] rounded-2xl" />
          <div className="h-80 bg-[#EAE8E3] dark:bg-[#22222A] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!fixes.length && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-5xl">🎉</div>
        <p className="text-lg font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">No fixes needed</p>
        <p className="text-sm text-[#6B6B70] dark:text-[#98989F] max-w-sm">
          No significant UX issues were detected in this run. Try running more personas or a different page.
        </p>
      </div>
    );
  }

  // Severity summary counts
  const counts = fixes.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {});

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-heading font-bold text-lg text-[#1C1C1E] dark:text-[#F2F2F7] truncate">
              Fix Preview
            </h2>
            <span className="text-[10px] bg-[#6C63FF]/10 text-[#6C63FF] px-2 py-0.5 rounded-full font-semibold">
              Simulated preview
            </span>
          </div>
          {/* Severity badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {counts.critical > 0 && (
              <span className="text-xs px-2 py-0.5 bg-[#F08A7E]/10 text-[#F08A7E] rounded-full font-medium">
                {counts.critical} critical
              </span>
            )}
            {counts.high > 0 && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full font-medium">
                {counts.high} high
              </span>
            )}
            {counts.medium > 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                {counts.medium} medium
              </span>
            )}
            {counts.low > 0 && (
              <span className="text-xs px-2 py-0.5 bg-[#8FB8A8]/10 text-[#8FB8A8] rounded-full font-medium">
                {counts.low} low
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/30 transition-all"
          >
            <Download size={13} /> Export report
          </button>
          <button
            onClick={handleRetest}
            disabled={retesting || enabledFixIds.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#6C63FF] text-white hover:bg-[#5a52e0] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {retesting
              ? <><RefreshCw size={13} className="animate-spin" /> Testing…</>
              : <><Play size={13} /> Re-test with these fixes</>
            }
          </button>
        </div>
      </div>

      {/* ── Page selector ──────────────────────────────────────────────────── */}
      {pages.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mr-1">Page:</span>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setActivePage(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${activePage === p
                  ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow'
                  : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/30'}`}
            >
              {p === '/' ? 'Home' : p}
            </button>
          ))}
        </div>
      )}

      {/* ── View mode controls ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSideBySide(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${!sideBySide ? 'bg-[#1C1C1E] dark:bg-[#F2F2F7] text-white dark:text-[#1C1C1E] border-transparent' : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F]'}`}
        >
          <Layers size={12} /> Slider
        </button>
        <button
          onClick={() => setSideBySide(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${sideBySide ? 'bg-[#1C1C1E] dark:bg-[#F2F2F7] text-white dark:text-[#1C1C1E] border-transparent' : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F]'}`}
        >
          <Columns size={12} /> Side by side
        </button>
        <button
          onClick={() => setShowChangesOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${showChangesOnly ? 'bg-[#6C63FF] text-white border-[#6C63FF]' : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F]'}`}
        >
          {showChangesOnly ? <Eye size={12} /> : <EyeOff size={12} />}
          Show changes only
        </button>
      </div>

      {/* ── Main 2-col layout: slider + fix list ──────────────────────────── */}
      <div className={`grid gap-5 ${sideBySide ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[1fr_380px]'}`}>

        {/* Left: Before/After viewer */}
        <div className="flex flex-col gap-3">
          <Card className="p-0 overflow-hidden">
            <BeforeAfterSlider
              beforeUrl={previewResult?.beforeUrl || runReport?.screens?.[0]?.screenshot}
              afterUrl={previewResult?.afterUrl || runReport?.screens?.[0]?.screenshot}
              bboxes={previewResult?.bboxes || []}
              activeFixId={activeFixId}
              onPinClick={(fixId) => setActiveFixId(prev => prev === fixId ? null : fixId)}
              loading={previewLoading}
              showChangesOnly={showChangesOnly}
              sideBySide={sideBySide}
            />
          </Card>

          {/* Infeasibility notice */}
          {previewResult?.feasible === false && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Preview not available for this page:</strong> {previewResult.reason}
                {' '}The code suggestions still apply.
              </p>
            </div>
          )}

          {/* Retest error */}
          {retestError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-[#F08A7E]/10 border border-[#F08A7E]/20 rounded-xl">
              <AlertTriangle size={14} className="text-[#F08A7E] flex-shrink-0" />
              <p className="text-xs text-[#F08A7E]">{retestError}</p>
            </div>
          )}

          {/* Retest panel (inline on large, below on mobile) */}
          <AnimatePresence>
            {showRetestPanel && (
              <RetestPanel
                childRunId={retestRunId}
                parentRunId={runId}
                enabledFixIds={[...enabledFixIds]}
                onClose={() => setShowRetestPanel(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Right: Fix list panel */}
        {!sideBySide && (
          <div className="overflow-y-auto max-h-[700px] pr-1 scrollbar-thin">
            <FixList
              fixes={fixes}
              enabledFixIds={enabledFixIds}
              onToggle={handleToggle}
              onApplyAll={handleApplyAll}
              onReset={handleReset}
              activeFixId={activeFixId}
              onHover={setActiveFixId}
              sessions={sessions}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Fix list below in side-by-side mode */}
      {sideBySide && (
        <FixList
          fixes={fixes}
          enabledFixIds={enabledFixIds}
          onToggle={handleToggle}
          onApplyAll={handleApplyAll}
          onReset={handleReset}
          activeFixId={activeFixId}
          onHover={setActiveFixId}
          sessions={sessions}
          loading={loading}
        />
      )}
    </div>
  );
};

export default FixPreviewTab;
