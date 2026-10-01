import React from 'react';
import { motion } from 'framer-motion';
import SmartImage from './SmartImage';

export const SpeechBubble = ({
  text,
  personaName,
  avatar,
  fallbackAvatar,
  variant = 'default',
  className = '',
}) => {
  const isFriction = variant === 'friction';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`glass-panel p-3.5 rounded-2xl shadow-float max-w-xs flex items-start gap-3 border ${
        isFriction
          ? 'border-[#F08A7E]/40 bg-[#FFF5F4]/90 dark:bg-[#201514]/90'
          : 'border-[#ECEAE5] dark:border-[#26262F]'
      } ${className}`}
    >
      {avatar && (
        <SmartImage
          src={avatar}
          fallbackSrc={fallbackAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Persona'}
          alt={personaName || 'Persona'}
          className="w-8 h-8 rounded-full border border-white dark:border-[#26262F] shrink-0 object-cover bg-white"
        />
      )}
      <div className="flex-1 min-w-0">
        {personaName && (
          <p className="text-[11px] font-semibold text-[#6B6B70] dark:text-[#98989F] mb-0.5">
            {personaName}
          </p>
        )}
        <p className={`text-xs font-medium leading-relaxed ${isFriction ? 'text-[#C84536] dark:text-[#F08A7E]' : 'text-[#1C1C1E] dark:text-[#F2F2F7]'}`}>
          "{text}"
        </p>
      </div>
    </motion.div>
  );
};

export default SpeechBubble;
