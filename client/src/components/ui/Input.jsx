import React from 'react';

export const Input = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  className = '',
  startIcon: StartIcon,
  endIcon: EndIcon,
  pill = true,
  ...props
}) => {
  const shape = pill ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className="relative flex items-center w-full">
      {StartIcon && (
        <div className="absolute left-4 text-[#6B6B70] dark:text-[#98989F]">
          <StartIcon className="w-5 h-5" />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] text-[#1C1C1E] dark:text-[#F2F2F7] placeholder-[#6B6B70] dark:placeholder-[#98989F] px-5 py-3.5 text-sm transition-all duration-200 focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 shadow-sm ${shape} ${StartIcon ? 'pl-11' : ''} ${EndIcon ? 'pr-11' : ''} ${className}`}
        {...props}
      />
      {EndIcon && (
        <div className="absolute right-4 text-[#6B6B70] dark:text-[#98989F]">
          <EndIcon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};

export default Input;
