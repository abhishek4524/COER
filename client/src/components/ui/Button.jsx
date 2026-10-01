import React from 'react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  pill = true,
  icon: Icon,
  disabled = false,
  onClick,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';
  
  const shape = pill ? 'rounded-full' : 'rounded-2xl';

  const sizes = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-2.5',
  };

  const variants = {
    primary: 'bg-[#6C63FF] hover:bg-[#5A52E0] text-white shadow-md shadow-[#6C63FF]/20 dark:bg-[#6C63FF] dark:hover:bg-[#5A52E0]',
    secondary: 'bg-[#FFFFFF] dark:bg-[#17171B] text-[#1C1C1E] dark:text-[#F2F2F7] border border-[#ECEAE5] dark:border-[#26262F] hover:bg-[#F7F6F3] dark:hover:bg-[#202026] shadow-sm',
    ghost: 'bg-transparent text-[#6B6B70] dark:text-[#98989F] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] hover:bg-black/5 dark:hover:bg-white/5',
    friction: 'bg-[#F08A7E] hover:bg-[#E0796D] text-white shadow-md shadow-[#F08A7E]/20',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${shape} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
};

export default Button;
