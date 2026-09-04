import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Map, History, Lightbulb, LogOut, Zap, Shield, Server, Users, BarChart3, Sliders } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  const role = user?.role || 'user';

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <NavLink 
          to={role === 'admin' ? '/admin' : '/dashboard'} 
          className="sidebar-logo" 
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Zap size={22} style={{ color: role === 'admin' ? '#8b5cf6' : 'var(--primary-color)' }} />
          <h2 className="logo">
            Charge<span style={{ color: role === 'admin' ? '#8b5cf6' : 'var(--primary-color)' }}>Spot</span>
          </h2>
        </NavLink>
      </div>

      <nav className="sidebar-menu">
        {/* User Role Links */}
        {role === 'user' && (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}>
              <LayoutDashboard size={20} /> Dashboard
            </NavLink>
            <NavLink to="/finder" className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}>
              <Map size={20} /> Find Chargers
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}>
              <History size={20} /> My Bookings
            </NavLink>
          </>
        )}



        {/* Admin Role Links */}
        {role === 'admin' && (
          <>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'menu-item active-admin' : 'menu-item'}>
              <Shield size={20} /> Admin Dashboard
            </NavLink>
            <NavLink to="/admin/smart-engine" className={({ isActive }) => isActive ? 'menu-item active-admin' : 'menu-item'}>
              <Sliders size={20} /> Smart Engine Config
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar" style={{ background: role === 'admin' ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))' }}>
            {initials}
          </div>
          <div className="user-info">
            <span className="name">{user?.name || 'User'}</span>
            <span className="car" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{role.replace('_', ' ')}</span>
          </div>
        </div>
        <button className="menu-item logout" onClick={handleLogout}>
          <LogOut size={20} /> Logout
        </button>
      </div>

      <style>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          position: fixed;
          top: 0; left: 0;
          display: flex;
          flex-direction: column;
          border-left: none;
          border-top: none;
          border-bottom: none;
          border-radius: 0;
          z-index: 100;
        }
        .sidebar-header { padding: 20px 24px; border-bottom: 1px solid var(--border-color); }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; }
        .logo { font-size: 1.4rem; font-weight: 700; margin: 0; }

        .sidebar-menu {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 16px;
          flex: 1;
          margin-top: 8px;
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-weight: 500;
          font-size: 0.95rem;
          transition: var(--transition-fast);
          text-decoration: none;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          width: 100%;
          font-family: inherit;
        }
        .menu-item:hover { color: var(--text-main); background: rgba(255,255,255,0.06); }
        .menu-item.active {
          background: rgba(16, 185, 129, 0.15);
          color: var(--primary-color);
          font-weight: 600;
        }
        .menu-item.active-op {
          background: rgba(245, 158, 11, 0.15);
          color: var(--status-orange);
          font-weight: 600;
        }
        .menu-item.active-admin {
          background: rgba(139, 92, 246, 0.15);
          color: #8b5cf6;
          font-weight: 600;
        }
        .menu-item.logout { color: var(--status-red); margin-top: 12px; }
        .menu-item.logout:hover { background: rgba(239,68,68,0.1); }

        .sidebar-footer { padding: 16px; border-top: 1px solid var(--border-color); }
        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: var(--radius-md);
          background: rgba(255,255,255,0.03);
          margin-bottom: 4px;
        }
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          color: white;
          flex-shrink: 0;
        }
        .user-info { display: flex; flex-direction: column; overflow: hidden; }
        .name { font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .car { font-size: 0.75rem; color: var(--text-muted); }
      `}</style>
    </div>
  );
};

export default Sidebar;
