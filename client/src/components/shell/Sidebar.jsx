import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Play,
  Users,
  BarChart3,
  GitCompare,
  Settings,
  Zap,
} from 'lucide-react';
import Tooltip from '../ui/Tooltip';

const navItems = [
  { to: '/app/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/new-run',    icon: Play,             label: 'New Run' },
  { to: '/app/personas',   icon: Users,            label: 'Personas' },
  { to: '/app/reports',    icon: BarChart3,         label: 'Reports' },
  { to: '/app/compare',    icon: GitCompare,        label: 'Compare' },
  { to: '/app/settings',   icon: Settings,          label: 'Settings' },
];

export const Sidebar = () => {
  return (
    <>
      {/* ── Desktop & Tablet Vertical Sidebar (>= 640px) ── */}
      <aside className="hidden sm:flex fixed left-0 top-0 h-full w-16 z-40 flex-col items-center py-5 gap-2
        bg-white dark:bg-[#17171B] border-r border-[#ECEAE5] dark:border-[#26262F]">
        {/* Logo mark */}
        <Tooltip content="Home" position="right">
          <NavLink to="/">
            <div className="mb-4 w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#8FB8A8] flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer">
              <Zap size={18} className="text-white" />
            </div>
          </NavLink>
        </Tooltip>

        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Tooltip key={to} content={label} position="right">
              <NavLink to={to}>
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                      ${isActive
                        ? 'bg-[#6C63FF]/10 text-[#6C63FF] dark:bg-[#6C63FF]/20'
                        : 'text-[#6B6B70] hover:bg-[#F7F6F3] dark:hover:bg-[#26262F]'}`}
                  >
                    <Icon size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip>
          ))}
        </nav>
      </aside>

      {/* ── Mobile Native Bottom Navigation (< 640px) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-14 z-40 bg-white/95 dark:bg-[#17171B]/95 backdrop-blur-md border-t border-[#ECEAE5] dark:border-[#26262F] flex items-center justify-around px-2 shadow-lg">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="flex-1 flex flex-col items-center justify-center py-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center gap-0.5 text-[10px] font-medium
                ${isActive ? 'text-[#6C63FF] font-semibold' : 'text-[#6B6B70] dark:text-[#98989F]'}`}>
                <Icon size={18} />
                <span>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
