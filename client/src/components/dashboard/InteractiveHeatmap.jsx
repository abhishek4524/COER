import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MousePointer,
  Flame,
  Minus,
  Layers,
  Box,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Users,
  Compass,
  Eye,
  Sliders,
} from 'lucide-react';
import SmartImage from '../ui/SmartImage';
import Badge from '../ui/Badge';
import { getTestedScreens, getScreenHeatmapData, getScreenReplayEvents } from '../../services/api';

// Lazy-load the 3D Three.js view so initial load remains ultra fast
const Heatmap3DView = lazy(() => import('./Heatmap3DView'));

// ─── Persona filter definitions ──────────────────────────────────────────────
const PERSONA_FILTERS = [
  { key: 'all', label: 'All Personas' },
  { key: 'teen', label: 'Teenagers (<20)' },
  { key: 'senior', label: 'Seniors (55+)' },
  { key: 'a11y', label: 'Accessibility' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'non-english', label: 'Non-English' },
];

const OUTCOME_FILTERS = [
  { key: 'all', label: 'All Outcomes' },
  { key: 'completed', label: 'Completed' },
  { key: 'abandoned', label: 'Gave up' },
];

export const InteractiveHeatmap = ({ runId }) => {
  // ─── State ────────────────────────────────────────────────────────────────
  const [screens, setScreens] = useState([]);
  const [selectedScreenId, setSelectedScreenId] = useState('otp'); // default to OTP or first screen
  const [screenData, setScreenData] = useState(null);
  const [mode, setMode] = useState('clicks'); // 'clicks' | 'rage' | 'dead' | 'scroll' | '3d'
  const [intensity, setIntensity] = useState(85); // 30 - 100
  const [radius, setRadius] = useState(40); // radius ~40px per user spec
  const [personaFilter, setPersonaFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [fixExpanded, setFixExpanded] = useState(true);

  // Replay scrubber state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 - 45 seconds
  const [replayEvents, setReplayEvents] = useState([]);

  // Active hovered pin or hotspot
  const [hoveredPin, setHoveredPin] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Load initial screens list from api.js ─────────────────────────────────
  useEffect(() => {
    getTestedScreens(runId).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setScreens(data);
        setSelectedScreenId(data[0].id);
      }
    });
  }, [runId]);

  // ─── Load screen data when selected screen changes ────────────────────────
  useEffect(() => {
    if (!selectedScreenId) return;
    getScreenHeatmapData(selectedScreenId, { personaType: personaFilter, outcome: outcomeFilter }, runId)
      .then(data => {
        setScreenData(data);
      });
    getScreenReplayEvents(selectedScreenId, runId).then(events => {
      setReplayEvents(events);
    });
    setCurrentTime(0);
    setIsPlaying(false);
  }, [selectedScreenId, personaFilter, outcomeFilter, runId]);

  // ─── Scrubbing Playback Timer ─────────────────────────────────────────────
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(t => {
          if (t >= 45) {
            setIsPlaying(false);
            return 45;
          }
          return t + 1;
        });
      }, 500); // 500ms per simulated second
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // ─── Filtered hotspots based on persona type & outcome ────────────────────
  const currentHotspots = useMemo(() => {
    if (!screenData) return [];
    let list = screenData.hotspots;

    if (mode === 'rage') {
      list = list.filter(h => h.type === 'rage' || h.rageClicks > 6);
    } else if (mode === 'dead') {
      list = list.filter(h => h.type === 'dead');
    }

    // Adjust intensity/clicks by outcome filter
    if (outcomeFilter === 'abandoned') {
      list = list.map(h => ({ ...h, baseClicks: Math.round(h.baseClicks * 0.75) }));
    } else if (outcomeFilter === 'completed') {
      list = list.map(h => ({ ...h, rageClicks: Math.round(h.rageClicks * 0.3) }));
    }

    return list;
  }, [screenData, mode, outcomeFilter]);

  // ─── 2. Thermal Glow Canvas Layer ──────────────────────────────────────────
  // Color ramp: transparent -> pale peach (#FDE8E4) -> soft coral (#F08A7E) -> deep rose (#D94E4E)
  // Uses globalCompositeOperation = "lighter" for additive thermal glow
  useEffect(() => {
    if (mode === '3d' || mode === 'scroll') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const scale = intensity / 85;

    currentHotspots.forEach(h => {
      const px = (h.cx / 760) * W;
      const py = (h.cy / 480) * H;
      const ptRadius = radius * (1 + (h.baseClicks / 100));

      const grad = ctx.createRadialGradient(px, py, 0, px, py, ptRadius);

      if (h.type === 'dead') {
        grad.addColorStop(0, `rgba(148, 163, 184, ${0.7 * scale})`);
        grad.addColorStop(0.5, `rgba(203, 213, 225, ${0.35 * scale})`);
        grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
      } else {
        // Transparent -> pale peach (#FDE8E4) -> soft coral (#F08A7E) -> deep rose (#D94E4E)
        grad.addColorStop(0, `rgba(217, 78, 78, ${0.92 * scale})`); // Deep rose center
        grad.addColorStop(0.35, `rgba(240, 138, 126, ${0.78 * scale})`); // Soft coral
        grad.addColorStop(0.72, `rgba(253, 232, 228, ${0.45 * scale})`); // Pale peach
        grad.addColorStop(1, 'rgba(253, 232, 228, 0)'); // Transparent
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, ptRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core white-hot spot for heavy clicks or rage clicks
      if (h.rageClicks > 10 || h.baseClicks > 50) {
        const core = ctx.createRadialGradient(px, py, 0, px, py, ptRadius * 0.35);
        core.addColorStop(0, `rgba(255, 255, 255, ${0.9 * scale})`);
        core.addColorStop(0.5, `rgba(240, 138, 126, ${0.7 * scale})`);
        core.addColorStop(1, 'rgba(240, 138, 126, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(px, py, ptRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }, [currentHotspots, mode, intensity, radius]);

  // Active replay clicks up to currentTime
  const activeReplayClicks = useMemo(() => {
    return replayEvents.filter(e => e.time <= currentTime);
  }, [replayEvents, currentTime]);

  const currentReplayHead = useMemo(() => {
    if (activeReplayClicks.length === 0) return null;
    return activeReplayClicks[activeReplayClicks.length - 1];
  }, [activeReplayClicks]);

  return (
    <div className="flex flex-col gap-6">

      {/* ── 1. SCREEN SWITCHER (Pill Tabs with Thumbnail & Friction Dot) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {screens.map(screen => {
          const isSelected = screen.id === selectedScreenId;
          return (
            <button
              key={screen.id}
              onClick={() => setSelectedScreenId(screen.id)}
              className={`relative flex items-center gap-2.5 px-3.5 py-2 rounded-full border text-xs font-semibold shrink-0 transition-all duration-300
                ${isSelected
                  ? 'bg-white dark:bg-[#1E1E24] border-[#6C63FF] shadow-md ring-2 ring-[#6C63FF]/20 text-[#1C1C1E] dark:text-white'
                  : 'bg-white/60 dark:bg-[#17171B]/60 border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:bg-white dark:hover:bg-[#1E1E24] hover:border-[#6C63FF]/30'}`}
            >
              {/* Screen Thumbnail */}
              <div className="w-8 h-5 rounded-md overflow-hidden bg-black/10 shrink-0 border border-black/5">
                <img
                  src={screen.thumbnail}
                  alt={screen.label}
                  className="w-full h-full object-cover"
                />
              </div>

              <span>{screen.label}</span>

              {/* Mini Friction Dot */}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: screen.frictionDot }}
                title={`Friction Score: ${screen.frictionScore}%`}
              />

              <span className="font-mono-num text-[11px] opacity-60">
                {screen.frictionScore}%
              </span>

              {isSelected && (
                <motion.div
                  layoutId="screen-active-pill"
                  className="absolute inset-0 border-2 border-[#6C63FF] rounded-full pointer-events-none"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── 3. MODE TOGGLES (Animated Segmented Control) & Controls Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-1">
        {/* Animated Segmented Control */}
        <div className="flex items-center bg-[#F7F6F3] dark:bg-[#141418] p-1 rounded-full border border-[#ECEAE5] dark:border-[#26262F] max-w-full overflow-x-auto scrollbar-none">
          {[
            { key: 'clicks', label: 'Clicks', icon: MousePointer },
            { key: 'rage', label: 'Rage clicks', icon: Flame },
            { key: 'dead', label: 'Dead clicks', icon: Minus },
            { key: 'scroll', label: 'Scroll depth', icon: Layers },
            { key: '3d', label: '3D view', icon: Box, optionalMobile: true },
          ].map(({ key, label, icon: Icon, optionalMobile }) => {
            const active = mode === key;
            return (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors z-10 shrink-0
                  ${optionalMobile ? 'hidden sm:inline-flex' : 'inline-flex'}
                  ${active
                    ? 'text-[#1C1C1E] dark:text-[#F2F2F7]'
                    : 'text-[#6B6B70] dark:text-[#98989F] hover:text-[#1C1C1E] dark:hover:text-white'}`}
              >
                {active && (
                  <motion.div
                    layoutId="mode-pill-highlight"
                    className="absolute inset-0 bg-white dark:bg-[#23232C] rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon size={13} className={`relative z-10 ${active ? (key === 'rage' ? 'text-[#F08A7E]' : 'text-[#6C63FF]') : ''}`} />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Heatmap Intensity Slider & Low-to-High Legend */}
        {mode !== '3d' && mode !== 'scroll' && (
          <div className="flex items-center gap-6 text-xs text-[#6B6B70] dark:text-[#98989F]">
            <div className="flex items-center gap-2">
              <span className="font-medium">Intensity:</span>
              <input
                type="range"
                min={30}
                max={100}
                value={intensity}
                onChange={e => setIntensity(+e.target.value)}
                className="accent-[#6C63FF] w-24 h-1.5 cursor-pointer"
              />
              <span className="font-mono-num font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] w-8">{intensity}%</span>
            </div>

            {/* Low-to-High Legend */}
            <div className="flex items-center gap-2">
              <span className="text-[11px]">Low</span>
              <div
                className="w-20 h-2.5 rounded-full shadow-inner"
                style={{
                  background: 'linear-gradient(to right, #FDE8E4, #F08A7E, #D94E4E)',
                }}
              />
              <span className="text-[11px] font-bold text-[#D94E4E]">High</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. FILTERS (Persona Type & Outcome) ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        {/* Persona Type Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mr-1">Tester Cohort:</span>
          {PERSONA_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setPersonaFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
                ${personaFilter === f.key
                  ? 'bg-[#6C63FF]/10 text-[#6C63FF] border-[#6C63FF]/40 font-semibold shadow-xs'
                  : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/30'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Outcome Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mr-1">Outcome:</span>
          {OUTCOME_FILTERS.map(o => (
            <button
              key={o.key}
              onClick={() => setOutcomeFilter(o.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
                ${outcomeFilter === o.key
                  ? 'bg-[#1C1C1E] dark:bg-white text-white dark:text-[#1C1C1E] border-transparent font-semibold shadow-xs'
                  : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-gray-400'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN VIEWPORT GRID: HEATMAP (LEFT) + INSIGHT CARD (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        
        {/* ── LEFT: Heatmap Viewport (2D Canvas or 3D WebGL) ── */}
        <div className="relative rounded-3xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B] shadow-2xl">
          
          {mode === '3d' ? (
            /* ── 5. 3D VIEW (Lazy Loaded Three.js Glass Topography) ── */
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center h-[480px] bg-white dark:bg-[#17171B] text-[#6B6B70]">
                <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-medium">Generating 3D glass topography…</p>
              </div>
            }>
              <Heatmap3DView
                hotspots={currentHotspots}
                screenImage={screenData?.thumbnail}
                onFallback={() => setMode('clicks')}
              />
            </Suspense>
          ) : (
            /* ── 2. 2D THERMAL GLOW VIEW ── */
            <div ref={containerRef} className="relative w-full aspect-[16/10] overflow-hidden select-none">
              
              {/* Background Screenshot with cross-fade */}
              <AnimatePresence mode="wait">
                <motion.img
                  key={screenData?.id || selectedScreenId}
                  src={screenData?.screenshot || screenData?.thumbnail || '/assets/steps/product.png'}
                  alt={screenData?.name || screenData?.label || 'Screen'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full object-cover block"
                />
              </AnimatePresence>

              {/* Thermal Glow Canvas with 800ms Ease-Out Fade & 4% Breathing Pulse */}
              <motion.canvas
                ref={canvasRef}
                width={760}
                height={480}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: prefersReducedMotion ? 1 : [0.96, 1.0, 0.96],
                }}
                transition={{
                  opacity: {
                    duration: prefersReducedMotion ? 0.8 : 3.8,
                    repeat: prefersReducedMotion ? 0 : Infinity,
                    ease: 'easeInOut',
                  },
                }}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  filter: 'blur(7px)', // Soft cinematic thermal diffusion
                }}
              />

              {/* ── 3. MODE: RAGE CLUSTERS (Dashed Pulsing Coral Rings) ── */}
              {mode === 'rage' && (
                <div className="absolute inset-0 pointer-events-none">
                  {currentHotspots.filter(h => h.isRageCluster || h.rageClicks > 12).map(cluster => (
                    <div
                      key={cluster.id}
                      className="absolute flex flex-col items-center"
                      style={{
                        left: `${(cluster.cx / 760) * 100}%`,
                        top: `${(cluster.cy / 480) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      {/* Pulsing Dashed Coral Ring */}
                      <motion.div
                        animate={{
                          scale: [1, 1.25, 1],
                          opacity: [0.7, 1, 0.7],
                        }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-20 h-20 rounded-full border-2 border-dashed border-[#F08A7E] bg-[#F08A7E]/10"
                      />
                      {/* Cluster Label Badge */}
                      <span className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#F08A7E] shadow-md whitespace-nowrap">
                        {cluster.rageClicks} rage clicks · {Math.round(cluster.rageClicks * 0.7)} personas
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 3. MODE: DEAD CLICKS (Hollow Ripple Markers) ── */}
              {mode === 'dead' && (
                <div className="absolute inset-0 pointer-events-none">
                  {currentHotspots.filter(h => h.type === 'dead').map(dc => (
                    <div
                      key={dc.id}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: `${(dc.cx / 760) * 100}%`,
                        top: `${(dc.cy / 480) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <motion.div
                        animate={{ scale: [0.8, 1.6, 2], opacity: [0.8, 0.4, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                        className="absolute w-8 h-8 rounded-full border-2 border-slate-400"
                      />
                      <div className="w-4 h-4 rounded-full border-2 border-slate-500 bg-white/70" />
                      <span className="absolute top-5 px-2 py-0.5 rounded-md text-[9px] font-mono-num font-semibold text-slate-700 bg-white/90 shadow">
                        No action triggered
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 3. MODE: SCROLL DEPTH (Vertical Strip & Fold Line) ── */}
              {mode === 'scroll' && screenData?.scrollDepth && (
                <>
                  {/* Dashed Average Fold Line */}
                  <div
                    className="absolute left-0 right-16 border-t-2 border-dashed border-[#F08A7E] z-20 flex items-center px-4"
                    style={{ top: `${screenData.scrollDepth.averageFold}%` }}
                  >
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#F08A7E] shadow -translate-y-1/2">
                      Average Fold ({screenData.scrollDepth.averageFold}% Reach)
                    </span>
                  </div>

                  {/* Vertical Strip on Right with 4 Stacked Coral Segments (100%, 68%, 31%, 9%) */}
                  <div className="absolute top-0 bottom-0 right-0 w-16 bg-white/85 dark:bg-[#17171B]/85 backdrop-blur-md border-l border-[#ECEAE5] dark:border-[#26262F] flex flex-col z-20 shadow-lg">
                    {screenData.scrollDepth.percentages.map((pct, idx) => {
                      const opacity = 1 - (idx * 0.25);
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center justify-center border-b border-[#ECEAE5]/40 dark:border-[#26262F]/40 p-1"
                          style={{ backgroundColor: `rgba(240, 138, 126, ${0.12 * opacity})` }}
                        >
                          <span className="font-mono-num font-bold text-xs text-[#F08A7E]">
                            {pct}%
                          </span>
                          <span className="text-[8px] text-[#6B6B70] dark:text-[#98989F] text-center leading-none mt-0.5">
                            {idx === 0 ? 'Top' : idx === 1 ? 'Mid' : idx === 2 ? 'Fold' : 'Bottom'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── 4. PERSONA PINS (Circular Avatar with Hover Glass Speech Bubble) ── */}
              {mode !== 'scroll' && screenData?.pins && (
                <div className="absolute inset-0">
                  {screenData.pins.map(pin => {
                    const isHovered = hoveredPin?.id === pin.id;
                    return (
                      <div
                        key={pin.id}
                        onMouseEnter={() => setHoveredPin(pin)}
                        onMouseLeave={() => setHoveredPin(null)}
                        className="absolute z-20 flex flex-col items-center cursor-pointer transition-transform hover:scale-125"
                        style={{
                          left: `${(pin.x / 760) * 100}%`,
                          top: `${(pin.y / 480) * 100}%`,
                          transform: 'translate(-50%, -100%)',
                        }}
                      >
                        {/* Pin Avatar with 2px White Ring */}
                        <div className={`relative w-8 h-8 rounded-full ring-2 ring-white shadow-xl overflow-hidden bg-white
                          ${pin.type === 'rage' ? 'border-2 border-[#F08A7E]' : 'border-2 border-[#6C63FF]'}`}>
                          <SmartImage
                            src={isHovered ? pin.altAvatar : pin.avatar}
                            fallbackSrc={pin.avatar}
                            alt={pin.name}
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                        </div>

                        {/* Pin Needle */}
                        <span className={`w-1 h-3 ${pin.type === 'rage' ? 'bg-[#F08A7E]' : 'bg-[#6C63FF]'}`} />
                        <span className={`w-2 h-2 rounded-full ${pin.type === 'rage' ? 'bg-[#F08A7E]' : 'bg-[#6C63FF]'}`} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── 4. Glass Speech Bubble on Pin Hover ── */}
              <AnimatePresence>
                {hoveredPin && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.94 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-40 p-3.5 rounded-2xl bg-white/95 dark:bg-[#1E1E24]/95 backdrop-blur-md border border-[#ECEAE5] dark:border-[#26262F] shadow-2xl max-w-xs pointer-events-none"
                    style={{
                      left: `${Math.min(78, Math.max(22, (hoveredPin.x / 760) * 100))}%`,
                      top: `${Math.max(12, (hoveredPin.y / 480) * 100 - 16)}%`,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-[#6C63FF]/30 shrink-0">
                        <img
                          src={hoveredPin.altAvatar || hoveredPin.avatar}
                          alt={hoveredPin.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1C1C1E] dark:text-[#F2F2F7] leading-none">
                          {hoveredPin.name}, {hoveredPin.age}
                        </p>
                        <span className="text-[10px] text-[#F08A7E] font-semibold">
                          Frustration: {hoveredPin.frustration}/100
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#6B6B70] dark:text-[#98989F] italic leading-snug">
                      "{hoveredPin.quote}"
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active Replay Head Indicator */}
              {isPlaying && currentReplayHead && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute pointer-events-none z-30 flex items-center gap-1.5"
                  style={{
                    left: `${(currentReplayHead.x / 760) * 100}%`,
                    top: `${(currentReplayHead.y / 480) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-[#6C63FF] border-2 border-white shadow-lg animate-ping opacity-75" />
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#6C63FF] shadow">
                    {currentReplayHead.personaName}
                  </span>
                </motion.div>
              )}
            </div>
          )}

          {/* ── 6. PLAYBACK SCRUBBER (Bottom Bar) ── */}
          <div className="p-3.5 bg-white/95 dark:bg-[#1E1E24]/95 border-t border-[#ECEAE5] dark:border-[#26262F] flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(p => !p)}
              className="w-8 h-8 rounded-full bg-[#6C63FF] text-white flex items-center justify-center hover:bg-[#5B54E8] transition-colors shadow-sm shrink-0"
              title={isPlaying ? 'Pause Replay' : 'Play Session Clicks'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>

            <button
              onClick={() => { setCurrentTime(0); setIsPlaying(false); }}
              className="p-1 text-[#6B6B70] hover:text-[#1C1C1E] dark:hover:text-white transition-colors shrink-0"
              title="Reset Timeline"
            >
              <RotateCcw size={14} />
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={45}
                value={currentTime}
                onChange={e => setCurrentTime(+e.target.value)}
                className="w-full accent-[#6C63FF] h-1.5 cursor-pointer"
              />
            </div>

            <span className="font-mono-num text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] w-12 text-right shrink-0">
              0:{currentTime < 10 ? `0${currentTime}` : currentTime}
            </span>

            <span className="text-[11px] text-[#6B6B70] dark:text-[#98989F] hidden sm:inline shrink-0">
              {activeReplayClicks.length} clicks simulated
            </span>
          </div>
        </div>

        {/* ── RIGHT: Insight Card & Top Hotspot Details ── */}
        <div className="flex flex-col gap-4">
          
          {/* Top Hotspot Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-num font-semibold text-[#6C63FF] uppercase tracking-wider">
                TOP HOTSPOT
              </span>
              <Badge
                variant={screenData?.topHotspot?.severity === 'critical' ? 'friction' : 'accent'}
                className="text-[10px] capitalize font-bold"
              >
                {screenData?.topHotspot?.severity || 'High'} Severity
              </Badge>
            </div>

            <div>
              <p className="font-heading font-bold text-base text-[#1C1C1E] dark:text-[#F2F2F7]">
                {screenData?.topHotspot?.elementName}
              </p>
              <p className="text-[11px] font-mono-num text-[#6B6B70] dark:text-[#98989F] truncate mt-0.5">
                {screenData?.topHotspot?.selector}
              </p>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] leading-relaxed mt-2">
                {screenData?.topHotspot?.issue}
              </p>
            </div>

            {/* Affected Persona Avatars ("38/50") */}
            <div className="pt-3 border-t border-[#ECEAE5] dark:border-[#26262F]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
                  Affected Testers:
                </span>
                <span className="font-mono-num font-bold text-xs text-[#F08A7E]">
                  {screenData?.topHotspot?.affectedCount || 38} of 50
                </span>
              </div>
              <div className="flex items-center -space-x-2 overflow-hidden py-1">
                {(screenData?.pins || []).slice(0, 5).map((pin, i) => (
                  <div key={i} className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-[#17171B] overflow-hidden bg-white shadow-xs">
                    <img src={pin.avatar} alt={pin.name} className="w-full h-full object-cover" />
                  </div>
                ))}
                {screenData?.topHotspot?.affectedCount > 5 && (
                  <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-[#17171B] bg-[#F7F6F3] dark:bg-[#26262F] flex items-center justify-center text-[10px] font-bold text-[#6B6B70] dark:text-[#98989F]">
                    +{screenData.topHotspot.affectedCount - 5}
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible Suggested Fix Accordion */}
            <div className="pt-2 border-t border-[#ECEAE5] dark:border-[#26262F]">
              <button
                onClick={() => setFixExpanded(e => !e)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] py-1"
              >
                <span className="flex items-center gap-1.5 text-[#6C63FF]">
                  <Sparkles size={13} /> Suggested Fix
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${fixExpanded ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {fixExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 p-3 rounded-2xl bg-[#6C63FF]/8 border border-[#6C63FF]/20 text-xs text-[#1C1C1E] dark:text-[#F2F2F7] leading-relaxed">
                      {screenData?.topHotspot?.suggestedFix}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick Metrics Tile */}
          <div className="p-4 rounded-3xl bg-[#F7F6F3] dark:bg-[#141418] border border-[#ECEAE5] dark:border-[#26262F] text-xs flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-[#6B6B70] dark:text-[#98989F]">Screen:</span>
              <span className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{screenData?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B70] dark:text-[#98989F]">Friction Index:</span>
              <span className="font-mono-num font-bold text-[#F08A7E]">{screenData?.frictionScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B70] dark:text-[#98989F]">Active Mode:</span>
              <span className="font-semibold capitalize text-[#6C63FF]">{mode}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default InteractiveHeatmap;
