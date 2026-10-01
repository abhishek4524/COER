import React from 'react';

export const EmotionMeter = ({
  label,
  value = 50,
  max = 100,
  color = '#6C63FF',
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-[#6B6B70] dark:text-[#98989F]">{label}</span>
        <span className="font-mono-num font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
          {value}%
        </span>
      </div>
      <div className="w-full h-2 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
        <div
          style={{ width: `${percentage}%`, backgroundColor: color }}
          className="h-full rounded-full transition-all duration-500 ease-out"
        />
      </div>
    </div>
  );
};

export default EmotionMeter;
