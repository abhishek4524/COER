import React, { useState } from 'react';

export const Tooltip = ({
  content,
  children,
  position = 'top',
}) => {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`absolute z-50 px-3 py-1.5 text-xs font-medium text-white bg-[#1C1C1E] dark:bg-[#26262F] rounded-lg shadow-lg whitespace-nowrap pointer-events-none ${positionStyles[position]}`}>
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
