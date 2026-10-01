import React from 'react';

export const GlassPanel = ({
  children,
  className = '',
  hoverEffect = false,
  ...props
}) => {
  return (
    <div
      className={`glass-panel rounded-3xl p-6 shadow-float transition-all duration-300 ${
        hoverEffect ? 'hover:shadow-2xl hover:-translate-y-1' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
