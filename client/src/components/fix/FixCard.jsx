import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Zap, MessageSquare, ChevronDown, Copy, Check, Clock, TrendingUp } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    bg: 'bg-[#F08A7E]/10 dark:bg-[#F08A7E]/15',
    border: 'border-[#F08A7E]/30',
    text: 'text-[#F08A7E]',
    icon: AlertTriangle,
    dot: '#F08A7E',
  },
  high: {
    label: 'High',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800/30',
    text: 'text-amber-600 dark:text-amber-400',
    icon: Zap,
    dot: '#F59E0B',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-200 dark:border-blue-800/30',
    text: 'text-blue-600 dark:text-blue-400',
    icon: MessageSquare,
    dot: '#3B82F6',
  },
  low: {
    label: 'Low',
    bg: 'bg-[#8FB8A8]/10 dark:bg-[#8FB8A8]/15',
    border: 'border-[#8FB8A8]/30',
    text: 'text-[#8FB8A8]',
    icon: MessageSquare,
    dot: '#8FB8A8',
  },
};

const EFFORT_LABEL = { low: '~15 min', med: '~2 hrs', high: '~1 day' };

/**
 * FixCard — individual fix with checkbox, evidence, code snippet, copy button.
 *
 * Props:
 *   fix          — fix object
 *   enabled      — boolean (checkbox state)
 *   onToggle     — () => void
 *   active       — boolean (highlighted from pin click)
 *   onHover      — (fixId | null) => void
 *   sessions     — session array (for persona portrait strip)
 *   pinIndex     — number (shown on the pin badge)
 */
const FixCard = ({ fix, enabled, onToggle, active, onHover, sessions = [], pinIndex }) => {
  const [copied, setCopied] = React.useState(false);
  const cfg = SEVERITY_CONFIG[fix.severity] || SEVERITY_CONFIG.medium;
  const Icon = cfg.icon;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fix.codeSnippet || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Select up to 4 persona avatars from affected sessions
  const personaPortraits = sessions.slice(0, fix.evidence?.personasAffected || 0).slice(0, 4).map((s, i) => ({
    avatar: s.persona?.avatar || `/assets/personas/default.png`,
    name: s.persona?.name || 'Tester',
  }));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer
        ${cfg.bg} ${cfg.border}
        ${active ? 'ring-2 ring-[#6C63FF]/50 shadow-md' : ''}
        ${!enabled ? 'opacity-50' : ''}
      `}
      onMouseEnter={() => onHover?.(fix.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={onToggle}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all
            ${enabled ? 'bg-[#6C63FF] border-[#6C63FF]' : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F]'}`}
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
        >
          {enabled && <Check size={10} className="text-white" strokeWidth={3} />}
        </div>

        {/* Pin badge */}
        {pinIndex != null && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#6C63FF] flex items-center justify-center text-[9px] font-bold text-white mt-0.5">
            {pinIndex}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.text} bg-white/60 dark:bg-white/5`}>
              <Icon size={9} /> {cfg.label}
            </span>
            <span className="text-[10px] text-[#6B6B70] dark:text-[#98989F]">
              {fix.pagePath}
            </span>
            {fix.source === 'llm' && (
              <span className="text-[9px] text-[#6C63FF] bg-[#6C63FF]/10 px-1.5 py-0.5 rounded-full font-medium">AI</span>
            )}
          </div>
          <p className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] leading-snug mb-1">
            {fix.title}
          </p>
          <p className="text-xs text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
            {fix.problem}
          </p>
        </div>
      </div>

      {/* Evidence row */}
      <div className="mt-3 ml-7 flex items-center gap-3 flex-wrap">
        {/* Persona portraits */}
        {personaPortraits.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1.5">
              {personaPortraits.map((p, i) => (
                <img
                  key={i}
                  src={p.avatar}
                  alt={p.name}
                  title={p.name}
                  className="w-5 h-5 rounded-full border border-white dark:border-[#17171B] object-cover"
                />
              ))}
            </div>
            <span className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">
              {fix.evidence?.personasAffected || '?'} personas affected
            </span>
          </div>
        )}

        {/* Metric */}
        <span className="text-[10px] text-[#6B6B70] dark:text-[#98989F] bg-white/50 dark:bg-white/5 px-2 py-0.5 rounded-full truncate max-w-[160px]" title={fix.evidence?.metric}>
          {fix.evidence?.metric}
        </span>
      </div>

      {/* Impact + Effort row */}
      <div className="mt-2 ml-7 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-[11px] text-[#8FB8A8]">
          <TrendingUp size={11} />
          <span className="truncate max-w-[180px]">{fix.expectedImpact}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#6B6B70] dark:text-[#98989F]">
          <Clock size={11} />
          <span>{EFFORT_LABEL[fix.effort] || fix.effort}</span>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] text-[#6B6B70] dark:text-[#98989F]">
          <span>{Math.round((fix.confidence || 0) * 100)}% confidence</span>
        </div>
      </div>

      {/* Code snippet (collapsed but copyable) */}
      {fix.codeSnippet && (
        <div className="mt-3 ml-7">
          <div className="relative rounded-lg overflow-hidden">
            <pre className="text-[10px] font-mono bg-[#1C1C1E] dark:bg-[#0F0F12] text-[#8FB8A8] p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-20 overflow-y-auto">
              {fix.codeSnippet}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-1.5 right-1.5 p-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-all"
              title="Copy code"
            >
              {copied ? <Check size={11} className="text-[#8FB8A8]" /> : <Copy size={11} />}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FixCard;
