import React from 'react';
import { liveTickerItems } from '../../mock/personas';
import SmartImage from '../ui/SmartImage';

export const LiveTicker = () => {
  // Duplicate array to ensure seamless infinite scroll loop
  const tickerItems = [...liveTickerItems, ...liveTickerItems, ...liveTickerItems];

  return (
    <section className="w-full py-4 bg-white/60 dark:bg-[#17171B]/60 border-y border-[#ECEAE5] dark:border-[#26262F] backdrop-blur-md overflow-hidden">
      <div className="flex items-center gap-3 max-w-7xl mx-auto px-4 mb-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6C63FF] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6C63FF]" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6B70] dark:text-[#98989F]">
          Live AI Testing Feed
        </span>
      </div>

      <div className="relative flex overflow-x-hidden select-none">
        <div className="animate-marquee flex items-center gap-6 whitespace-nowrap py-1">
          {tickerItems.map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#F7F6F3] dark:bg-[#202026] border border-[#ECEAE5] dark:border-[#26262F] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] shadow-sm shrink-0"
            >
              <SmartImage
                src={item.avatar}
                fallbackSrc={item.fallbackAvatar}
                alt="Avatar"
                className="w-5 h-5 rounded-full bg-white dark:bg-[#17171B] border border-[#ECEAE5] shrink-0 object-cover"
              />
              <span className="font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LiveTicker;
