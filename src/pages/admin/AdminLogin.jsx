import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    isLoggedIn,
    user,
    loginAsAdmin
  } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  // If already authenticated, redirect according to role.
  useEffect(() => {
    if (isLoggedIn && user) {
      const defaultPath =
        user.role === 'admin'
          ? '/admin'
          : '/dashboard';

      const from =
        location.state?.from?.pathname || defaultPath;

      navigate(from, { replace: true });
    }
  }, [isLoggedIn, user, navigate, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));

    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      const result = await loginAsAdmin(
        form.email.trim(),
        form.password
      );

      if (!result.success) {
        setError(
          result.error || 'Invalid admin credentials.'
        );
        return;
      }

      // Firebase authentication + Firestore role
      // verification succeeded.
      navigate('/admin', { replace: true });

    } catch (err) {
      console.error('Admin login error:', err);

      setError(
        'Unable to login. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="auth-container blur-bg"
      style={{
        '--primary-glow': 'rgba(139, 92, 246, 0.4)',
        '--primary-color': '#8b5cf6'
      }}
    >
      <div
        className="auth-card glass-panel"
        style={{
          borderTop: '4px solid #8b5cf6'
        }}
      >
        <div
          className="auth-brand"
          style={{
            justifyContent: 'center',
            marginBottom: '10px'
          }}
        >
          <div
            className="brand-icon"
            style={{
              background:
                'linear-gradient(135deg, #8b5cf6, #6366f1)',
              boxShadow:
                '0 0 20px rgba(139, 92, 246, 0.4)'
            }}
          >
            <Zap size={26} color="white" />
          </div>

          <div>
            <h1 className="brand-name">
              Charge
              <span style={{ color: '#8b5cf6' }}>
                Spot
              </span>
            </h1>

            <p className="brand-tag">
              Administration Portal
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
          style={{ marginTop: '20px' }}
        >
          {/* Admin Email */}
          <div className="input-group">
            <Mail
              className="input-icon"
              size={18}
            />

            <input
              name="email"
              type="email"
              placeholder="Admin Email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          {/* Admin Password */}
          <div className="input-group">
            <Lock
              className="input-icon"
              size={18}
            />

            <input
              name="password"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="eye-btn"
              onClick={() =>
                setShowPassword(
                  (current) => !current
                )
              }
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
            >
              {showPassword ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="error-banner"
              style={{
                background:
                  'rgba(239, 68, 68, 0.1)',
                color: 'var(--status-red)',
                border:
                  '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Login */}
          <button
            type="submit"
            className="btn-primary submit-btn"
            style={{
              background: '#8b5cf6',
              borderColor: '#7c3aed'
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="spinner" />
            ) : (
              'Secure Admin Login'
            )}
          </button>
        </form>

        <div className="secondary-nav">
          <p className="secondary-text">
            Are you an EV User?
          </p>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate('/auth')}
          >
            <ArrowLeft size={16} />
            Go to User Login
          </button>
        </div>
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
            radial-gradient(
              circle at 50% 50%,
              rgba(139, 92, 246, 0.15) 0%,
              transparent 70%
            );
          z-index: -1;
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 20px;
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
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
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
          border-color: #8b5cf6;
          background: rgba(255,255,255,0.08);
          box-shadow:
            0 0 0 3px rgba(139, 92, 246, 0.2);
          outline: none;
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

        .eye-btn:hover {
          color: var(--text-main);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
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
          border-radius: var(--radius-md);
          color: white;
          cursor: pointer;
          font-weight: 600;
          border: 1px solid;
          transition: all 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #7c3aed;
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .secondary-nav {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 24px;
        }

        .secondary-text {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .secondary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 1px solid rgba(139, 92, 246, 0.5);
          color: #c4b5fd;
          border-radius: var(--radius-md);
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .secondary-btn:hover {
          background: rgba(139, 92, 246, 0.1);
          border-color: #8b5cf6;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default AdminLogin;