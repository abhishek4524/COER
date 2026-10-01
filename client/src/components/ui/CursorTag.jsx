import React from 'react';
import { motion } from 'framer-motion';

export const CursorTag = ({
  name,
  color = '#6C63FF',
  x = 0,
  y = 0,
  animatePath,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ x, y, opacity: 0 }}
      animate={
        animatePath
          ? {
              x: animatePath.x,
              y: animatePath.y,
              opacity: 1,
            }
          : { x, y, opacity: 1 }
      }
      transition={{
        duration: animatePath ? animatePath.duration || 6 : 0.4,
        repeat: animatePath ? Infinity : 0,
        repeatType: 'reverse',
        ease: 'easeInOut',
      }}
      className={`absolute z-30 pointer-events-none flex items-start gap-1 ${className}`}
    >
      {/* Cursor Icon SVG */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md shrink-0"
      >
        <path
          d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {/* Label Pill */}
      <span
        style={{ backgroundColor: color }}
        className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-full shadow-md whitespace-nowrap"
      >
        {name}
      </span>
    </motion.div>
  );
};

export default CursorTag;
