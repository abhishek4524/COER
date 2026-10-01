import React from 'react';

export const Slider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  label,
}) => {
  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs text-[#6B6B70] dark:text-[#98989F]">
          <span>{label}</span>
          <span className="font-mono-num font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">{value}%</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[#ECEAE5] dark:bg-[#26262F] rounded-lg appearance-none cursor-pointer accent-[#6C63FF]"
      />
    </div>
  );
};

export default Slider;
