import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { Shield, Users, Server, Zap, Calendar, Activity, Sliders, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { getAllBookings } from '../../engines/AllocationEngine';
import { getTotalActiveQueueCount, getStationQueueCount, getBookingTemporalState, deriveConnectorStatus } from '../../engines/StateEngine';
import { syncStations } from '../../services/chargingStationApi';
import { useAppState, appState } from '../../services/appState';
import { subscribeToBookings } from '../../services/firebaseBookings';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  const { stations, queue: queues } = useAppState();
  const [adminBookings, setAdminBookings] = useState([]);
  const bookings = adminBookings; // alias for UI calculations
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [stationSearchQuery, setStationSearchQuery] = useState('');

    // Effect: load stations (if needed) and subscribe to all bookings as admin
  useEffect(() => {
    if (stations.length === 0) {
      setLoading(true);
      syncStations(null, true).finally(() => setLoading(false));
    }
    const unsub = subscribeToBookings(setAdminBookings, true);
    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect: resolve Firestore users for current admin bookings and expire past bookings
  useEffect(() => {
    const resolveFirestoreUsers = async () => {
      try {
        const { getFirestore, doc, getDoc } = await import('firebase/firestore');
        const db = getFirestore();
        
        // Extract unique UIDs
        const uniqueUids = [...new Set(adminBookings.map(b => b.userId || b.uid || b.userUid).filter(Boolean))];
        
        // Fetch all users in parallel
        const userPromises = uniqueUids.map(async (uid) => {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const profile = userSnap.data();
            // Find an associated booking to fallback to its name if needed
            const b = adminBookings.find(bk => (bk.userId || bk.uid || bk.userUid) === uid);
            
            if (!profile.name) {
              profile.name = b?.userName || (profile.email ? profile.email.split('@')[0] : 'Unknown');
            }
            if (!profile.displayName) {
              profile.displayName = profile.name;
            }
            return { id: uid, ...profile };
          }
          return null;
        });

        const resolvedUsers = (await Promise.all(userPromises)).filter(Boolean);
        setUsers(resolvedUsers);
      } catch (err) {
        console.error('Error resolving Firestore users:', err);
        setUsers([]);
      }
    };
    resolveFirestoreUsers();
    // Expire any past bookings on dashboard load
    appState.sync();
  }, [adminBookings.length]);

  const handleRefresh = async () => {
    setLoading(true);
    await syncStations(null, true);
    setLoading(false);
  };

  // System stats
  const totalStations = stations.length;
  const totalChargers = stations.reduce((acc, s) => acc + (s.chargers?.length || 0), 0);
  
  const now = new Date();

  // Available = chargers that are physically operable and NOT actively occupied right now.
  // Future CONFIRMED reservations do NOT reduce availability until the booking window starts.
  const availableChargers = (() => {
    // Build a set of stationId+chargerId combos that are CURRENTLY ACTIVE (time window now open)
    const activeOccupancies = new Set();
    for (const b of bookings) {
      if (b.status !== 'CONFIRMED' && b.status !== 'ACTIVE') continue;
      const temporal = getBookingTemporalState(b, now);
      if (temporal === 'ACTIVE') {
        activeOccupancies.add(`${b.stationId}::${b.chargerId}`);
      }
    }
    return stations.reduce((acc, s) => {
      if (s.networkApiStatus === 'OFFLINE' || s.networkApiStatus === 'MAINTENANCE') return acc;
      const avail = (s.chargers || []).filter(c => {
        if (c.status === 'OFFLINE' || c.status === 'MAINTENANCE' ||
            c.operationalStatus === 'OFFLINE' || c.operationalStatus === 'MAINTENANCE') return false;
        if (activeOccupancies.has(`${s.id}::${c.id}`)) return false;
        return true;
      }).length;
      return acc + avail;
    }, 0);
  })();

  const totalBookings = bookings.length;
  
  const pendingBookingsCount = bookings.filter(b => b.status === 'PENDING').length;
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED' || getBookingTemporalState(b, now) === 'COMPLETED').length;
  const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED' || b.status === 'REJECTED').length;
  
  // Future confirmed reservations (not yet started) — informational
  const futureReservationsCount = bookings.filter(b => {
    if (b.status !== 'CONFIRMED') return false;
    return getBookingTemporalState(b, now) === 'FUTURE';
  }).length;

  // Active bookings = booking window is currently open (start <= now < end)
  const activeBookingsCount = bookings.filter(b => {
    if (b.status !== 'CONFIRMED' && b.status !== 'ACTIVE') return false;
    return getBookingTemporalState(b, now) === 'ACTIVE';
  }).length;
  
  const activeQueueCount = getTotalActiveQueueCount(bookings);
  const getBookingPriority = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return 1;
      case 'CONFIRMED': return 2;
      case 'ACTIVE': return 3;
      case 'IN_PROGRESS': return 4;
      case 'RESERVED': return 5;
      case 'CANCELLED': return 8;
      case 'COMPLETED': return 9;
      default: return 6; // Other non-terminal active states
    }
  };

  const sortAdminBookings = (bookingList) => {
    return [...bookingList].sort((a, b) => {
      const pA = getBookingPriority(a.status);
      const pB = getBookingPriority(b.status);
      
      if (pA !== pB) {
        return pA - pB;
      }

      const timeA = new Date(`${a.date} ${a.time || '00:00'}`).getTime();
      const timeB = new Date(`${b.date} ${b.time || '00:00'}`).getTime();

      if (isNaN(timeA) || isNaN(timeB)) {
        return b.id.localeCompare(a.id); 
      }

      if (pA >= 8) {
        // Completed/Cancelled: newest first (descending)
        return timeB - timeA;
      } else {
        // Active: earliest upcoming first (ascending)
        return timeA - timeB;
      }
    });
  };

  const sortedBookings = sortAdminBookings(bookings);

  return (
    <div className="page-layout admin-layout">
      <Sidebar />
      <div className="main-content admin-content">
        <header className="admin-header">
          <div>
            <h1 className="greeting" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Shield color="#8b5cf6" size={32} /> System Admin Control Panel
            </h1>
            <p className="text-muted" style={{ margin: 0 }}>
              Platform monitoring, user management, and Smart Engine controls
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" onClick={() => navigate('/admin/smart-engine')}>
              <Sliders size={18} /> Smart Engine Config
            </button>
            <button className="btn-secondary" onClick={handleRefresh}>
              <RefreshCw size={18} /> Refresh System
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Activity size={18} /> System Overview
          </button>
          <button className={`admin-tab ${activeTab === 'stations' ? 'active' : ''}`} onClick={() => setActiveTab('stations')}>
            <Server size={18} /> Stations ({totalStations})
          </button>
          <button className={`admin-tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
            <Calendar size={18} /> Bookings ({totalBookings})
          </button>
          <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <Users size={18} /> System Users
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="admin-body">
            <div className="admin-stats-grid">
              <div className="admin-stat-card glass-panel">
                <div className="stat-hdr"><Server size={20} color="var(--primary-color)"/> Stations</div>
                <div className="stat-num">{totalStations}</div>
                <div className="stat-sub">Connected Networks</div>
              </div>

              <div className="admin-stat-card glass-panel">
                <div className="stat-hdr"><Zap size={20} color="var(--status-green)"/> Available Chargers</div>
                <div className="stat-num text-primary">{availableChargers} / {totalChargers}</div>
                <div className="stat-sub">{futureReservationsCount > 0 ? `${futureReservationsCount} reserved for later` : 'Real-time Capacity'}</div>
              </div>

              <div className="admin-stat-card glass-panel">
                <div className="stat-hdr"><Calendar size={20} color="#3b82f6"/> Active Bookings</div>
                <div className="stat-num">{activeBookingsCount}</div>
                <div className="stat-sub">{completedBookings} completed · {futureReservationsCount} upcoming · {cancelledBookings} cancelled</div>
              </div>

              <div className="admin-stat-card glass-panel">
                <div className="stat-hdr"><Users size={20} color="var(--status-orange)"/> Pending Requests</div>
                <div className="stat-num">{activeQueueCount}</div>
                <div className="stat-sub">Users waiting for approval</div>
              </div>
            </div>

            {/* System Activity */}
            <div className="glass-panel" style={{ padding: 24, marginTop: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Recent Platform Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <CheckCircle size={18} color="var(--status-green)" />
                  <div>
                    <strong>System Heartbeat Normal</strong> — All 3 Smart Engines running (Availability, Predictive, Dynamic Allocation).
                  </div>
                </div>
                <div className="activity-item">
                  <Server size={18} color="var(--primary-color)" />
                  <div>
                    <strong>Open Charge Map Synchronization Active</strong> — {totalStations} location records processed.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stations Tab */}
        {activeTab === 'stations' && (
          <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Charging Stations Overview</h3>
              <input
                type="text"
                placeholder="Search by ID, Name, City..."
                value={stationSearchQuery}
                onChange={(e) => setStationSearchQuery(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', width: 250 }}
              />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Station Name</th>
                    <th>City</th>
                    <th>Network Status</th>
                    <th>Chargers</th>
                    <th>Queue</th>
                  </tr>
                </thead>
                <tbody>
                  {stations.filter(s => {
                    if (!stationSearchQuery) return true;
                    const q = stationSearchQuery.toLowerCase();
                    return (
                      s.name?.toLowerCase().includes(q) ||
                      s.city?.toLowerCase().includes(q) ||
                      s.id?.toLowerCase().includes(q)
                    );
                  }).map(s => (
                    <tr key={s.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.id.replace('OCM-', '')}</span></td>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.city}</td>
                      <td>
                        <select
                          className="admin-select"
                          value={s.networkApiStatus}
                          onChange={(e) => {
                            const val = e.target.value;
                            appState.updateStationNetworkStatus(s.id, val);
                            syncStations(null, true);
                          }}
                        >
                          <option value="AVAILABLE">AVAILABLE</option>
                          <option value="OCCUPIED">OCCUPIED</option>
                          <option value="OFFLINE">OFFLINE</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                        </select>
                      </td>
                      <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {s.chargers?.map(c => {
                              const derivedStatus = deriveConnectorStatus(c, s.id, bookings, now);
                              const derivedColor = derivedStatus === 'AVAILABLE' ? 'var(--status-green)' : derivedStatus === 'OCCUPIED' ? 'var(--status-red)' : derivedStatus === 'RESERVED' ? '#f59e0b' : 'var(--status-gray)';
                              return (
                              <div key={c.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>{c.id}</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: derivedColor }}>{derivedStatus}</span>
                                <select
                                  className="admin-select-small"
                                  value={c.operationalStatus || c.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    appState.updateConnectorStatus(s.id, c.id, val);
                                    syncStations(null, true);
                                  }}
                                >
                                  <option value="AVAILABLE">AVAIL ✓</option>
                                  <option value="CHARGING">CHARGING</option>
                                  <option value="MAINTENANCE">MAINT</option>
                                </select>
                              </div>
                            )})}
                          </div>
                      </td>
                      <td>{getStationQueueCount(s.id, bookings)} Waiting</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px' }}>All Platform Bookings</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>User</th>
                    <th>Station ID</th>
                    <th>Charger</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBookings.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No bookings recorded yet.</td></tr>
                  ) : (
                    sortedBookings.map(b => {
                      const bUser = users.find(u => u.id === (b.userId || b.uid || b.userUid));
                      const displayUser = bUser || (b.userName || b.name ? {
                        name: b.userName || b.name,
                        email: b.userEmail || b.email,
                        evModel: b.evModel
                      } : null);
                      return (
                        <tr key={b.id}>
                          <td><span style={{ fontFamily: 'monospace' }}>{b.id}</span></td>
                          <td>
                            {displayUser ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <strong>{displayUser.name || 'Unknown'}</strong>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{displayUser.email || 'No email'}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{displayUser.evModel || 'Unknown EV'}</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>User information unavailable</span>
                            )}
                          </td>
                          <td>{b.stationId}</td>
                          <td>{b.chargerId}</td>
                          <td>{b.date} at {b.time}</td>
                          <td>
                            <span className={`badge status-${b.status.toLowerCase()}`}>
                              {b.status}
                            </span>
                            {b.status === 'PENDING' && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <button 
                                  className="btn-primary" 
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={async () => {
                                    const { acceptBooking } = await import('../../engines/AllocationEngine');
                                    await acceptBooking(b.id);
                                    window.dispatchEvent(new Event('chargespot-state-changed'));
                                  }}
                                >Accept</button>
                                <button 
                                  style={{ background: 'transparent', border: '1px solid var(--status-red)', color: 'var(--status-red)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                  onClick={async () => {
                                    const { rejectBooking } = await import('../../engines/AllocationEngine');
                                    await rejectBooking(b.id);
                                    window.dispatchEvent(new Event('chargespot-state-changed'));
                                  }}
                                >Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px' }}>Registered Accounts & Roles</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>EV Model / Access</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20 }}>No registered users found.</td></tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <span className="badge" style={{ 
                            background: u.role === 'admin' ? 'rgba(139,92,246,0.2)' : 'var(--bg-primary-soft)', 
                            color: u.role === 'admin' ? '#8b5cf6' : 'var(--primary-color)' 
                          }}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                            <td>{u.name || u.displayName || (u.email ? u.email.split('@')[0] : 'Unknown')}</td>
                        <td>{u.email}</td>
                        <td>{u.role === 'admin' ? 'Full System Access' : (u.evModel || 'Unknown')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .admin-layout { display: flex; height: 100vh; background: var(--bg-color); }
        .admin-content { flex: 1; margin-left: 260px; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }

        .admin-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
        
        .admin-tabs { display: flex; gap: 8px; background: rgba(255,255,255,0.03); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-color); }
        .admin-tab { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: none; border: none; color: var(--text-muted); font-size: 0.95rem; font-weight: 500; cursor: pointer; border-radius: var(--radius-sm); font-family: inherit; transition: all 0.2s; }
        .admin-tab:hover { color: var(--text-main); }
        .admin-tab.active { background: #8b5cf6; color: white; font-weight: 600; }

        .admin-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .admin-stat-card { padding: 24px; display: flex; flex-direction: column; gap: 8px; }
        .stat-hdr { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .stat-num { font-size: 2.2rem; font-weight: 800; }
        .stat-sub { font-size: 0.8rem; color: var(--text-muted); }

        .activity-list { display: flex; flex-direction: column; gap: 12px; }
        .activity-item { display: flex; align-items: center; gap: 12px; font-size: 0.95rem; padding: 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); }

        .admin-table-wrap { overflow-x: auto; }
        .admin-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem; }
        .admin-table th { padding: 12px 16px; border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.78rem; }
        .admin-table td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); }
        .badge { padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
        .badge.status-confirmed { background: rgba(16,185,129,0.2); color: var(--status-green); }
        .badge.status-cancelled { background: rgba(239,68,68,0.2); color: var(--status-red); }
        
        .admin-select { background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
        .admin-select-small { background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-main); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem; width: 100%; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
