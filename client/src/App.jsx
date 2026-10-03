import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AppShell from './components/shell/AppShell';
import ScrollToTop from './components/common/ScrollToTop';

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Lazy-loaded auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerifyEmailNoticePage = lazy(() => import('./pages/auth/VerifyEmailNoticePage'));
const PricingPage           = lazy(() => import('./pages/PricingPage'));

// Lazy-loaded app screens
const NewRunPage           = lazy(() => import('./pages/NewRunPage'));
const LiveSimulationPage   = lazy(() => import('./pages/LiveSimulationPage'));
const ResultsDashboardPage = lazy(() => import('./pages/ResultsDashboardPage'));
const PersonaDetailPage    = lazy(() => import('./pages/PersonaDetailPage'));
const CompareRunsPage      = lazy(() => import('./pages/CompareRunsPage'));
const PersonaLibraryPage   = lazy(() => import('./pages/PersonaLibraryPage'));
const AccountPage          = lazy(() => import('./pages/AccountPage'));
const SharedReportPage     = lazy(() => import('./pages/SharedReportPage'));
const RunHistoryPage       = lazy(() => import('./pages/RunHistoryPage'));
const ProjectsPage         = lazy(() => import('./pages/ProjectsPage'));
const AdminPage            = lazy(() => import('./pages/AdminPage'));
const TermsPage            = lazy(() => import('./pages/legal/TermsPage'));
const PrivacyPage          = lazy(() => import('./pages/legal/PrivacyPage'));
const RefundPage           = lazy(() => import('./pages/legal/RefundPage'));
const CookieNoticePage     = lazy(() => import('./pages/legal/CookieNoticePage'));

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailNoticePage />} />
            <Route path="/shared/:token" element={<SharedReportPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/refund" element={<RefundPage />} />
            <Route path="/cookies" element={<CookieNoticePage />} />

            {/* Protected App shell with nested routes */}
            <Route path="/app" element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard"  element={<ResultsDashboardPage />} />
                <Route path="new-run"    element={<NewRunPage />} />
                <Route path="runs"       element={<RunHistoryPage />} />
                <Route path="projects"   element={<ProjectsPage />} />
                <Route path="live/:runId" element={<LiveSimulationPage />} />
                <Route path="live"       element={<LiveSimulationPage />} />
                <Route path="personas"   element={<PersonaLibraryPage />} />
                <Route path="personas/:id" element={<PersonaDetailPage />} />
                <Route path="compare"    element={<CompareRunsPage />} />
                <Route path="reports"    element={<ResultsDashboardPage />} />
                <Route path="account"    element={<AccountPage />} />
                <Route path="admin"      element={<AdminPage />} />
                <Route path="settings"   element={<Navigate to="/app/account?tab=settings" replace />} />
              </Route>
            </Route>

            {/* Fallback 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
