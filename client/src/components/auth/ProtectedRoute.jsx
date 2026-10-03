import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
        <div className="w-10 h-10 border-3 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">Authenticating session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
