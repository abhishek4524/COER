import React, { createContext, useContext, useState, useCallback } from 'react';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [collapsed, _setCollapsed] = useState(() => {
    try { return localStorage.getItem('vibetest-sidebar') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = useCallback((val) => {
    _setCollapsed(val);
    try { localStorage.setItem('vibetest-sidebar', String(val)); } catch {}
  }, []);

  const toggle = useCallback(() => {
    _setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('vibetest-sidebar', String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
};

export default SidebarContext;
