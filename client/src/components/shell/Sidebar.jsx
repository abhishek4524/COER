import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Play,
  Users,
  BarChart3,
  GitCompare,
  Settings,
  Zap,
  Sparkles,
  CreditCard,
  History,
  Globe,
  ShieldAlert,
} from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const navItems = [
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/app/new-run',   icon: Play,            label: 'New Run' },
    { to: '/app/runs',      icon: History,         label: 'Run History' },
    { to: '/app/projects',  icon: Globe,           label: 'Projects' },
    { to: '/app/personas',  icon: Users,           label: 'Personas' },
    { to: '/app/compare',   icon: GitCompare,       label: 'Compare' },
    { to: '/app/account',   icon: Settings,         label: 'Account' },
  ];

  if (user?.role === 'admin') {
    navItems.push({ to: '/app/admin', icon: ShieldAlert, label: 'Admin Portal' });
  }

  useEffect(() => {
    if (user) {
      fetch(`${API_URL}/billing/me`, { credentials: 'include' })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data?.usage) {
            setUsage(json.data.usage);
          }
        })
        .catch(() => null);
    }
  }, [user]);

  const planName = (user?.plan || 'free').toUpperCase();
  const isFree = user?.plan === 'free';
  const runsUsed = usage?.runsUsed ?? 0;
  const runsLimit = usage?.runsLimit ?? 3;

  return (
    <>
      {/* ── Desktop & Tablet Vertical Sidebar (>= 640px) ── */}
      <aside className="hidden sm:flex fixed left-0 top-0 h-full w-16 z-40 flex-col items-center py-5 justify-between
        bg-white dark:bg-[#17171B] border-r border-[#ECEAE5] dark:border-[#26262F]">
        
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Logo mark */}
          <Tooltip content="Home" position="right">
            <NavLink to="/">
              <div className="mb-4 w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#8FB8A8] flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer">
                <Zap size={18} className="text-white" />
              </div>
            </NavLink>
          </Tooltip>

          <nav className="flex flex-col items-center gap-1 w-full">
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
        </div>

        {/* Sidebar Footer: Compact Plan Badge & Upgrade Meter */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <Tooltip content={`${planName} Plan (${runsUsed}/${runsLimit} runs used)`} position="right">
            <div
              onClick={() => navigate('/pricing')}
              className="cursor-pointer group flex flex-col items-center"
            >
              <div className="w-8 h-8 rounded-xl bg-[#6C63FF]/10 text-[#6C63FF] group-hover:bg-[#6C63FF] group-hover:text-white transition-all flex items-center justify-center text-[10px] font-extrabold border border-[#6C63FF]/20 shadow-sm">
                {planName.slice(0, 1)}
              </div>
            </div>
          </Tooltip>

          {isFree && (
            <Tooltip content="Upgrade to Pro" position="right">
              <button
                onClick={() => navigate('/pricing')}
                className="w-8 h-8 rounded-xl bg-[#8FB8A8]/15 text-[#8FB8A8] hover:bg-[#8FB8A8] hover:text-white transition-all flex items-center justify-center"
              >
                <Sparkles size={14} />
              </button>
            </Tooltip>
          )}
        </div>
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
