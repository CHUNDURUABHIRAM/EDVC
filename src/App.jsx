import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';

/* Pages */
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import UserDashboard from './pages/UserDashboard';
import StationFinder from './pages/StationFinder';
import StationDetails from './pages/StationDetails';
import BookingFlow from './pages/BookingFlow';
import UserHistory from './pages/UserHistory';
import InnovationDemo from './pages/InnovationDemo';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogin from './pages/admin/AdminLogin';

import ErrorBoundary from './components/common/ErrorBoundary';

import './index.css';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />

          {/* Protected User Routes */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['user', 'admin']}><UserDashboard /></ProtectedRoute>} />
          <Route path="/finder" element={<ProtectedRoute allowedRoles={['user', 'admin']}><StationFinder /></ProtectedRoute>} />
          <Route path="/station/:id" element={<ProtectedRoute allowedRoles={['user', 'admin']}><StationDetails /></ProtectedRoute>} />
          <Route path="/book/:id" element={<ProtectedRoute allowedRoles={['user', 'admin']}><BookingFlow /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute allowedRoles={['user', 'admin']}><UserHistory /></ProtectedRoute>} />

          {/* Protected Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/smart-engine" element={<ProtectedRoute allowedRoles={['admin']}><InnovationDemo /></ProtectedRoute>} />
          <Route path="/demo" element={<Navigate to="/admin/smart-engine" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
