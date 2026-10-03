import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, CheckCircle2, XCircle, ArrowRight, Sparkles,
  Shield, AlertTriangle, RefreshCw, ExternalLink, Maximize2,
  Grid2x2, Pin, PinOff, Pause, Play, Eye, EyeOff, Zap, Wifi, WifiOff,
} from 'lucide-react';
import GlassPanel from '../components/ui/GlassPanel';
import Badge from '../components/ui/Badge';
import SmartImage from '../components/ui/SmartImage';
import { createLiveSource } from '../services/liveSource';
import { allSessions } from '../mock/sessions';
import { getRuns } from '../services/api';

const isMockEnv = import.meta.env.VITE_USE_MOCK === 'true';

const PERSONA_COLORS = [
  '#6C63FF', '#F08A7E', '#8FB8A8', '#F59E0B',
  '#3B82F6', '#EC4899', '#10B981', '#F97316',
];

const EXPRESSION_EMOJI = {
  neutral: '😐', focused: '🎯', happy: '😊', satisfied: '😌',
  confused: '😕', frustrated: '😤', angry: '😠', gave_up: '😞',
  blocked: '🚫', distracted: '😵', stuck: '🤔',
};

// ─── prefers-reduced-motion ──────────────────────────────────────────────────
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Expression tag ──────────────────────────────────────────────────────────
const ExpressionTag = ({ expression, frustration }) => {
  const emoji = EXPRESSION_EMOJI[expression] || '😐';
  const color = frustration > 75 ? 'bg-[#F08A7E]/20 text-[#F08A7E]'
    : frustration > 45 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-[#8FB8A8]/20 text-[#8FB8A8]';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {emoji} {expression}
    </span>
  );
};

// ─── Frustration bar ─────────────────────────────────────────────────────────
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

// ─── Overlay canvas (cursor + ripple + bbox highlight) ───────────────────────
const OverlayCanvas = React.memo(({ canvasRef, overlayRef }) => (
  <canvas
    ref={canvasRef}
    className="absolute inset-0 w-full h-full pointer-events-none z-20"
    style={{ mixBlendMode: 'normal' }}
  />
));

// ─── Typing bubble ───────────────────────────────────────────────────────────
const TypingBubble = ({ text, x, y, color }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ duration: 0.15 }}
    className="absolute z-30 pointer-events-none"
    style={{ left: x + 16, top: y - 30 }}
  >
    <div
      className="px-2 py-1 rounded-lg text-[10px] text-white font-semibold shadow-lg"
      style={{ backgroundColor: color || '#6C63FF' }}
    >
      ✏️ typing: "{text}"
    </div>
  </motion.div>
);

// ─── Speech bubble (thought) ─────────────────────────────────────────────────
const SpeechBubble = ({ thought, emotion, x, y, color, name }) => {
  const emoji = EXPRESSION_EMOJI[emotion] || '💭';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="absolute z-30 pointer-events-none max-w-[200px]"
      style={{ left: Math.max(8, x + 20), top: Math.max(8, y - 60) }}
    >
      <div
        className="px-2.5 py-1.5 rounded-xl text-[10px] text-white shadow-lg leading-relaxed"
        style={{ backgroundColor: color || '#1C1C1E', border: `1px solid ${color || '#6C63FF'}55` }}
      >
        {emoji} <span className="font-semibold opacity-75">{name?.split(' ')[0]}:</span> {thought}
      </div>
    </motion.div>
  );
};

// ─── Mini timeline step marker ────────────────────────────────────────────────
const StepMarker = ({ step, isActive, onClick }) => {
  const color = step.isDeadClick ? '#F08A7E'
    : step.action === 'goal_complete' ? '#8FB8A8'
    : step.action === 'give_up' ? '#F08A7E'
    : step.action === 'failed_action' ? '#F59E0B'
    : '#6C63FF';
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all ${
        isActive ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
      }`}
      style={{ backgroundColor: color }}
      title={`Step ${step.stepIndex}: ${step.action} — ${step.thought?.slice(0, 60)}`}
    />
  );
};

// ─── Persona Tile ─────────────────────────────────────────────────────────────
const PersonaTile = React.memo(({ state, isWatched, isActive, onClick, thumbFrame }) => {
  const imgRef = useRef(null);

  useEffect(() => {
    if (!thumbFrame || !imgRef.current) return;
    imgRef.current.src = `data:image/jpeg;base64,${thumbFrame}`;
  }, [thumbFrame]);

  const ringColor = isWatched ? '#6C63FF' : isActive ? '#8FB8A8' : 'transparent';

  return (
    <motion.button
      layout
      onClick={onClick}
      className={`rounded-xl p-2 border transition-all text-left w-full cursor-pointer ${
        isWatched
          ? 'border-[#6C63FF] bg-[#6C63FF]/5 dark:bg-[#6C63FF]/10'
          : state.isComplete
          ? 'border-[#8FB8A8]/40 bg-[#8FB8A8]/5 dark:bg-[#8FB8A8]/10'
          : 'border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#1E1E24] hover:border-[#6C63FF]/40'
      }`}
      style={{ outline: isWatched ? `2px solid ${ringColor}` : 'none', outlineOffset: '1px' }}
    >
      {/* Thumbnail or avatar */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-1.5 bg-[#F7F6F3] dark:bg-[#0F0F12]">
        {thumbFrame ? (
          <img
            ref={imgRef}
            className="w-full h-full object-cover object-top"
            alt={`${state.persona?.name} preview`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <SmartImage
              src={state.persona?.avatar}
              fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${state.personaId}`}
              alt={state.persona?.name || 'Tester'}
              className="w-10 h-10 rounded-full object-cover"
            />
          </div>
        )}
        {/* Status overlay */}
        {state.isComplete && (
          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 text-lg ${
            state.status === 'converted' ? 'text-[#8FB8A8]' : 'text-[#F08A7E]'
          }`}>
            {state.status === 'converted' ? '✓' : '✗'}
          </div>
        )}
        {isWatched && !state.isComplete && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Live watching" />
        )}
        {/* Emotion badge */}
        <div className="absolute bottom-1 left-1">
          <span className="text-base leading-none">{EXPRESSION_EMOJI[state.expression] || '😐'}</span>
        </div>
      </div>

      {/* Name + expression */}
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate leading-tight flex-1">
          {(state.persona?.name || 'Tester').split(' ')[0]}
        </p>
        {isWatched && <Eye className="w-3 h-3 text-[#6C63FF] shrink-0" />}
      </div>
      <p className="text-[9px] text-[#6B6B70] dark:text-[#98989F] truncate mb-1">{state.action}</p>
      <FrustrationBar value={state.frustration} />
    </motion.button>
  );
});

// ─── Focus Viewer ─────────────────────────────────────────────────────────────
const FocusViewer = ({
  sessionId, sessionState, fullFrame, lastThumb,
  currentUrl, overlayData, steps, paused, onPauseToggle,
  onStepClick, activeStepIndex, viewerRef,
}) => {
  const canvasRef = useRef(null);
  const frameImgRef = useRef(null);
  const overlayRef = useRef({ cursors: {}, ripples: [], highlights: [], rageZones: [], typingBubble: null, speechBubble: null });
  const animRef = useRef(null);
  const reduced = prefersReducedMotion();

  // Track cursor trail positions per persona
  const trailRef = useRef({});

  // ── Render overlay on canvas ──
  const renderOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const imgEl = frameImgRef.current;
    if (!canvas || !imgEl) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);

    const ov = overlayRef.current;

    // Scale from viewport coords to displayed canvas coords
    const vpW = overlayData?.viewport?.w || overlayData?.viewport?.width || 1440;
    const vpH = overlayData?.viewport?.h || overlayData?.viewport?.height || 900;
    const scaleX = cw / vpW;
    const scaleY = ch / vpH;

    // Draw highlight boxes
    const now = Date.now();
    ov.highlights = ov.highlights.filter(h => now - h.ts < 600);
    for (const h of ov.highlights) {
      if (!h.bbox) continue;
      const alpha = Math.max(0, 1 - (now - h.ts) / 600);
      ctx.save();
      ctx.strokeStyle = `rgba(108, 99, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        h.bbox.x * scaleX, h.bbox.y * scaleY,
        h.bbox.w * scaleX, h.bbox.h * scaleY
      );
      ctx.restore();
    }

    // Draw cursor trails + cursor (per persona watching)
    for (const [pid, cur] of Object.entries(ov.cursors)) {
      const cx = (cur.x || 0) * scaleX;
      const cy = (cur.y || 0) * scaleY;
      const color = cur.color || '#6C63FF';

      // Trail
      if (!reduced) {
        const trail = trailRef.current[pid] || [];
        if (trail.length > 1) {
          ctx.save();
          ctx.strokeStyle = color + '55';
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(trail[0].x * scaleX, trail[0].y * scaleY);
          for (let i = 1; i < trail.length; i++) {
            const alpha = i / trail.length;
            ctx.globalAlpha = alpha * 0.4;
            ctx.lineTo(trail[i].x * scaleX, trail[i].y * scaleY);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Cursor arrow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 12, cy + 16);
      ctx.lineTo(cx + 7, cy + 13);
      ctx.lineTo(cx + 5, cy + 20);
      ctx.lineTo(cx + 3, cy + 19);
      ctx.lineTo(cx + 5, cy + 12);
      ctx.lineTo(cx, cy + 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Name tag
      ctx.save();
      const label = (cur.name || 'Tester').split(' ')[0];
      ctx.font = '10px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const px = 6, py = 3;
      ctx.fillStyle = color;
      roundRect(ctx, cx + 14, cy - 2, tw + px * 2, 16 + py, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, cx + 14 + px, cy + 10);
      ctx.restore();
    }

    // Draw click ripples
    ov.ripples = ov.ripples.filter(r => now - r.ts < 700);
    for (const r of ov.ripples) {
      const age = now - r.ts;
      const progress = age / 700;
      const radius = progress * (r.dead ? 30 : 20);
      const alpha = 1 - progress;
      ctx.save();
      ctx.strokeStyle = r.dead || r.rage
        ? `rgba(240, 138, 126, ${alpha})`
        : `rgba(108, 99, 255, ${alpha})`;
      ctx.lineWidth = r.rage ? 3 : 2;
      ctx.beginPath();
      ctx.arc(r.x * scaleX, r.y * scaleY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    animRef.current = requestAnimationFrame(renderOverlay);
  }, [overlayData, reduced]);

  // Helper: roundRect
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Update overlay data
  useEffect(() => {
    if (!overlayData) return;
    const ov = overlayRef.current;

    if (overlayData.type === 'actionPlanned') {
      const { sessionId: sid, point, bbox, type, color, personaName, text } = overlayData;
      if (point) {
        // Update cursor
        ov.cursors[sid] = { x: point.x, y: point.y, color, name: personaName };
        // Update trail
        if (!trailRef.current[sid]) trailRef.current[sid] = [];
        trailRef.current[sid].push({ x: point.x, y: point.y });
        if (trailRef.current[sid].length > 8) trailRef.current[sid].shift();
      }
      if (bbox) {
        ov.highlights.push({ bbox, ts: Date.now() });
      }
    }

    if (overlayData.type === 'actionResult') {
      const { sessionId: sid, dead, isRageClick } = overlayData;
      const cur = ov.cursors[sid];
      if (cur) {
        ov.ripples.push({ x: cur.x, y: cur.y, ts: Date.now(), dead, rage: isRageClick });
      }
    }
  }, [overlayData]);

  // Start/stop canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    animRef.current = requestAnimationFrame(renderOverlay);
    return () => {
      ro.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [renderOverlay]);

  // Update frame image
  useEffect(() => {
    const frame = fullFrame || lastThumb;
    if (!frame || !frameImgRef.current) return;
    frameImgRef.current.src = `data:image/jpeg;base64,${frame}`;
  }, [fullFrame, lastThumb]);

  const persona = sessionState?.persona;
  const isComplete = sessionState?.isComplete;
  const outcome = sessionState?.status;

  return (
    <div className="flex flex-col h-full" ref={viewerRef}>
      {/* Frame + overlay */}
      <div className="relative flex-1 overflow-hidden bg-[#F7F6F3] dark:bg-[#0F0F12] flex items-center justify-center min-h-[320px]">
        {/* Frame image */}
        <img
          ref={frameImgRef}
          className="w-full h-full object-contain object-top"
          alt="Live simulation viewport"
          src="/assets/hero-scene.png"
        />

        {/* Paused overlay */}
        {paused && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-40">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-3 text-white font-semibold text-sm">
              ⏸ Paused (client display only)
            </div>
          </div>
        )}

        {/* Session complete overlay */}
        {isComplete && (
          <div className={`absolute inset-0 flex flex-col items-center justify-end pb-8 z-30 pointer-events-none
            ${outcome === 'converted' ? 'bg-[#8FB8A8]/20' : 'bg-[#F08A7E]/20'}`}>
            <div className={`px-4 py-2 rounded-2xl font-bold text-sm text-white shadow-lg
              ${outcome === 'converted' ? 'bg-[#8FB8A8]' : 'bg-[#F08A7E]'}`}>
              {outcome === 'converted' ? '✓ Completed Goal' : '✗ Gave Up'}
            </div>
          </div>
        )}

        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        />

        {/* No session selected */}
        {!sessionId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <Eye className="w-12 h-12 text-[#6B6B70] dark:text-[#98989F] opacity-40" />
            <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">Click a persona tile to watch live</p>
          </div>
        )}

        {/* Pause button */}
        <button
          onClick={onPauseToggle}
          className="absolute bottom-3 right-3 z-40 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          title={paused ? 'Resume' : 'Pause display'}
        >
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      {/* Mini timeline */}
      {steps && steps.length > 0 && (
        <div className="px-3 py-2 border-t border-[#ECEAE5] dark:border-[#26262F] flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[9px] text-[#6B6B70] dark:text-[#98989F] shrink-0 mr-1">STEPS</span>
          {steps.map((step, i) => (
            <StepMarker
              key={i}
              step={step}
              isActive={i === activeStepIndex}
              onClick={() => onStepClick(step, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Grid View (2x2) ─────────────────────────────────────────────────────────
const GridView = ({ sessions, watchedIds, fullFrames, thumbFrames, overlayData, onWatch, maxWatchers = 4 }) => {
  const gridSessions = sessions.slice(0, 4);
  return (
    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
      {gridSessions.map((state) => {
        const sid = state.personaId;
        const isWatched = watchedIds.has(sid);
        return (
          <div
            key={sid}
            className={`rounded-xl overflow-hidden border flex flex-col cursor-pointer relative ${
              isWatched
                ? 'border-[#6C63FF]'
                : 'border-[#ECEAE5] dark:border-[#26262F]'
            }`}
            onClick={() => onWatch(sid, !isWatched)}
          >
            {/* Frame */}
            <div className="relative flex-1 bg-[#F7F6F3] dark:bg-[#0F0F12] min-h-[120px]">
              {(fullFrames[sid] || thumbFrames[sid]) ? (
                <img
                  src={`data:image/jpeg;base64,${fullFrames[sid] || thumbFrames[sid]}`}
                  className="w-full h-full object-cover object-top"
                  alt={state.persona?.name}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <SmartImage
                    src={state.persona?.avatar}
                    fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${sid}`}
                    alt={state.persona?.name}
                    className="w-8 h-8 rounded-full"
                  />
                </div>
              )}
              {isWatched && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <div className="absolute bottom-1 left-1 text-xs">{EXPRESSION_EMOJI[state.expression] || '😐'}</div>
            </div>
            {/* Label */}
            <div className="px-2 py-1 bg-white dark:bg-[#17171B] border-t border-[#ECEAE5] dark:border-[#26262F]">
              <p className="text-[10px] font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate">
                {(state.persona?.name || 'Tester').split(' ')[0]}
              </p>
              <FrustrationBar value={state.frustration} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main LiveSimulationPage ──────────────────────────────────────────────────
export const LiveSimulationPage = () => {
  const navigate = useNavigate();
  const { runId: paramRunId } = useParams();
  const [searchParams] = useSearchParams();
  const queryRunId = searchParams.get('runId');
  const activeRunId = paramRunId || queryRunId;

  const [runId, setRunId] = useState(activeRunId || '');
  const [runDoc, setRunDoc] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const isMockMode = isMockEnv && (!runId || runId.startsWith('mock-'));

  // Persona states (keyed by sessionId)
  const [personaStates, setPersonaStates] = useState(() => {
    if (isMockMode) {
      return allSessions.reduce((acc, s) => {
        acc[s.personaId] = {
          personaId: s.personaId,
          persona: s.persona,
          expression: 'neutral', frustration: 10,
          action: 'Starting…', isComplete: false, status: 'active',
        };
        return acc;
      }, {});
    }
    return {};
  });

  // Live preview state
  const [watchedSessionId, setWatchedSessionId] = useState(null);       // primary focus
  const [watchedGrid, setWatchedGrid] = useState(new Set());             // grid mode watchers
  const [thumbFrames, setThumbFrames] = useState({});                    // sessionId -> base64
  const [fullFrames, setFullFrames] = useState({});                      // sessionId -> base64
  const [sessionSteps, setSessionSteps] = useState({});                  // sessionId -> Step[]
  const [overlayEvent, setOverlayEvent] = useState(null);                // latest overlay event
  const [activeStepIndex, setActiveStepIndex] = useState(null);
  const [stepPopup, setStepPopup] = useState(null);

  // UI state
  const [followActive, setFollowActive] = useState(true);               // auto-switch to active persona
  const [pinned, setPinned] = useState(false);                           // pin focus viewer
  const [gridMode, setGridMode] = useState(false);                       // 2x2 grid
  const [paused, setPaused] = useState(false);                           // client pause
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality, setQuality] = useState('medium');                      // low/medium/high
  const [connected, setConnected] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // Thoughts + counters
  const [thoughts, setThoughts] = useState([]);
  const thoughtsRef = useRef([]);
  const [counters, setCounters] = useState({ active: isMockMode ? 50 : 0, completed: 0, abandoned: 0 });
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [runFinished, setRunFinished] = useState(false);
  const [siteUnreachable, setSiteUnreachable] = useState(false);

  const sourceRef = useRef(null);
  const viewerRef = useRef(null);
  const colorMapRef = useRef({});      // sessionId -> color
  const bufferingTimerRef = useRef(null);

  // Assign colors to sessions
  const getPersonaColor = useCallback((sessionId) => {
    if (!colorMapRef.current[sessionId]) {
      const idx = Object.keys(colorMapRef.current).length % PERSONA_COLORS.length;
      colorMapRef.current[sessionId] = PERSONA_COLORS[idx];
    }
    return colorMapRef.current[sessionId];
  }, []);

  // ── Resolve runId ──
  useEffect(() => {
    if (!activeRunId && !isMockMode) {
      getRuns().then((runs) => {
        if (runs?.length > 0) setRunId(runs[0].id || runs[0]._id);
      });
    } else if (activeRunId) {
      setRunId(activeRunId);
    }
  }, [activeRunId, isMockMode]);

  // ── Fetch run details + existing sessions ──
  const fetchRunDetails = async (id) => {
    if (!id || id.startsWith('mock-')) return;
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`/api/runs/${id}`, { credentials: 'include' }),
        fetch(`/api/runs/${id}/sessions`, { credentials: 'include' }),
      ]);
      if (rRes.ok) {
        const json = await rRes.json();
        if (json.success && json.data) {
          const r = json.data;
          setRunDoc(r);
          setCurrentUrl(r.url || '');
          setCounters(prev => ({ ...prev, active: prev.active || r.personaCount || 0 }));
          if (r.status === 'failed') {
            setRunFinished(true);
            if (r.summary?.errorMessage?.includes('unreachable')) setSiteUnreachable(true);
          } else if (r.status === 'completed') {
            setRunFinished(true);
            setProgress(100);
          }
        }
      }
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (sJson.success && Array.isArray(sJson.data)) {
          const states = {};
          let completed = 0, abandoned = 0;
          sJson.data.forEach(s => {
            const isDone = ['completed', 'gave_up', 'failed'].includes(s.outcome);
            if (s.outcome === 'completed') completed++;
            if (s.outcome === 'gave_up' || s.outcome === 'failed') abandoned++;
            states[s._id] = {
              personaId: s._id,
              persona: {
                name: s.personaSnapshot?.name || 'Tester',
                avatar: s.personaSnapshot?.avatar || '/assets/personas/default.png',
                color: getPersonaColor(s._id),
                status: s.outcome === 'completed' ? 'converted' : s.outcome === 'gave_up' ? 'abandoned' : 'active',
              },
              expression: isDone ? (s.outcome === 'completed' ? 'happy' : 'frustrated') : 'neutral',
              frustration: s.frustrationScore || 0,
              action: isDone ? (s.outcome === 'completed' ? 'Completed Goal ✓' : 'Gave Up ✗') : 'Testing…',
              isComplete: isDone,
              status: s.outcome === 'completed' ? 'converted' : s.outcome === 'gave_up' ? 'abandoned' : 'active',
            };
          });
          if (Object.keys(states).length > 0) {
            setPersonaStates(states);
            const total = sJson.data.length;
            setCounters({ active: Math.max(0, total - completed - abandoned), completed, abandoned });
            if (total > 0) setProgress(Math.round(((completed + abandoned) / total) * 100));
          }
        }
      }
    } catch (err) {
      console.warn('[LiveSim] fetchRunDetails error:', err.message);
    }
  };

  useEffect(() => { if (runId) fetchRunDetails(runId); }, [runId]);

  // ── Fetch steps for a session ──
  const fetchSessionSteps = async (sid) => {
    if (!sid || isMockMode) return;
    try {
      const res = await fetch(`/api/sessions/${sid}/steps`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSessionSteps(prev => ({ ...prev, [sid]: json.data }));
        }
      }
    } catch {}
  };

  // ── Watch a session (subscribe to full stream) ──
  const watchSession = useCallback((sessionId) => {
    if (!sessionId) return;
    const src = sourceRef.current;
    if (src?.watchSession) src.watchSession(sessionId);
    setWatchedSessionId(sessionId);
    fetchSessionSteps(sessionId);
    // Buffer indicator: reset if we get a frame within 2s
    setBuffering(true);
    bufferingTimerRef.current = setTimeout(() => setBuffering(false), 3000);
  }, []);

  const unwatchSession = useCallback((sessionId) => {
    if (!sessionId) return;
    const src = sourceRef.current;
    if (src?.unwatchSession) src.unwatchSession(sessionId);
  }, []);

  const toggleGridWatch = useCallback((sessionId, shouldWatch) => {
    setWatchedGrid(prev => {
      const next = new Set(prev);
      if (shouldWatch && next.size < 4) {
        next.add(sessionId);
        sourceRef.current?.watchSession(sessionId);
      } else {
        next.delete(sessionId);
        sourceRef.current?.unwatchSession(sessionId);
      }
      return next;
    });
  }, []);

  // ── Handle tile click ──
  const handleTileClick = useCallback((sessionId) => {
    if (gridMode) {
      const isWatching = watchedGrid.has(sessionId);
      toggleGridWatch(sessionId, !isWatching);
    } else {
      if (watchedSessionId && watchedSessionId !== sessionId) {
        unwatchSession(watchedSessionId);
      }
      if (!pinned) {
        watchSession(sessionId);
      } else if (!watchedSessionId) {
        watchSession(sessionId);
      }
    }
  }, [gridMode, watchedSessionId, watchedGrid, pinned, watchSession, unwatchSession, toggleGridWatch]);

  // ── Page visibility: unwatch on hide, re-watch on show ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (watchedSessionId) sourceRef.current?.unwatchSession(watchedSessionId);
        for (const sid of watchedGrid) sourceRef.current?.unwatchSession(sid);
      } else {
        if (watchedSessionId) {
          sourceRef.current?.watchSession(watchedSessionId);
        }
        for (const sid of watchedGrid) {
          sourceRef.current?.watchSession(sid);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [watchedSessionId, watchedGrid]);

  // ── Connect live socket ──
  useEffect(() => {
    if (!runId && !isMockMode) return;

    const source = createLiveSource(runId);
    sourceRef.current = source;

    source.on('connected', () => setConnected(true));
    source.on('reconnected', () => {
      setConnected(true);
      // Resubscribe watched sessions
      if (watchedSessionId) source.watchSession(watchedSessionId);
      for (const sid of watchedGrid) source.watchSession(sid);
    });
    source.on('error', () => setConnected(false));

    source.on('runStarted', (data) => {
      if (data.personaCount) setCounters(prev => ({ ...prev, active: data.personaCount }));
    });

    source.on('personaUpdate', (data) => {
      const sid = data.sessionId || data.personaId;
      getPersonaColor(sid);
      setPersonaStates(prev => {
        const existing = prev[sid] || {};
        return {
          ...prev,
          [sid]: {
            ...existing,
            personaId: sid,
            persona: data.persona
              ? { ...data.persona, color: data.persona.color || getPersonaColor(sid) }
              : existing.persona || { name: 'Tester', avatar: '/assets/personas/default.png', color: getPersonaColor(sid) },
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
        setCounters(prev => ({
          active: Math.max(0, prev.active - 1),
          completed: data.status === 'converted' ? prev.completed + 1 : prev.completed,
          abandoned: data.status !== 'converted' ? prev.abandoned + 1 : prev.abandoned,
        }));
        setProgress(p => Math.min(100, p + 25));
      }
      // Follow active: auto-switch to the most recently updated active persona
      if (followActive && !pinned && !data.isComplete && !gridMode) {
        const sid2 = data.sessionId || data.personaId;
        if (sid2 && sid2 !== watchedSessionId) {
          if (watchedSessionId) unwatchSession(watchedSessionId);
          watchSession(sid2);
        }
      }
    });

    source.on('actionPlanned', (data) => {
      const sid = data.sessionId;
      if (!sid) return;
      const color = getPersonaColor(sid);
      setOverlayEvent({ type: 'actionPlanned', ...data, color });
      setCurrentUrl(data.url || currentUrl);
    });

    source.on('actionResult', (data) => {
      setOverlayEvent(prev => ({ type: 'actionResult', ...data }));
      if (data.newUrl) setCurrentUrl(data.newUrl);
    });

    source.on('frameThumb', (data) => {
      if (paused) return;
      const { sessionId: sid, jpegBase64 } = data;
      setThumbFrames(prev => ({ ...prev, [sid]: jpegBase64 }));
    });

    source.on('frameFull', (data) => {
      if (paused) return;
      const { sessionId: sid, jpegBase64 } = data;
      setFullFrames(prev => ({ ...prev, [sid]: jpegBase64 }));
      // Got a frame — stop buffering indicator
      clearTimeout(bufferingTimerRef.current);
      setBuffering(false);
    });

    source.on('step', (data) => {
      if (data.url) setCurrentUrl(data.url);
      // Append step to session steps
      if (data.sessionId) {
        setSessionSteps(prev => ({
          ...prev,
          [data.sessionId]: [...(prev[data.sessionId] || []), data],
        }));
      }
    });

    source.on('thought', (data) => {
      const item = { ...data, id: `${data.personaId}-${Date.now()}` };
      thoughtsRef.current = [item, ...thoughtsRef.current].slice(0, 40);
      setThoughts([...thoughtsRef.current]);
    });

    source.on('sessionFinished', (data) => {
      if (data.sessionId === watchedSessionId) {
        setFullFrames(prev => ({ ...prev, [data.sessionId]: null }));
      }
    });

    source.on('runComplete', () => {
      setProgress(100);
      setRunFinished(true);
      setCounters(prev => ({ ...prev, active: 0 }));
    });

    source.on('runFailed', (data) => {
      setRunFinished(true);
      setCounters(prev => ({ ...prev, active: 0 }));
      if (data?.error?.includes('unreachable') || data?.error?.includes('refused')) {
        setSiteUnreachable(true);
      }
    });

    source.start();

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    // Mock mode: mark as connected
    if (isMockMode) setConnected(true);

    return () => {
      source.stop();
      clearInterval(timer);
    };
  }, [runId, isMockMode]);

  // Poll run status
  useEffect(() => {
    if (!runId || isMockMode) return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const status = json.data?.status;
        if (status === 'completed') { clearInterval(pollInterval); setProgress(100); setRunFinished(true); }
        else if (status === 'failed') { clearInterval(pollInterval); setRunFinished(true); }
      } catch {}
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [runId, isMockMode]);

  const handleVerifyNow = async () => {
    if (!runId) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/verify-ownership`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (json.success && json.verified) await fetchRunDetails(runId);
      else setVerifyError('Verification failed. Please ensure the meta tag or text file is deployed.');
    } catch (err) {
      setVerifyError('Error: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleStepClick = (step, idx) => {
    setActiveStepIndex(idx);
    setStepPopup(step);
  };

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const personaList = Object.values(personaStates);
  const displayTargetUrl = currentUrl || runDoc?.url || (isMockMode ? 'https://shop.demo/checkout' : 'https://…');
  const watchedState = watchedSessionId ? personaStates[watchedSessionId] : null;
  const watchedSteps = watchedSessionId ? (sessionSteps[watchedSessionId] || []) : [];

  return (
    <div className="flex flex-col gap-4 h-full min-h-[calc(100vh-80px)]">

      {/* Demo badge */}
      {isMockMode && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
          <span>⚠️ Demo Data Active — mock personas (no real CDP streams).</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">Demo</span>
        </div>
      )}

      {/* Ownership verification banner */}
      {runDoc?.status === 'pending_verification' && (
        <div className="p-4 rounded-2xl bg-[#6C63FF]/10 border border-[#6C63FF]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Shield size={24} className="text-[#6C63FF] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
                Ownership Verification Required for {runDoc.url}
              </p>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-1">
                Add <code className="bg-white dark:bg-[#1E1E24] px-1.5 py-0.5 rounded border border-[#ECEAE5] dark:border-[#26262F] font-mono text-[11px]">&lt;meta name="vibetest-verify" content="{runDoc.verificationToken}"&gt;</code> to your HTML head.
              </p>
              {verifyError && <p className="text-xs text-[#F08A7E] mt-1 font-medium">{verifyError}</p>}
            </div>
          </div>
          <button
            onClick={handleVerifyNow}
            disabled={verifying}
            className="px-4 py-2 bg-[#6C63FF] text-white text-xs font-semibold rounded-xl hover:bg-[#5B54E8] flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            {verifying ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
            {verifying ? 'Checking…' : 'Verify Now'}
          </button>
        </div>
      )}

      {/* Site unreachable banner */}
      {siteUnreachable && (
        <div className="p-4 rounded-2xl bg-[#F08A7E]/10 border border-[#F08A7E]/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className="text-[#F08A7E] shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#F08A7E]">Could not reach the site</p>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-0.5">
                Target URL <code className="font-mono text-[11px]">{runDoc?.url}</code> could not be loaded.
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/app/new-run')} className="px-4 py-2 bg-[#F08A7E] text-white text-xs font-semibold rounded-xl hover:bg-[#d97368] whitespace-nowrap">
            Try Another URL
          </button>
        </div>
      )}

      {/* Header counters */}
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
              <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
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

      {/* Controls bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Connection status */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
          connected ? 'bg-[#8FB8A8]/15 text-[#8FB8A8]' : 'bg-[#F08A7E]/15 text-[#F08A7E]'
        }`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Live' : 'Disconnected'}
        </div>

        {/* Follow active toggle */}
        <button
          onClick={() => setFollowActive(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            followActive
              ? 'bg-[#6C63FF] text-white'
              : 'bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F]'
          }`}
          title="Auto-switch to whoever just acted"
        >
          <Activity className="w-3 h-3" />
          Follow Active
        </button>

        {/* Pin toggle */}
        <button
          onClick={() => setPinned(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            pinned
              ? 'bg-[#F59E0B] text-white'
              : 'bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F]'
          }`}
          title="Pin the current viewer"
        >
          {pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
          {pinned ? 'Pinned' : 'Pin'}
        </button>

        {/* Grid view toggle */}
        <button
          onClick={() => { setGridMode(g => !g); if (gridMode) setWatchedGrid(new Set()); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            gridMode
              ? 'bg-[#8FB8A8] text-white'
              : 'bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F]'
          }`}
          title="2x2 grid view"
        >
          <Grid2x2 className="w-3 h-3" />
          Grid
        </button>

        {/* Quality selector */}
        <div className="flex items-center gap-1 ml-auto">
          <Zap className="w-3 h-3 text-[#6B6B70] dark:text-[#98989F]" />
          <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">Quality:</span>
          {['Low', 'Medium', 'High'].map(q => (
            <button
              key={q}
              onClick={() => setQuality(q.toLowerCase())}
              className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                quality === q.toLowerCase()
                  ? 'bg-[#6C63FF] text-white'
                  : 'text-[#6B6B70] dark:text-[#98989F] hover:text-[var(--text-color)]'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className={`grid gap-4 flex-1 ${gridMode ? 'grid-cols-1 lg:grid-cols-[240px_1fr_240px]' : 'grid-cols-1 lg:grid-cols-[240px_1fr_240px]'}`}>

        {/* Left: Persona tile grid */}
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-3 overflow-y-auto max-h-[680px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F]">PERSONAS</p>
            <span className="text-[10px] font-mono text-[#6B6B70]">{personaList.length}</span>
          </div>

          {personaList.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B6B70] dark:text-[#98989F]">
              {siteUnreachable ? 'Site unreachable' : 'Deploying personas…'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {personaList.slice(0, 20).map(state => (
                <PersonaTile
                  key={state.personaId}
                  state={state}
                  isWatched={!gridMode && watchedSessionId === state.personaId}
                  isActive={false}
                  onClick={() => handleTileClick(state.personaId)}
                  thumbFrame={thumbFrames[state.personaId]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Center: Browser chrome + focus viewer or grid */}
        <div className={`rounded-2xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B] flex flex-col ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}>
          {/* Browser chrome toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#ECEAE5] dark:border-[#26262F] shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F08A7E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#8FB8A8]" />
            <span className="flex-1 px-3 py-1 text-[11px] font-mono bg-[#F7F6F3] dark:bg-[#0F0F12] rounded-full text-[#1C1C1E] dark:text-[#F2F2F7] border border-[#ECEAE5] dark:border-[#26262F] ml-2 truncate">
              {displayTargetUrl}
            </span>
            {buffering && !paused && (
              <span className="text-[10px] text-amber-500 font-semibold animate-pulse">Buffering…</span>
            )}
            <Badge variant={runFinished ? 'default' : 'accent'} pulse={!runFinished}>
              {runFinished ? 'Finished' : 'Live'}
            </Badge>
            <button
              onClick={() => setIsFullscreen(f => !f)}
              className="p-1.5 rounded-lg hover:bg-[#F7F6F3] dark:hover:bg-[#26262F] transition-colors"
              title="Toggle fullscreen"
            >
              <Maximize2 className="w-4 h-4 text-[#6B6B70] dark:text-[#98989F]" />
            </button>
          </div>

          {/* Grid view or single focus viewer */}
          {gridMode ? (
            <div className="flex-1 p-3">
              <GridView
                sessions={personaList}
                watchedIds={watchedGrid}
                fullFrames={fullFrames}
                thumbFrames={thumbFrames}
                overlayData={overlayEvent}
                onWatch={toggleGridWatch}
              />
              {watchedGrid.size >= 4 && (
                <p className="text-[10px] text-amber-500 text-center mt-2">
                  ⚠️ 4 full streams active — high bandwidth. Consider reducing.
                </p>
              )}
            </div>
          ) : (
            <FocusViewer
              sessionId={watchedSessionId}
              sessionState={watchedState}
              fullFrame={watchedSessionId ? fullFrames[watchedSessionId] : null}
              lastThumb={watchedSessionId ? thumbFrames[watchedSessionId] : null}
              currentUrl={displayTargetUrl}
              overlayData={overlayEvent}
              steps={watchedSteps}
              paused={paused}
              onPauseToggle={() => setPaused(p => !p)}
              onStepClick={handleStepClick}
              activeStepIndex={activeStepIndex}
              viewerRef={viewerRef}
            />
          )}
        </div>

        {/* Right: Thought feed */}
        <div className="bg-white dark:bg-[#17171B] rounded-2xl border border-[#ECEAE5] dark:border-[#26262F] p-3 overflow-y-auto max-h-[680px] flex flex-col gap-2">
          <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-1 px-1 shrink-0">LIVE THOUGHTS</p>
          <AnimatePresence initial={false}>
            {thoughts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className={`rounded-xl p-2.5 border text-left ${
                  t.variant === 'friction'
                    ? 'border-[#F08A7E]/30 bg-[#F08A7E]/5 dark:bg-[#F08A7E]/10'
                    : 'border-[#ECEAE5] dark:border-[#26262F] bg-[#F7F6F3] dark:bg-[#1E1E24]'
                }`}
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
                    {(t.name || 'Tester').split(' ')[0]}
                  </span>
                  <span className="text-xs ml-0.5">{EXPRESSION_EMOJI[t.emotion] || '💭'}</span>
                  {t.variant === 'friction' && (
                    <span className="ml-auto text-[9px] text-[#F08A7E] font-bold">friction</span>
                  )}
                </div>
                <p className="text-[11px] text-[#1C1C1E] dark:text-[#F2F2F7] leading-relaxed">"{t.text}"</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {thoughts.length === 0 && (
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F] text-center mt-8">
              {siteUnreachable ? 'No thoughts recorded' : 'Waiting for persona thoughts…'}
            </p>
          )}
        </div>
      </div>

      {/* Step popup (mini detail) */}
      <AnimatePresence>
        {stepPopup && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#17171B] rounded-2xl shadow-2xl border border-[#ECEAE5] dark:border-[#26262F] p-4 max-w-xs w-full"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">Step {(stepPopup.stepIndex ?? 0) + 1}: {stepPopup.action}</span>
              <button onClick={() => setStepPopup(null)} className="text-[#6B6B70] hover:text-[var(--text-color)] text-lg leading-none">&times;</button>
            </div>
            {stepPopup.screenshotUrl && (
              <img src={stepPopup.screenshotUrl} alt="Step screenshot" className="w-full rounded-xl mb-2 object-cover max-h-32" />
            )}
            <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F] italic">"{stepPopup.thought}"</p>
            <div className="flex items-center gap-2 mt-2">
              {stepPopup.isDeadClick && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F08A7E]/20 text-[#F08A7E] font-semibold">Dead Click</span>}
              <span className="text-[10px] text-[#6B6B70]">{EXPRESSION_EMOJI[stepPopup.emotion]} {stepPopup.emotion}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <GlassPanel className="rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6B6B70] dark:text-[#98989F] font-mono">Elapsed: {formatTime(elapsed)}</span>
          <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">·</span>
          <span className="text-xs text-[#6B6B70] dark:text-[#98989F] font-mono">{progress}% complete</span>
          {watchedSessionId && (
            <>
              <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">·</span>
              <span className="text-xs text-[#6C63FF] font-semibold">
                Watching: {watchedState?.persona?.name?.split(' ')[0] || 'Session'}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => navigate(runId ? `/app/dashboard?runId=${runId}` : '/app/dashboard')}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6C63FF] text-white text-xs font-semibold rounded-full hover:bg-[#5B54E8] transition-colors"
        >
          {runFinished ? 'View Full Results' : 'View Dashboard'} <ArrowRight size={13} />
        </button>
      </GlassPanel>

      {/* Run complete notification */}
      <AnimatePresence>
        {runFinished && !siteUnreachable && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-gradient-to-r from-[#6C63FF]/15 to-[#8FB8A8]/20 border border-[#6C63FF]/30 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-sm text-[#1C1C1E] dark:text-[#F2F2F7]">
              <Sparkles size={16} className="text-[#6C63FF]" />
              <span className="font-semibold">All Persona Sessions Completed!</span>
              <span className="text-xs text-[#6B6B70] dark:text-[#98989F]">Heatmap and insights are ready.</span>
            </div>
            <button
              onClick={() => navigate(runId ? `/app/dashboard?runId=${runId}` : '/app/dashboard')}
              className="px-3.5 py-1.5 bg-[#6C63FF] text-white text-xs font-semibold rounded-xl hover:bg-[#5B54E8] flex items-center gap-1.5 shadow-sm"
            >
              View Full Results <ArrowRight size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveSimulationPage;
