import React from 'react';

export const Skeleton = ({
  className = '',
  circle = false,
  width,
  height,
}) => {
  return (
    <div
      style={{ width, height }}
      className={`animate-pulse bg-[#ECEAE5] dark:bg-[#26262F] ${circle ? 'rounded-full' : 'rounded-2xl'} ${className}`}
    />
  );
};

export default Skeleton;
