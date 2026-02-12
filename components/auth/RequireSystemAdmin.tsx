import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/auth/AuthProvider';

interface Props {
  children: React.ReactNode;
}

const RequireSystemAdmin: React.FC<Props> = ({ children }) => {
  const { session, loading, isSystemAdmin, isOneDoctorInternal, hasAdminPageAccess, adminPages } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-gray-500">Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!isSystemAdmin && !isOneDoctorInternal) return <Navigate to="/access-denied" replace />;

  if (!hasAdminPageAccess(location.pathname)) {
    const fallback = adminPages.length ? adminPages[0] : (isOneDoctorInternal ? '/admin/clientes' : '/admin/dashboard');
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RequireSystemAdmin;
