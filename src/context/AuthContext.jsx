import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('chargeSpotUser');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) setUser(parsed);
      } catch {
        localStorage.removeItem('chargeSpotUser');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Login: validates email/password against stored user
   * Returns { success, error }
   */
  const login = (email, password) => {
    const stored = localStorage.getItem('chargeSpotUser');
    if (!stored) return { success: false, error: 'No account found. Please register first.' };

    const storedUser = JSON.parse(stored);
    if (storedUser.email !== email) return { success: false, error: 'Email not found.' };
    if (storedUser.password !== password) return { success: false, error: 'Incorrect password.' };

    setUser(storedUser);
    return { success: true };
  };

  /**
   * Demo login: auto-login as the default mock user
   */
  const loginAsDemo = () => {
    const stored = localStorage.getItem('chargeSpotUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      return { success: true };
    }
    return { success: false, error: 'Mock data not loaded.' };
  };

  /**
   * Register: creates a new user and saves to localStorage
   */
  const register = ({ name, email, password, phone, evModel }) => {
    const existing = localStorage.getItem('chargeSpotUser');
    if (existing) {
      const ex = JSON.parse(existing);
      if (ex.email === email) return { success: false, error: 'Email already registered.' };
    }

    const newUser = {
      id: `U-${Date.now()}`,
      name,
      email,
      password,
      phone: phone || '',
      evModel: evModel || 'EV Vehicle',
      batteryCapacity: 40.5,
      currentBatteryPct: 80,
      currentLocation: [12.9716, 77.5946],
      preferredConnector: 'CCS2',
    };

    localStorage.setItem('chargeSpotUser', JSON.stringify(newUser));
    setUser(newUser);
    return { success: true };
  };

  /**
   * Update user fields (e.g. battery level)
   */
  const updateUser = (fields) => {
    const updated = { ...user, ...fields };
    setUser(updated);
    localStorage.setItem('chargeSpotUser', JSON.stringify(updated));
  };

  /**
   * Logout: clear user from state (but keep mock station data)
   */
  const logout = () => {
    setUser(null);
    // Reset user to original mock (keep stations & bookings for demo continuity)
    // but mark as logged out by setting a special key
    localStorage.setItem('chargeSpotUser', JSON.stringify({
      ...JSON.parse(localStorage.getItem('chargeSpotUser') || '{}'),
      _loggedOut: true,
    }));
  };

  const isLoggedIn = !!user && !user._loggedOut;

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, loading, login, loginAsDemo, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
