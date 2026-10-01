import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AppShell from './components/shell/AppShell';
import ScrollToTop from './components/common/ScrollToTop';

// Lazy-loaded app screens
const NewRunPage           = lazy(() => import('./pages/NewRunPage'));
const LiveSimulationPage   = lazy(() => import('./pages/LiveSimulationPage'));
const ResultsDashboardPage = lazy(() => import('./pages/ResultsDashboardPage'));
const PersonaDetailPage    = lazy(() => import('./pages/PersonaDetailPage'));
const CompareRunsPage      = lazy(() => import('./pages/CompareRunsPage'));
const PersonaLibraryPage   = lazy(() => import('./pages/PersonaLibraryPage'));

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Marketing landing */}
          <Route path="/" element={<LandingPage />} />

          {/* App shell with nested routes */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard"  element={<ResultsDashboardPage />} />
            <Route path="new-run"    element={<NewRunPage />} />
            <Route path="live"       element={<LiveSimulationPage />} />
            <Route path="personas"   element={<PersonaLibraryPage />} />
            <Route path="personas/:id" element={<PersonaDetailPage />} />
            <Route path="compare"    element={<CompareRunsPage />} />
            <Route path="reports"    element={<ResultsDashboardPage />} />
            <Route path="settings"   element={
              <div className="flex items-center justify-center h-64 text-[#6B6B70] dark:text-[#98989F]">
                Settings — coming soon
              </div>
            } />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
