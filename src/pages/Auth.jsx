import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Smartphone, Battery, Zap, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, login, register, loginAsAdmin } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', evModel: '',
  });

  const getRoleRedirect = (role) => {
    if (role === 'admin') return '/admin';
    return '/dashboard';
  };

  // If already logged in, redirect away
  useEffect(() => {
    if (isLoggedIn && user) {
      const defaultPath = getRoleRedirect(user.role);
      const from = location.state?.from?.pathname || defaultPath;
      navigate(from, { replace: true });
    }
  }, [isLoggedIn, user, navigate, location]);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (isLogin) {
      const result =await login(form.email, form.password);
      if (!result.success) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      // Login succeeded — useEffect will trigger redirect via isLoggedIn
    } else {
      if (!form.name || !form.email || !form.password) {
        setError('Please fill in all required fields.');
        setIsLoading(false);
        return;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.');
        setIsLoading(false);
        return;
      }
      const result = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        evModel: form.evModel,
      });
      if (!result.success) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(false);
    // Redirect handled by useEffect watching isLoggedIn + user
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setForm({ name: '', email: '', password: '', phone: '', evModel: '' });
  };

  return (
    <div className="auth-container blur-bg">
      <div className="auth-card glass-panel">
        <div className="auth-brand">
          <div className="brand-icon">
            <Zap size={26} color="white" />
          </div>
          <div>
            <h1 className="brand-name">Charge<span style={{ color: 'var(--primary-color)' }}>Spot</span></h1>
            <p className="brand-tag">Smart EV Charging Platform</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={`tab-btn ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); }}>Login</button>
          <button className={`tab-btn ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); }}>Register</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <div className="input-group">
                <User className="input-icon" size={18} />
                <input name="name" type="text" placeholder="Full Name *" value={form.name} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <Smartphone className="input-icon" size={18} />
                <input name="phone" type="tel" placeholder="Phone Number" value={form.phone} onChange={handleChange} />
              </div>
              <div className="input-group">
                <Battery className="input-icon" size={18} />
                <input name="evModel" type="text" placeholder="EV Model (e.g. Nexon EV Max)" value={form.evModel} onChange={handleChange} />
              </div>
            </>
          )}

          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input name="email" type="email" placeholder="Email Address *" value={form.email} onChange={handleChange} required />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password *"
              value={form.password}
              onChange={handleChange}
              required
            />
            <button type="button" className="eye-btn" onClick={() => setShowPassword(s => !s)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="error-banner">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button type="submit" className="btn-primary submit-btn" disabled={isLoading}>
            {isLoading ? <span className="spinner" /> : (isLogin ? 'Login to Dashboard' : 'Create Account')}
          </button>
        </form>

        <p className="switch-text">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" className="switch-btn" onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}>
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>

        <div className="divider-row" style={{ marginTop: '20px' }}>
          <div className="divider-line" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ADMINISTRATION</span>
          <div className="divider-line" />
        </div>

        <button 
          type="button" 
          className="btn-secondary" 
          style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={() => navigate('/admin/login')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Go to Admin Portal
        </button>
      </div>

      <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
        }
        .blur-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%);
          z-index: -1;
        }
        .auth-card {
          width: 100%;
          max-width: 460px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .auth-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .brand-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 20px var(--primary-glow);
        }
        .brand-name {
          font-size: 1.6rem;
          font-weight: 800;
          margin: 0;
          line-height: 1;
        }
        .brand-tag {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 4px 0 0;
        }
        .auth-tabs {
          display: flex;
          background: rgba(255,255,255,0.05);
          border-radius: var(--radius-full);
          padding: 4px;
          gap: 4px;
        }
        .tab-btn {
          flex: 1;
          padding: 10px;
          border-radius: var(--radius-full);
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .tab-btn.active {
          background: var(--primary-color);
          color: white;
          box-shadow: 0 2px 10px var(--primary-glow);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
          z-index: 1;
        }
        .input-group input {
          width: 100%;
          padding: 13px 16px 13px 44px;
          border-radius: var(--radius-md);
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          font-size: 0.95rem;
          transition: var(--transition-fast);
        }
        .input-group input:focus {
          border-color: var(--primary-color);
          background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }
        .eye-btn {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
        }
        .eye-btn:hover { color: var(--text-main); }
        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--status-red);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
        }
        .submit-btn {
          width: 100%;
          padding: 14px;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
        }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .divider-row {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: var(--border-color);
        }
        .switch-text {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.9rem;
          margin: 0;
        }
        .link-btn {
          background: none;
          border: none;
          color: var(--primary-color);
          font-weight: 600;
          cursor: pointer;
          font-size: inherit;
          font-family: inherit;
          text-decoration: underline;
        }
        .link-btn:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
};

export default Auth;
