import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export const AppShell = () => (
  <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#0F0F12] transition-colors">
    <Sidebar />
    <TopBar />
    <main className="sm:ml-16 pt-14 pb-16 sm:pb-8 min-h-screen">
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
        <Outlet />
      </div>
    </main>
  </div>
);

export default AppShell;
