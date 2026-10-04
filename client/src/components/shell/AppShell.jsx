import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';

const EXPANDED_W = 240;
const COLLAPSED_W = 72;

function AppContent() {
  const { collapsed } = useSidebar();

  // Trigger resize after sidebar animation so charts re-measure
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
    return () => clearTimeout(timer);
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-[var(--bg-color)] transition-colors duration-150">
      <Sidebar />
      <TopBar />
      {/* Desktop: margin tracks sidebar */}
      <motion.main
        animate={{ marginLeft: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden md:block pt-14 pb-8 min-h-screen"
      >
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </motion.main>
      {/* Mobile: no sidebar margin */}
      <main className="md:hidden pt-14 pb-16 min-h-screen">
        <div className="p-3 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppContent />
    </SidebarProvider>
  );
}

export default AppShell;
