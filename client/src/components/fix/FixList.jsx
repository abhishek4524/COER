import React from 'react';
import { AnimatePresence } from 'framer-motion';
import FixCard from './FixCard';
import { CheckSquare, Square } from 'lucide-react';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABELS = { critical: '🔴 Critical', high: '🟠 High', medium: '🔵 Medium', low: '🟢 Low' };

/**
 * FixList — grouped fix list panel (right side panel).
 *
 * Props:
 *   fixes          — all fix objects
 *   enabledFixIds  — Set of enabled fix ids
 *   onToggle       — (fixId) => void
 *   onApplyAll     — () => void
 *   onReset        — () => void
 *   activeFixId    — currently highlighted fix (from pin hover)
 *   onHover        — (fixId | null) => void
 *   sessions       — session array for persona portraits
 *   loading        — bool
 */
const FixList = ({
  fixes = [],
  enabledFixIds = new Set(),
  onToggle,
  onApplyAll,
  onReset,
  activeFixId,
  onHover,
  sessions = [],
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-[#EAE8E3] dark:bg-[#22222A] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!fixes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="text-4xl">🎉</div>
        <p className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">No issues found</p>
        <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
          This run had no detectable UX problems.
        </p>
      </div>
    );
  }

  // Group by severity
  const grouped = {};
  for (const fix of fixes) {
    const s = fix.severity || 'medium';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(fix);
  }

  // Build pin index map (global across all severities)
  const allFixes = SEVERITY_ORDER.flatMap(s => grouped[s] || []);
  const pinMap = {};
  allFixes.forEach((f, i) => { pinMap[f.id] = i + 1; });

  const totalEnabled = [...enabledFixIds].filter(id => fixes.some(f => f.id === id)).length;
  const allEnabled = fixes.every(f => enabledFixIds.has(f.id));

  return (
    <div className="flex flex-col gap-4">
      {/* Apply all / Reset controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onApplyAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border
            ${allEnabled
              ? 'bg-[#6C63FF] text-white border-[#6C63FF]'
              : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/40'}`}
        >
          <CheckSquare size={12} />
          Apply all ({fixes.length})
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B] text-[#6B6B70] dark:text-[#98989F] hover:border-[#F08A7E]/40 transition-all"
        >
          <Square size={12} />
          Reset
        </button>
        <span className="ml-auto text-xs text-[#6B6B70] dark:text-[#98989F]">
          {totalEnabled}/{fixes.length} enabled
        </span>
      </div>

      {/* Grouped sections */}
      {SEVERITY_ORDER.map(severity => {
        const group = grouped[severity];
        if (!group?.length) return null;
        return (
          <div key={severity}>
            <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-2 tracking-wide uppercase">
              {SEVERITY_LABELS[severity]}
            </p>
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {group.map(fix => (
                  <FixCard
                    key={fix.id}
                    fix={fix}
                    enabled={enabledFixIds.has(fix.id)}
                    onToggle={() => onToggle(fix.id)}
                    active={fix.id === activeFixId}
                    onHover={onHover}
                    sessions={sessions}
                    pinIndex={pinMap[fix.id]}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FixList;
