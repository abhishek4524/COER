import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * BeforeAfterSlider
 * Draggable left/right split showing "Original" vs "With fixes (simulated)".
 * Numbered pins mark changed elements from `bboxes`.
 *
 * Props:
 *   beforeUrl    — URL of the "before" screenshot
 *   afterUrl     — URL of the "after" screenshot
 *   bboxes       — array of { fixId, fixTitle, bbox: {x,y,w,h} } (document coords)
 *   activeFixId  — highlighted fix id (from hovering a fix card)
 *   onPinClick   — (fixId) => void
 *   loading      — bool (show shimmer)
 *   showChangesOnly — bool (dim unchanged areas)
 *   sideBySide   — bool (side-by-side mode instead of slider)
 *   docWidth / docHeight — page dimensions for pin scaling
 */
const BeforeAfterSlider = ({
  beforeUrl,
  afterUrl,
  bboxes = [],
  activeFixId = null,
  onPinClick,
  loading = false,
  showChangesOnly = false,
  sideBySide = false,
  docWidth = 1440,
  docHeight = 900,
}) => {
  const containerRef = useRef(null);
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setSplitPct(Math.max(4, Math.min(96, (x / rect.width) * 100)));
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    setSplitPct(Math.max(4, Math.min(96, (x / rect.width) * 100)));
  }, []);

  const onUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [onMouseMove, onTouchMove, onUp]);

  // Scale a bbox from document coords to container coords
  const scaleBbox = (bbox, containerW, containerH) => {
    const scaleX = containerW / docWidth;
    const scaleY = containerH / docHeight;
    return {
      left: bbox.x * scaleX,
      top: bbox.y * scaleY,
      width: Math.max(24, bbox.width * scaleX),
      height: Math.max(24, bbox.height * scaleY),
    };
  };

  // Loading shimmer
  if (loading) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-[#EAE8E3] dark:bg-[#22222A] animate-pulse"
        style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-[#6B6B70] dark:text-[#98989F]">
            <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Generating preview…</p>
            <p className="text-xs opacity-70">This takes a few seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (sideBySide) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {/* Before */}
        <div className="relative rounded-2xl overflow-hidden">
          <img src={beforeUrl || '/assets/steps/product.png'} alt="Original" className="w-full h-auto object-cover" />
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2.5 py-1 text-xs font-semibold text-white rounded-full bg-[#6B6B70]">
              Original
            </span>
          </div>
          {renderPins(bboxes, activeFixId, onPinClick, false, scaleBbox)}
        </div>
        {/* After */}
        <div className="relative rounded-2xl overflow-hidden">
          <img src={afterUrl || '/assets/steps/product.png'} alt="With fixes (simulated)" className="w-full h-auto object-cover" />
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2.5 py-1 text-xs font-semibold text-white rounded-full bg-[#6C63FF]">
              With fixes · Simulated preview
            </span>
          </div>
          {renderPins(bboxes, activeFixId, onPinClick, true, scaleBbox)}
        </div>
      </div>
    );
  }

  // Slider mode (default)
  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden select-none cursor-col-resize bg-[#0F0F12]"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Before image (left / full background) */}
      <img
        src={beforeUrl || '/assets/steps/product.png'}
        alt="Original"
        className="w-full h-full object-cover object-top absolute inset-0"
        style={{ filter: showChangesOnly ? 'brightness(0.5)' : 'none', transition: 'filter 0.3s' }}
      />

      {/* After image (right side, clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${splitPct}%)` }}
      >
        <img
          src={afterUrl || '/assets/steps/product.png'}
          alt="With fixes (simulated)"
          className="w-full h-full object-cover object-top"
        />
      </div>

      {/* Pins on the after side */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ clipPath: `inset(0 0 0 ${splitPct}%)` }}
      >
        {bboxes.map((b, idx) => {
          const cw = containerRef.current?.offsetWidth || 800;
          const ch = containerRef.current?.offsetHeight || 450;
          const scaled = scaleBbox(b.bbox || {}, cw, ch);
          const isActive = b.fixId === activeFixId;
          return (
            <motion.button
              key={b.fixId + idx}
              className="absolute pointer-events-auto"
              style={{ left: scaled.left, top: scaled.top }}
              onClick={() => onPinClick?.(b.fixId)}
              animate={{ scale: isActive ? 1.3 : 1 }}
              transition={{ duration: 0.2 }}
              title={b.fixTitle}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 transition-all
                ${isActive ? 'border-white bg-[#6C63FF] shadow-[0_0_0_3px_rgba(108,99,255,0.4)]' : 'border-white/70 bg-[#6C63FF]'}`}>
                {idx + 1}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={(e) => { dragging.current = true; }}
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)] cursor-col-resize z-20 flex items-center justify-center"
        style={{ left: `${splitPct}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center border border-[#ECEAE5]">
          <span className="text-[11px] font-bold text-[#6B6B70] select-none">⇔</span>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <span className="px-2.5 py-1 text-xs font-semibold text-white rounded-full bg-black/50 backdrop-blur-sm">
          Original
        </span>
      </div>
      <div className="absolute top-3 right-3 z-10 pointer-events-none" style={{ opacity: splitPct < 90 ? 1 : 0, transition: 'opacity 0.2s' }}>
        <span className="px-2.5 py-1 text-xs font-semibold text-white rounded-full bg-[#6C63FF]/90 backdrop-blur-sm">
          With fixes · Simulated preview
        </span>
      </div>
    </div>
  );
};

function renderPins(bboxes, activeFixId, onPinClick, showAll, scaleBbox) {
  return bboxes.map((b, idx) => {
    const isActive = b.fixId === activeFixId;
    return (
      <motion.button
        key={`pin-${b.fixId}-${idx}`}
        className="absolute pointer-events-auto"
        style={{ left: `${(b.bbox?.x || 0) / 14.4}%`, top: `${(b.bbox?.y || 0) / 9}%` }}
        onClick={() => onPinClick?.(b.fixId)}
        animate={{ scale: isActive ? 1.3 : 1 }}
        title={b.fixTitle}
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2
          ${isActive ? 'border-white bg-[#6C63FF] shadow-[0_0_0_3px_rgba(108,99,255,0.4)]' : 'border-white/70 bg-[#6C63FF]'}`}>
          {idx + 1}
        </div>
      </motion.button>
    );
  });
}

export default BeforeAfterSlider;
