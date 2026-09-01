import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Battery, MapPin, Zap, ChevronRight, Clock, AlertTriangle, Users, BatteryCharging, Search } from 'lucide-react';
import { calculateAvailabilityConfidence } from '../engines/AvailabilityEngine';
import { recommendBestStation, predictWaitingTime } from '../engines/PredictiveEngine';
import { checkNoShows, getActiveBookings, getUserQueues } from '../engines/AllocationEngine';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stations, setStations] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [userQueues, setUserQueues] = useState([]);

  const loadData = useCallback(() => {
    const sts = JSON.parse(localStorage.getItem('chargeSpotStations') || '[]');
    setStations(sts);

    // Run no-show check
    checkNoShows();

    if (user && sts.length) {
      const rec = recommendBestStation(sts, user).slice(0, 3);
      setRecommended(rec);
      setActiveBookings(getActiveBookings(user.id));
      setUserQueues(getUserQueues(user.id));
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  const getStatusColor = (status) => {
    if (status === 'AVAILABLE' || status === 'LIKELY AVAILABLE') return 'var(--status-green)';
    if (status === 'LIMITED' || status === 'LIKELY OCCUPIED') return 'var(--status-orange)';
    if (status === 'OFFLINE') return 'var(--status-gray)';
    return 'var(--status-red)';
  };

  const batteryColor =
    user.currentBatteryPct > 50 ? 'var(--status-green)' :
    user.currentBatteryPct > 20 ? 'var(--status-orange)' :
    'var(--status-red)';

  const needsCharge = user.currentBatteryPct < 30;

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <div>
            <h1 className="greeting">Hi, {user.name.split(' ')[0]} 👋</h1>
            <p className="text-muted" style={{ margin: 0 }}>
              {needsCharge ? '⚡ Your battery is low — time to find a charger!' : 'Ready for your next charge?'}
            </p>
          </div>
          <div className="battery-widget glass-panel">
            <Battery style={{ color: batteryColor }} size={24} />
            <div className="battery-info">
              <span className="battery-pct" style={{ color: batteryColor }}>{user.currentBatteryPct}%</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{user.evModel}</span>
            </div>
            <div className="battery-bar-container">
              <div className="battery-bar" style={{ width: `${user.currentBatteryPct}%`, background: batteryColor }} />
            </div>
          </div>
        </header>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="action-btn primary-action" onClick={() => navigate('/finder')}>
            <Search size={20} /> Find Charger
          </button>
          <button className="action-btn" onClick={() => navigate('/history')}>
            <Clock size={20} /> Booking History
          </button>
          <button className="action-btn" onClick={() => navigate('/demo')}>
            <Zap size={20} /> Smart Engine Demo
          </button>
        </div>

        {/* Active Queue Status */}
        {userQueues.length > 0 && (
          <section className="dash-section">
            <h2 className="section-title">Queue Status</h2>
            <div className="queue-cards">
              {userQueues.map(q => {
                const st = stations.find(s => s.id === q.stationId);
                const wait = st ? predictWaitingTime(st) : { minutes: '—' };
                return (
                  <div key={q.id} className="queue-card glass-panel">
                    <div className="queue-left">
                      <div className="queue-position">#{q.position}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{st?.name || 'Station'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <MapPin size={12} /> {st?.location}
                        </div>
                      </div>
                    </div>
                    <div className="queue-right">
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Est. wait</div>
                      <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{wait.minutes} min</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Active Bookings */}
        {activeBookings.length > 0 && (
          <section className="dash-section">
            <h2 className="section-title">Upcoming Reservations</h2>
            <div className="booking-cards">
              {activeBookings.map(bk => {
                const st = stations.find(s => s.id === bk.stationId);
                return (
                  <div key={bk.id} className={`booking-card glass-panel ${bk.status === 'AT_RISK' ? 'at-risk' : ''}`}>
                    <div className="booking-header">
                      <h3 style={{ margin: 0 }}>{st?.name || 'Unknown Station'}</h3>
                      <span className="time-badge">{bk.date} · {bk.time}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      Charger: <strong style={{ color: 'var(--text-main)' }}>{bk.chargerId}</strong>
                      &nbsp;·&nbsp; ID: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{bk.id}</span>
                    </div>
                    {bk.status === 'AT_RISK' && (
                      <div className="at-risk-warning">
                        <AlertTriangle size={14} /> Grace period ending — please arrive soon!
                      </div>
                    )}
                    <button className="btn-secondary view-btn" onClick={() => navigate(`/station/${bk.stationId}`)}>
                      View Station <ChevronRight size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recommended Stations */}
        <section className="dash-section">
          <div className="section-header">
            <h2 className="section-title" style={{ margin: 0 }}>Smart Recommendations</h2>
            <button className="text-btn" onClick={() => navigate('/finder')}>
              View all <ChevronRight size={16} />
            </button>
          </div>

          {recommended.length === 0 ? (
            <div className="glass-panel empty-rec">
              <Zap size={32} color="var(--text-muted)" />
              <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading recommendations...</p>
            </div>
          ) : (
            <div className="station-grid">
              {recommended.map(station => {
                const engineResult = calculateAvailabilityConfidence(station);
                return (
                  <div
                    key={station.id}
                    className="station-card glass-panel"
                    onClick={() => navigate(`/station/${station.id}`)}
                  >
                    <div className="card-top">
                      <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1rem', lineHeight: 1.3 }}>{station.name}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {station.location}, {station.city}
                        </p>
                      </div>
                      <div
                        className="status-badge"
                        style={{ background: `${getStatusColor(engineResult.status)}22`, color: getStatusColor(engineResult.status) }}
                      >
                        <div className="status-dot" style={{ background: getStatusColor(engineResult.status) }} />
                        {engineResult.status}
                      </div>
                    </div>

                    <div className="card-stats">
                      <div className="stat-item">
                        <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{station.distanceKm} km</span>
                      </div>
                      <div className="stat-item">
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{station.waitPrediction.minutes > 0 ? `${station.waitPrediction.minutes} min wait` : 'No wait'}</span>
                      </div>
                      <div className="stat-item">
                        <Zap size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>₹{station.avgPrice}/kWh</span>
                      </div>
                    </div>

                    {engineResult.hasConflict && (
                      <div className="conflict-note">
                        <AlertTriangle size={12} /> Data conflict detected — confidence adjusted
                      </div>
                    )}

                    <div className="conf-bar-wrap">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Confidence</span><span>{engineResult.score}%</span>
                      </div>
                      <div className="conf-bar-bg">
                        <div className="conf-bar-fill" style={{ width: `${engineResult.score}%`, background: getStatusColor(engineResult.status) }} />
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        className="btn-primary card-book-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/book/${station.id}`); }}
                      >
                        <BatteryCharging size={16} /> Book Now
                      </button>
                      <button
                        className="btn-secondary card-detail-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/station/${station.id}`); }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .page-layout { display: flex; min-height: 100vh; background: var(--bg-color); }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; display: flex; flex-direction: column; gap: 32px; }

        .dashboard-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
        .greeting { font-size: 2.2rem; font-weight: 700; margin: 0 0 8px; }

        .battery-widget { display: flex; align-items: center; gap: 14px; padding: 16px 24px; border-radius: var(--radius-lg); position: relative; overflow: hidden; min-width: 240px; }
        .battery-info { display: flex; flex-direction: column; }
        .battery-pct { font-size: 1.4rem; font-weight: 700; line-height: 1; }
        .battery-bar-container { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.08); }
        .battery-bar { height: 100%; transition: width 1s ease; }

        .quick-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .action-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 20px; border-radius: var(--radius-full);
          background: rgba(255,255,255,0.06); border: 1px solid var(--border-color);
          color: var(--text-muted); font-weight: 500; font-size: 0.95rem;
          cursor: pointer; font-family: inherit; transition: var(--transition-fast);
        }
        .action-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-main); }
        .primary-action { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: var(--primary-color); }
        .primary-action:hover { background: rgba(16,185,129,0.2); }

        .dash-section { display: flex; flex-direction: column; gap: 16px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; }
        .section-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 16px; }
        .text-btn { display: flex; align-items: center; gap: 4px; color: var(--primary-color); font-weight: 500; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.95rem; }

        .queue-cards { display: flex; flex-direction: column; gap: 12px; }
        .queue-card { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
        .queue-left { display: flex; align-items: center; gap: 16px; }
        .queue-position { width: 44px; height: 44px; border-radius: 50%; background: rgba(16,185,129,0.15); border: 2px solid var(--primary-color); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; color: var(--primary-color); flex-shrink: 0; }
        .queue-right { text-align: right; }

        .booking-cards { display: flex; flex-direction: column; gap: 12px; }
        .booking-card { padding: 20px; border-left: 4px solid var(--primary-color); }
        .booking-card.at-risk { border-left-color: var(--status-orange); }
        .booking-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .time-badge { background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: var(--radius-full); font-size: 0.85rem; }
        .at-risk-warning { display: flex; align-items: center; gap: 6px; color: var(--status-orange); font-size: 0.85rem; margin-top: 8px; font-weight: 500; }
        .view-btn { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 16px; font-size: 0.9rem; }

        .station-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .station-card { padding: 24px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; gap: 16px; }
        .station-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-glass), 0 0 20px rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); }

        .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .status-badge { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .card-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .stat-item { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-main); }

        .conflict-note { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--status-orange); background: rgba(245,158,11,0.08); padding: 8px 12px; border-radius: var(--radius-sm); }

        .conf-bar-wrap { }
        .conf-bar-bg { width: 100%; height: 5px; background: rgba(255,255,255,0.08); border-radius: var(--radius-full); overflow: hidden; }
        .conf-bar-fill { height: 100%; border-radius: var(--radius-full); transition: width 0.8s ease; }

        .card-actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
        .card-book-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; font-size: 0.9rem; }
        .card-detail-btn { padding: 10px 16px; font-size: 0.9rem; }

        .empty-rec { padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      `}</style>
    </div>
  );
};

export default UserDashboard;
