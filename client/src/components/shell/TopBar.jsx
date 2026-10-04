import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Bell, Wifi, WifiOff, User, CreditCard, LogOut, Moon, Sun, Settings, Menu } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import Badge from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';

const routeLabels = {
  '/app/dashboard':   'Results Dashboard',
  '/app/new-run':     'New Run',
  '/app/personas':    'Persona Library',
  '/app/reports':     'Reports',
  '/app/compare':     'Compare Runs',
  '/app/live':        'Live Simulation',
  '/app/account':     'Account & Settings',
  '/app/settings':    'Settings',
};

// Health Indicator
const HealthIndicator = () => {
  const [health, setHealth] = useState(null);
  const [show, setShow] = useState(false);
  const rawUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
  const serverUrl = rawUrl.replace(/["']/g, '').replace(/\/$/, '');

  const check = async () => {
    try {
      let res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      }
      if (res && res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const isOnline = health !== null;
  const mongoOk = health?.services?.mongo === 'connected';
  const redisOk = health?.services?.redis === 'connected';
  const color = !isOnline ? '#F08A7E' : !mongoOk ? '#F08A7E' : !redisOk ? '#F5A623' : '#8FB8A8';

  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#F7F6F3] dark:hover:bg-[#26262F]">
        {isOnline ? <Wifi size={15} style={{ color }} /> : <WifiOff size={15} style={{ color }} />}
        <span
          className="absolute top-1 right-1 w-2 h-2 rounded-full border-2 border-white dark:border-[#17171B]"
          style={{ background: color }}
        />
      </button>
      {show && (
        <div className="absolute top-10 right-0 z-50 min-w-[220px] rounded-xl bg-white dark:bg-[#1C1C22] border border-[#ECEAE5] dark:border-[#26262F] shadow-lg p-3 text-xs">
          <p className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-2">System Status</p>
          {health ? (
            <div className="flex flex-col gap-1.5">
              {Object.entries(health.services || {}).map(([key, val]) => {
                const ok = !val.includes('offline') && !val.includes('disconnected') && !val.includes('error');
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-[#6B6B70] dark:text-[#98989F]">{key}</span>
                    <span className={`font-medium ${ok ? 'text-[#8FB8A8]' : 'text-[#F08A7E]'}`}>{val}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#F08A7E]">Cannot reach server at {serverUrl}</p>
          )}
        </div>
      )}
    </div>
  );
};

// Notification Bell Popover Component
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifs = async () => {
    try {
      const { getNotifications } = await import('../../services/api');
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const { markAllNotificationsRead } = await import('../../services/api');
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const handleItemClick = async (n) => {
    try {
      const { markNotificationRead } = await import('../../services/api');
      await markNotificationRead(n._id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((item) => (item._id === n._id ? { ...item, read: true } : item)));
    } catch {}
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#6B6B70] hover:bg-[#F7F6F3] dark:hover:bg-[#26262F] transition-colors"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F08A7E] animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute top-10 right-0 z-50 w-80 rounded-2xl bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] shadow-xl p-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#ECEAE5] dark:border-[#26262F]">
            <span className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#6C63FF] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-[#ECEAE5] dark:divide-[#26262F] my-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleItemClick(n)}
                  className={`p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors flex items-start gap-2.5 ${!n.read ? 'bg-[#6C63FF]/5 font-medium' : 'opacity-70'}`}
                >
                  <span className="text-sm shrink-0">
                    {n.type === 'run_completed' ? '✅' : n.type === 'run_failed' ? '❌' : '🔔'}
                  </span>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white truncate">{n.title}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 line-clamp-2">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const TopBar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { setMobileOpen } = useSidebar();

  const label = Object.entries(routeLabels).find(([k]) => pathname.startsWith(k))?.[1] ?? 'VibeTest';

  // Initials fallback calculation
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 md:left-16 right-0 h-14 z-30 flex items-center justify-between px-6 bg-white/80 dark:bg-[#17171B]/80 backdrop-blur-md border-b border-[#ECEAE5] dark:border-[#26262F]">
      <div className="flex items-center">
        <button
          className="md:hidden p-2 rounded-lg hover:bg-[#F7F6F3] dark:hover:bg-[#26262F] text-[#6B6B70] dark:text-[#98989F] mr-1"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-sm font-heading font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
          {label}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <HealthIndicator />

        <NotificationBell />

        <ThemeToggle />

        {/* User Avatar Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full bg-[#6C63FF] text-white flex items-center justify-center text-xs font-bold shadow-sm hover:opacity-90 transition-opacity overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {menuOpen && (
            <div className="absolute top-10 right-0 z-50 w-56 rounded-2xl bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] shadow-xl p-2 text-xs divide-y divide-[#ECEAE5] dark:divide-[#26262F]">
              
              {/* User Header */}
              <div className="px-3 py-2.5">
                <p className="font-bold text-[var(--text-color)] truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F] truncate">{user?.email}</p>
                <Badge variant="pill" className="mt-1.5 bg-[#6C63FF]/15 text-[#6C63FF] text-[10px] font-semibold uppercase">
                  {user?.plan || 'Free'} Plan
                </Badge>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  to="/app/account?tab=profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-[#F7F6F3] dark:hover:bg-[#202026] transition-colors"
                >
                  <User size={14} className="text-[#6B6B70] dark:text-[#98989F]" />
                  <span>Account Profile</span>
                </Link>

                <Link
                  to="/app/account?tab=usage"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-[#F7F6F3] dark:hover:bg-[#202026] transition-colors"
                >
                  <CreditCard size={14} className="text-[#6B6B70] dark:text-[#98989F]" />
                  <span>Billing & Usage</span>
                </Link>
              </div>

              {/* Logout Item */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[#F08A7E] hover:bg-[#F08A7E]/10 transition-colors"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default TopBar;
