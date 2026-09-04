import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Battery, MapPin, Zap, ChevronRight, Clock, AlertTriangle, BatteryCharging, Search, RefreshCw } from 'lucide-react';
import { calculateAvailabilityConfidence } from '../engines/AvailabilityEngine';
import { predictWaitingTime, haversineDistance, recommendBestStation } from '../engines/PredictiveEngine';
import { appState } from '../services/appState';
import { getBookingTemporalState, getUserQueueEntries, getQueuePositionForBooking, getStationAvailableNow } from '../engines/StateEngine';
import { syncStations } from '../services/chargingStationApi';
import { useAppState } from '../services/appState';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { stations, bookings } = useAppState();
  const [recommended, setRecommended] = useState([]);
  
  const activeBookings = bookings.filter(b => {
    if (b.userId !== user?.id) return false;
    if (b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED') return false;
    
    const temporalState = getBookingTemporalState(b, new Date());
    return temporalState !== 'COMPLETED';
  });
  const userQueues = getUserQueueEntries(user?.id, bookings);
  
  const [locationStatus, setLocationStatus] = useState('pending'); // 'pending', 'granted', 'denied'
  const [userLocation, setUserLocation] = useState(null); // null or [lat, lng]
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [apiError, setApiError] = useState(null);
  

  // Helper to validate a station record before processing
  const isValidStation = (st) => {
    return (
      st &&
      typeof st === 'object' &&
      st.id &&
      st.name &&
      Array.isArray(st.coordinates) &&
      st.coordinates.length >= 2 &&
      typeof st.coordinates[0] === 'number' &&
      !isNaN(st.coordinates[0]) &&
      typeof st.coordinates[1] === 'number' &&
      !isNaN(st.coordinates[1]) &&
      Array.isArray(st.chargers)
    );
  };

  // Safe data loading function
  const loadData = useCallback(async (coords = null) => {
    setApiError(null);

    
    const refCoords = (coords && Array.isArray(coords) && coords.length >= 2) ? coords : null;

    if (!refCoords) {
      setRecommended([]);
      setIsLoadingStations(false);
      return;
    }

    try {
      setIsLoadingStations(true);
      // Always fetch nearby stations to ensure local coverage, even if global stations exist
      const { stations: fetchedStations, error } = await syncStations(refCoords, false);

      if (error && (!fetchedStations || fetchedStations.length === 0)) {
        setApiError(error);
        setRecommended([]);
        setIsLoadingStations(false);
        return;
      }
      
      let currentStations = fetchedStations || stations;

      // Filter valid stations (re-evaluating from global `stations` that got updated by syncStations)

      const validSts = Array.isArray(currentStations) ? currentStations.filter(isValidStation) : [];
      if (validSts.length > 0) {
        // 1. Calculate distance for every valid station using Haversine
        const withDistances = validSts.map(st => {
          const dist = haversineDistance(refCoords, st.coordinates);
          // Calculate availability and bookings
          const totalConnectors = st.chargers?.length || 1;
          const availableConnectors = (st.networkApiStatus === 'OFFLINE' || st.networkApiStatus === 'MAINTENANCE') ? 0 : getStationAvailableNow(st, bookings);
          const currentBookings = bookings.filter(b => b.stationId === st.id && (b.status === 'CONFIRMED' || b.status === 'AT_RISK')).length;
          
          // Basic heuristic score (lower is better): distance + penalty for low availability/high bookings
          const availabilityPenalty = (totalConnectors - availableConnectors) * 5;
          const bookingPenalty = currentBookings * 10;
          const rankScore = dist + availabilityPenalty + bookingPenalty;

          return {
            ...st,
            calculatedDistance: dist,
            totalConnectors,
            availableConnectors,
            currentBookings,
            rankScore
          };
        });

        // 2. Rank stations by generating recommendation score FIRST
        const processedWithScores = withDistances.map(st => {
          // Temporarily generate a waitPrediction to pass to sorting if necessary (handled in recommendBestStation usually)
          return st;
        });
        
        const currentBookings = appState.getBookings();
        const ranked = recommendBestStation(validSts, { ...user, currentLocation: refCoords }, currentBookings);

        // 3. Take EXACTLY top 3 nearest/best
        const top3Nearest = ranked.slice(0, 3);

        // 4. Attach formatted fields
        const processed = top3Nearest.map(st => {
          const waitPred = st.waitPrediction || predictWaitingTime(st, currentBookings);
          const avgP = (st.chargers && st.chargers.length > 0)
            ? (st.chargers.reduce((acc, c) => acc + (c?.price || 15), 0) / st.chargers.length).toFixed(2)
            : '20.00';
            
          return {
            ...st,
            distanceKm: st.distanceKm != null ? st.distanceKm.toFixed(1) : "0.0",
            waitPrediction: waitPred,
            avgPrice: avgP
          };
        });

        setRecommended(processed);
      } else {
        setRecommended([]);
      }
    } catch (err) {
      console.error("[UserDashboard] Error loading station data:", err);
      setApiError('Unable to load nearby charging stations');
      setRecommended([]);
    } finally {
      setIsLoadingStations(false);
    }
  }, [user]);

  // Request browser geolocation safely in useEffect
  const requestLocation = useCallback(() => {
    setLocationStatus('pending');
    if (!navigator || !navigator.geolocation) {
      console.warn("Geolocation API not supported");
      setLocationStatus('denied');
      setUserLocation(null);
      setIsLoadingStations(false);
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position?.coords?.latitude && position?.coords?.longitude) {
            const coords = [position.coords.latitude, position.coords.longitude];
            setUserLocation(coords);
            setLocationStatus('granted');
            loadData(coords);
          } else {
            setLocationStatus('denied');
            setUserLocation(null);
            setIsLoadingStations(false);
          }
        },
        (error) => {
          console.warn("Geolocation denied or error:", error.message);
          setLocationStatus('denied');
          setUserLocation(null);
          setIsLoadingStations(false);
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } catch (err) {
      console.warn("Geolocation exception:", err);
      setLocationStatus('denied');
      setUserLocation(null);
      setIsLoadingStations(false);
    }
  }, [loadData]);

  useEffect(() => {
    // Run sync once on mount, and then every minute to handle time-based state changes
    appState.sync();
    const intervalId = setInterval(() => {
      appState.sync();
    }, 60000);
    
    requestLocation();
    
    return () => clearInterval(intervalId);
  }, [requestLocation]);

  // Safe user fields
  const userName = user?.name ? user.name.split(' ')[0] : 'EV Driver';
  const batteryPct = typeof user?.currentBatteryPct === 'number' ? user.currentBatteryPct : 80;
  const evModel = user?.evModel || 'EV Vehicle';

  const getStatusColor = (status) => {
    if (status === 'AVAILABLE' || status === 'LIKELY AVAILABLE') return 'var(--status-green)';
    if (status === 'LIMITED' || status === 'LIKELY OCCUPIED') return 'var(--status-orange)';
    if (status === 'OFFLINE') return 'var(--status-gray)';
    return 'var(--status-red)';
  };

  const batteryColor =
    batteryPct > 50 ? 'var(--status-green)' :
    batteryPct > 20 ? 'var(--status-orange)' :
    'var(--status-red)';

  const needsCharge = batteryPct < 30;

  const getRecommendationSubtitle = () => {
    if (locationStatus === 'pending') {
      return 'Requesting location access...';
    }
    if (isLoadingStations) {
      return 'Finding charging stations near you...';
    }
    if (locationStatus === 'granted') {
      return 'Nearest charging stations to you';
    }
    return 'Location unavailable. Please use the Search a City feature in Find Chargers.';
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <div>
            <h1 className="greeting">Hi, {userName} 👋</h1>
            <p className="text-muted" style={{ margin: 0 }}>
              {needsCharge ? '⚡ Your battery is low — time to find a charger!' : 'Ready for your next charge?'}
            </p>
          </div>
          <div className="battery-widget glass-panel">
            <Battery style={{ color: batteryColor }} size={24} />
            <div className="battery-info">
              <span className="battery-pct" style={{ color: batteryColor }}>{batteryPct}%</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{evModel}</span>
            </div>
            <div className="battery-bar-container">
              <div className="battery-bar" style={{ width: `${batteryPct}%`, background: batteryColor }} />
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
        </div>

        {/* Active Queue Status */}
        {userQueues.length > 0 && (
          <section className="dash-section">
            <h2 className="section-title">Queue Status</h2>
            <div className="queue-cards">
              {userQueues.map(q => {
                const st = stations.find(s => s.id === q.stationId);
                const wait = st ? predictWaitingTime(st, bookings) : { minutes: '—' };
                const pos = getQueuePositionForBooking(q, bookings);
                return (
                  <div key={q.id} className="queue-card glass-panel">
                    <div className="queue-left">
                      <div className="queue-position">#{pos}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{st?.name || 'Station Queue'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <MapPin size={12} /> {st?.location || 'Nearby'}
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
                      <h3 style={{ margin: 0 }}>{st?.name || 'Charging Reservation'}</h3>
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
        {activeBookings.length === 0 && (
        <section className="dash-section">
          <div className="section-header">
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>Smart Recommendations</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {getRecommendationSubtitle()}
              </p>
            </div>
            <button className="text-btn" onClick={() => navigate('/finder')}>
              View all <ChevronRight size={16} />
            </button>
          </div>

          {/* Loading, Error or Content State */}
          {(locationStatus === 'pending' || (isLoadingStations && recommended.length === 0)) ? (
            <div className="glass-panel empty-rec">
              <div className="spinner" style={{ width: 32, height: 32, border: '3px solid rgba(16,185,129,0.3)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', marginBottom: 16 }}></div>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>Finding charging stations near you...</p>
            </div>
          ) : apiError ? (
            <div className="glass-panel empty-rec" style={{ padding: '40px 20px' }}>
              <AlertTriangle size={36} color="var(--status-red)" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Unable to load nearby charging stations</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: '0.95rem' }}>
                Could not connect to Open Charge Map. Please check your network or API key configuration.
              </p>
              <button className="btn-primary" onClick={() => loadData(userLocation)}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          ) : locationStatus === 'denied' ? (
            <div className="glass-panel empty-rec" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <MapPin size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Location Access Denied</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0 auto 20px', fontSize: '0.95rem', maxWidth: 400 }}>
                We couldn't access your location. To see smart recommendations, please enable location services in your browser settings.
              </p>
              <button className="btn-primary" onClick={() => navigate('/finder')}>
                <Search size={16} style={{ marginRight: 8 }} /> Search Manually in Find Chargers
              </button>
            </div>
          ) : recommended.length === 0 ? (
            <div className="glass-panel empty-rec">
              <Zap size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>No nearby charging stations found.</p>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => loadData(userLocation)}>Refresh Stations</button>
            </div>
          ) : (
            <div className="station-grid">
              {recommended.map(station => {
                const engineResult = calculateAvailabilityConfidence(station, bookings);
                const primaryCharger = station.chargers?.[0] || { type: 'CCS2', speed: '50 kW' };
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

                    <div className="card-stats" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', fontSize: '0.85rem' }}>
                      <div className="stat-item" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                        <MapPin size={14} /> Distance: {station.distanceKm} km
                      </div>
                      <div className="stat-item">
                        <Zap size={14} style={{ color: 'var(--text-muted)' }} /> Connectors: {engineResult.metrics?.availableConnectors ?? station.availableConnectors}/{engineResult.metrics?.totalConnectors ?? station.totalConnectors} free
                      </div>
                      <div className="stat-item">
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} /> Current bookings: {engineResult.metrics?.currentBookings ?? station.currentBookings}
                      </div>
                      <div className="stat-item">
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} /> Next available: {station.waitPrediction?.minutes > 0 ? `${station.waitPrediction.minutes} mins` : 'Now'}
                      </div>
                      <div className="stat-item">
                        <BatteryCharging size={14} style={{ color: 'var(--text-muted)' }} /> Price: ₹{station.avgPrice}/kWh
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>{primaryCharger.type}</span>
                      <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>{primaryCharger.speed}</span>
                    </div>

                    <div className="conf-bar-wrap" style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>ChargeSpot Confidence</span><span>{engineResult.score}%</span>
                      </div>
                      <div className="conf-bar-bg">
                        <div className="conf-bar-fill" style={{ width: `${engineResult.score}%`, background: getStatusColor(engineResult.status) }} />
                      </div>
                    </div>

                    <div className="card-actions" style={{ marginTop: 8 }}>
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
        )}
      </div>

      <style>{`
        .page-layout { display: flex; min-height: 100vh; background: var(--bg-color); }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; display: flex; flex-direction: column; gap: 32px; overflow-y: auto; }

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
        .section-title { font-size: 1.4rem; font-weight: 700; }
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
        .station-card { padding: 24px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; gap: 12px; }
        .station-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-glass), 0 0 20px rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); }

        .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .status-badge { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .card-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
        .stat-item { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-main); }

        .conf-bar-wrap { }
        .conf-bar-bg { width: 100%; height: 5px; background: rgba(255,255,255,0.08); border-radius: var(--radius-full); overflow: hidden; }
        .conf-bar-fill { height: 100%; border-radius: var(--radius-full); transition: width 0.8s ease; }

        .card-actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
        .card-book-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; font-size: 0.9rem; }
        .card-detail-btn { padding: 10px 16px; font-size: 0.9rem; }

        .empty-rec { padding: 60px 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1px dashed var(--border-color); }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default UserDashboard;
