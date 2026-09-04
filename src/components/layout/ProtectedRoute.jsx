import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps protected pages. Redirects unauthenticated users to /auth.
 * Preserves the attempted URL so we can redirect back after login.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoggedIn, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (allowedRoles && allowedRoles.includes('admin') && !allowedRoles.includes('user')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const role = user?.role || 'user';

  if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(role)) {
    // Send each role to their correct home dashboard
    if (role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
