import React, { useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Play, Users, GitCompare,
  Settings, Zap, History, Globe, ShieldAlert,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Logo from '../common/Logo';

const EXPANDED_W = 240;
const COLLAPSED_W = 72;

const NavItem = ({ to, icon: Icon, label, collapsed }) => (
  <NavLink to={to} className="block w-full">
    {({ isActive }) => (
      <Tooltip content={collapsed ? label : ''} position="right" disabled={!collapsed}>
        <div
          className={`flex items-center gap-3 h-10 rounded-xl px-3 transition-all duration-150 ${
            isActive
              ? 'bg-[#6C63FF]/10 text-[#6C63FF] dark:bg-[#6C63FF]/20 font-semibold'
              : 'text-[#6B6B70] dark:text-[#98989F] hover:bg-[#F7F6F3] dark:hover:bg-[#26262F] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7]'
          }`}
          aria-current={isActive ? 'page' : undefined}
        >
          <Icon size={20} className="shrink-0" />
          <motion.span
            animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap text-sm font-medium"
          >
            {label}
          </motion.span>
        </div>
      </Tooltip>
    )}
  </NavLink>
);

export const Sidebar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const [usage, setUsage] = React.useState(null);
  const drawerRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const navItems = [
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/app/new-run',   icon: Play,             label: 'New Run' },
    { to: '/app/runs',      icon: History,          label: 'Run History' },
    { to: '/app/projects',  icon: Globe,            label: 'Projects' },
    { to: '/app/personas',  icon: Users,            label: 'Personas' },
    { to: '/app/compare',   icon: GitCompare,        label: 'Compare' },
    { to: '/app/account',   icon: Settings,          label: 'Account' },
  ];
  if (user?.role === 'admin') navItems.push({ to: '/app/admin', icon: ShieldAlert, label: 'Admin Portal' });

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/billing/me`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j.success && j.data?.usage) setUsage(j.data.usage); })
      .catch(() => null);
  }, [user]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (window.innerWidth >= 768) toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const planName = (user?.plan || 'free').toUpperCase();
  const isFree = !user?.plan || user.plan === 'free';
  const runsUsed = usage?.runsUsed ?? 0;
  const runsLimit = usage?.runsLimit ?? 3;
  const usagePct = Math.min(100, Math.round((runsUsed / runsLimit) * 100));

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      <div className={`flex items-center ${
        collapsed && !isMobile ? 'justify-center px-2' : 'px-4'
      } py-4 mb-1`}>
        {collapsed && !isMobile ? (
          <NavLink to="/">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#8FB8A8] flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer">
              <Zap size={18} className="text-white" />
            </div>
          </NavLink>
        ) : (
          <div className="flex items-center justify-between w-full">
            <NavLink to="/"><Logo className="h-7" /></NavLink>
            {isMobile && (
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F7F6F3] dark:hover:bg-[#26262F] text-[#6B6B70] dark:text-[#98989F]" aria-label="Close menu">
                <X size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      <nav role="navigation" aria-label="Main navigation" aria-expanded={!collapsed} className={`flex flex-col gap-1 flex-1 overflow-y-auto ${
        collapsed && !isMobile ? 'items-center px-2' : 'px-3'
      }`}>
        {navItems.map(item => <NavItem key={item.to} {...item} collapsed={collapsed && !isMobile} />)}
      </nav>

      <div className={`flex flex-col gap-2 pb-4 mt-2 ${
        collapsed && !isMobile ? 'px-2 items-center' : 'px-3'
      }`}>
        {collapsed && !isMobile ? (
          <Tooltip content={`${planName} \u2014 ${runsUsed}/${runsLimit} runs used`} position="right">
            <div onClick={() => navigate('/pricing')} className="w-9 h-9 rounded-xl bg-[#6C63FF]/10 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white transition-all flex items-center justify-center text-[10px] font-extrabold border border-[#6C63FF]/20 cursor-pointer">
              {planName.slice(0, 1)}
            </div>
          </Tooltip>
        ) : (
          <div className="bg-[#F7F6F3] dark:bg-[#141418] rounded-2xl p-3 border border-[#ECEAE5] dark:border-[#26262F]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{planName} Plan</span>
              <span className="text-[10px] font-mono text-[#6B6B70] dark:text-[#98989F]">{runsUsed}/{runsLimit}</span>
            </div>
            <div className="w-full h-1.5 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#6C63FF] rounded-full transition-all" style={{ width: `${usagePct}%` }} />
            </div>
            {isFree && (
              <button onClick={() => navigate('/pricing')} className="w-full py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#6C63FF] to-[#8FB8A8] hover:opacity-90 transition-opacity">
                ✦ Upgrade to Pro
              </button>
            )}
          </div>
        )}
        {!isMobile && (
          <Tooltip content={collapsed ? 'Expand (Ctrl+B)' : 'Collapse (Ctrl+B)'} position="right">
            <button onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={`flex items-center justify-center w-9 h-9 rounded-xl border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#1E1E24] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/40 hover:text-[#6C63FF] transition-all ${collapsed ? '' : 'mx-auto'}`}>
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden md:flex fixed left-0 top-0 h-full z-40 flex-col overflow-hidden bg-white dark:bg-[#17171B] border-r border-[#ECEAE5] dark:border-[#26262F]"
        style={{ minWidth: collapsed ? COLLAPSED_W : EXPANDED_W }}
      >
        <SidebarContent />
      </motion.aside>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div ref={drawerRef} initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="fixed left-0 top-0 h-full w-[260px] z-50 md:hidden shadow-2xl bg-white dark:bg-[#17171B] border-r border-[#ECEAE5] dark:border-[#26262F]">
              <SidebarContent isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
