import React from 'react';

export const Card = ({
  children,
  className = '',
  hoverEffect = true,
  onClick,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] rounded-3xl p-6 shadow-soft transition-all duration-300 ${
        hoverEffect ? 'hover:shadow-float hover:-translate-y-1' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
