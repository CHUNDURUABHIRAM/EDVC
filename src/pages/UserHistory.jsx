import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { getAllBookings, cancelBooking } from '../engines/AllocationEngine';
import { Calendar, MapPin, Zap, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';

const UserHistory = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [stations, setStations] = useState([]);

  useEffect(() => {
    if (user) {
      // Sort bookings by creation date descending
      const bks = getAllBookings(user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBookings(bks);
    }
    const sts = JSON.parse(localStorage.getItem('chargeSpotStations') || '[]');
    setStations(sts);
  }, [user]);

  const handleCancel = (bookingId) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      const updated = cancelBooking(bookingId);
      // Filter for this user and sort again
      const myUpdated = updated
        .filter(b => b.userId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBookings(myUpdated);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'CONFIRMED' || status === 'COMPLETED') return <CheckCircle size={24} style={{ color: 'var(--status-green)' }} />;
    if (status === 'AT_RISK') return <AlertTriangle size={24} style={{ color: 'var(--status-orange)' }} />;
    return <XCircle size={24} style={{ color: 'var(--status-red)' }} />;
  };

  const totalSessions = bookings.length;
  // Estimate: 30 kWh per completed/confirmed session
  const activeAndCompleted = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'AT_RISK');
  const energyCharged = activeAndCompleted.length * 30;
  // Estimate: 20 mins saved per session
  const waitSaved = activeAndCompleted.length * 20;

  return (
    <div className="page-layout history-layout">
      <Sidebar />
      <div className="main-content history-content">
        <h1 className="page-title">Booking History</h1>
        
        <div className="stats-row mb-40">
          <div className="stat-card glass-panel">
            <div className="stat-label">Total Bookings</div>
            <div className="stat-val">{totalSessions}</div>
          </div>
          <div className="stat-card glass-panel">
            <div className="stat-label">Est. Energy (kWh)</div>
            <div className="stat-val text-primary">{energyCharged}</div>
          </div>
          <div className="stat-card glass-panel">
            <div className="stat-label">Wait Time Saved</div>
            <div className="stat-val">{waitSaved} mins</div>
          </div>
        </div>

        <div className="bookings-list">
          {bookings.length === 0 ? (
            <div className="empty-state glass-panel text-center">
              <Calendar size={48} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-16" />
              <h3 style={{ margin: '0 0 8px' }}>No bookings yet</h3>
              <p className="text-muted" style={{ margin: 0 }}>Your reservation history will appear here.</p>
            </div>
          ) : (
            bookings.map(bk => {
              const st = stations.find(s => s.id === bk.stationId);
              return (
                <div key={bk.id} className={`history-card glass-panel status-${bk.status.toLowerCase()}`}>
                  <div className="hc-left">
                    <div className="hc-icon">
                      {getStatusIcon(bk.status)}
                    </div>
                    <div className="hc-info">
                      <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>{st?.name || 'Unknown Station'}</h3>
                      <p className="text-muted" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                        <MapPin size={14}/> {st?.location || 'Unknown location'}
                      </p>
                      <div className="hc-details">
                        <span className="detail-pill"><Calendar size={14}/> {bk.date} at {bk.time}</span>
                        <span className="detail-pill"><Zap size={14}/> Charger {bk.chargerId}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="hc-right">
                    <div className="hc-status">{bk.status.replace('_', ' ')}</div>
                    <div className="hc-id">ID: {bk.id}</div>
                    
                    {bk.status === 'CONFIRMED' && (
                      <button className="cancel-btn" onClick={() => handleCancel(bk.id)}>
                        <Trash2 size={14} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .history-layout { display: flex; height: 100vh; overflow: hidden; }
        .history-content { flex: 1; margin-left: 260px; overflow-y: auto; padding: 40px; }
        
        .page-title { margin-top: 0; margin-bottom: 30px; font-size: 2.2rem; }
        .mb-40 { margin-bottom: 40px; }
        .mb-16 { margin-bottom: 16px; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-center { text-align: center; }
        
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .stat-card { padding: 24px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
        .stat-label { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
        .stat-val { font-size: 2.5rem; font-weight: 800; line-height: 1; }
        
        .empty-state { padding: 80px 40px; }
        
        .bookings-list { display: flex; flex-direction: column; gap: 16px; }
        .history-card { padding: 24px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid transparent; transition: transform 0.2s; gap: 20px; }
        .history-card:hover { transform: translateX(4px); }
        .history-card.status-confirmed { border-left-color: var(--status-green); }
        .history-card.status-at_risk { border-left-color: var(--status-orange); }
        .history-card.status-released, .history-card.status-cancelled { border-left-color: var(--status-red); opacity: 0.7; }
        .history-card.status-completed { border-left-color: var(--status-green); opacity: 0.8; }
        
        .hc-left { display: flex; gap: 20px; align-items: flex-start; }
        .hc-icon { width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        .hc-info { display: flex; flex-direction: column; }
        .hc-details { display: flex; gap: 12px; font-size: 0.85rem; font-weight: 500; flex-wrap: wrap; }
        .detail-pill { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: var(--radius-full); }
        
        .hc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .hc-status { font-weight: 700; font-size: 1.1rem; color: var(--text-main); }
        .status-confirmed .hc-status, .status-completed .hc-status { color: var(--status-green); }
        .status-at_risk .hc-status { color: var(--status-orange); }
        .status-released .hc-status, .status-cancelled .hc-status { color: var(--status-red); }
        
        .hc-id { font-family: monospace; color: var(--text-muted); font-size: 0.9rem; }
        
        .cancel-btn { display: flex; align-items: center; gap: 6px; background: rgba(239, 68, 68, 0.1); color: var(--status-red); border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 12px; border-radius: var(--radius-md); font-size: 0.85rem; cursor: pointer; transition: all 0.2s; font-family: inherit; font-weight: 600; margin-top: 4px; }
        .cancel-btn:hover { background: rgba(239, 68, 68, 0.2); }
      `}</style>
    </div>
  );
};

export default UserHistory;
