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

import './index.css';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />

          {/* Protected User Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/finder" element={<ProtectedRoute><StationFinder /></ProtectedRoute>} />
          <Route path="/station/:id" element={<ProtectedRoute><StationDetails /></ProtectedRoute>} />
          <Route path="/book/:id" element={<ProtectedRoute><BookingFlow /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><UserHistory /></ProtectedRoute>} />
          <Route path="/demo" element={<ProtectedRoute><InnovationDemo /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
