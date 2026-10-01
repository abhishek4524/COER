import React from 'react';

export const Badge = ({
  children,
  variant = 'accent',
  pulse = false,
  className = '',
}) => {
  const variants = {
    accent: 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/30',
    success: 'bg-[#8FB8A8]/15 text-[#3D6B58] dark:text-[#8FB8A8] border-[#8FB8A8]/30',
    friction: 'bg-[#F08A7E]/15 text-[#C84536] dark:text-[#F08A7E] border-[#F08A7E]/30',
    neutral: 'bg-[#F7F6F3] dark:bg-[#202026] text-[#6B6B70] dark:text-[#98989F] border-[#ECEAE5] dark:border-[#26262F]',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${variants[variant]} ${className}`}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${variant === 'friction' ? 'bg-[#F08A7E]' : 'bg-[#6C63FF]'}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${variant === 'friction' ? 'bg-[#F08A7E]' : 'bg-[#6C63FF]'}`} />
        </span>
      )}
      {children}
    </span>
  );
};

export default Badge;
