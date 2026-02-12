import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Layout from '../Layout';
import { useAuth } from '../../src/auth/AuthProvider';

interface Props {
  children: React.ReactNode;
  page?: string;
}

const ProtectedRoute: React.FC<Props> = ({ children, page }) => {
  const { session, loading, hasPageAccess, isSystemAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-gray-500">Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;

  const isOnboardingWelcome = location.pathname === '/app/onboarding/boas-vindas';
  const pageKey = page || `${location.pathname}${location.search}`;
  if (!isOnboardingWelcome && pageKey && isSystemAdmin && !hasPageAccess(pageKey)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!isOnboardingWelcome && pageKey && !hasPageAccess(pageKey)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Layout>{children}</Layout>;
};

export default ProtectedRoute;
