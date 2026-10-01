import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import Badge from '../ui/Badge';

const routeLabels = {
  '/app/dashboard':   'Results Dashboard',
  '/app/new-run':     'New Run',
  '/app/personas':    'Persona Library',
  '/app/reports':     'Reports',
  '/app/compare':     'Compare Runs',
  '/app/live':        'Live Simulation',
  '/app/settings':    'Settings',
};

export const TopBar = () => {
  const { pathname } = useLocation();
  const label = Object.entries(routeLabels).find(([k]) => pathname.startsWith(k))?.[1] ?? 'Personify';

  return (
    <header className="fixed top-0 left-16 right-0 h-14 z-30 flex items-center justify-between px-6
      bg-white/80 dark:bg-[#17171B]/80 backdrop-blur-md
      border-b border-[#ECEAE5] dark:border-[#26262F]">
      <h1 className="text-sm font-heading font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
        {label}
      </h1>

      <div className="flex items-center gap-3">
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#6B6B70]
          hover:bg-[#F7F6F3] dark:hover:bg-[#26262F] transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#F08A7E]" />
        </button>
        <ThemeToggle />
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#8FB8A8] flex items-center justify-center text-white text-[10px] font-bold">
          YO
        </div>
      </div>
    </header>
  );
};

export default TopBar;
