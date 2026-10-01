import React from 'react';
import SmartImage from './SmartImage';

export const AvatarGroup = ({
  avatars = [],
  max = 4,
  size = 'md',
  className = '',
}) => {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  const sizes = {
    sm: 'w-7 h-7 border-2 text-xs',
    md: 'w-10 h-10 border-2 text-sm',
    lg: 'w-12 h-12 border-3 text-base',
  };

  return (
    <div className={`flex items-center -space-x-3 overflow-hidden ${className}`}>
      {visible.map((av, idx) => {
        const src = typeof av === 'string' ? av : av.src || av.avatar;
        const fallbackSrc = typeof av === 'object' ? av.fallbackAvatar : undefined;
        return (
          <SmartImage
            key={idx}
            src={src}
            fallbackSrc={fallbackSrc || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Avatar'}
            alt={av.name || `Avatar ${idx}`}
            className={`inline-block rounded-full object-cover bg-white dark:bg-[#17171B] border-[#FFFFFF] dark:border-[#17171B] shadow-sm ${sizes[size]}`}
          />
        );
      })}
      {overflow > 0 && (
        <div className={`flex items-center justify-center rounded-full bg-[#ECEAE5] dark:bg-[#26262F] text-[#1C1C1E] dark:text-[#F2F2F7] font-semibold border-[#FFFFFF] dark:border-[#17171B] shadow-sm ${sizes[size]}`}>
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default AvatarGroup;
