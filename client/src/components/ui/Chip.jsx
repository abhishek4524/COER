import React from 'react';

export const Chip = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon: Icon,
}) => {
  const sizes = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3.5 py-1.5 text-xs gap-1.5 font-medium',
    lg: 'px-4 py-2 text-sm gap-2 font-medium',
  };

  const variants = {
    default: 'bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] text-[#1C1C1E] dark:text-[#F2F2F7]',
    accent: 'bg-[#6C63FF]/10 text-[#6C63FF] border border-[#6C63FF]/20',
    success: 'bg-[#8FB8A8]/15 text-[#3D6B58] dark:text-[#8FB8A8] border border-[#8FB8A8]/30',
    friction: 'bg-[#F08A7E]/15 text-[#C84536] dark:text-[#F08A7E] border border-[#F08A7E]/30',
    muted: 'bg-[#F7F6F3] dark:bg-[#202026] text-[#6B6B70] dark:text-[#98989F]',
  };

  return (
    <span className={`inline-flex items-center rounded-full transition-colors ${sizes[size]} ${variants[variant]} ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
};

export default Chip;
