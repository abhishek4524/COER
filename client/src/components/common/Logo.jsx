import React from 'react';

export default function Logo({ className = "h-8 w-auto", showText = false, textClassName = "font-bold text-lg tracking-tight" }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div className="relative flex items-center justify-center">
        <img
          src="/assets/logoLight.png"
          alt="VibeTest"
          className={`${className} dark:hidden object-contain`}
        />
        <img
          src="/assets/logoDark.png"
          alt="VibeTest"
          className={`${className} hidden dark:block object-contain`}
        />
      </div>
      {showText && (
        <span className={`text-[var(--text-color)] ${textClassName}`}>
          VibeTest
        </span>
      )}
    </div>
  );
}
