import React from 'react';

export const Toggle = ({
  checked,
  onChange,
  label,
  className = '',
}) => {
  return (
    <label className={`inline-flex items-center cursor-pointer gap-3 ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-[#6C63FF]' : 'bg-[#ECEAE5] dark:bg-[#26262F]'}`} />
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      {label && <span className="text-sm font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">{label}</span>}
    </label>
  );
};

export default Toggle;
