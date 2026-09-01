import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { calculateAvailabilityConfidence } from '../engines/AvailabilityEngine';
import { predictWaitingTime } from '../engines/PredictiveEngine';
import { joinQueue, leaveQueue, getQueuePosition, getQueueLength } from '../engines/AllocationEngine';
import { MapPin, Clock, Zap, Star, ShieldCheck, ChevronLeft, Navigation, AlertTriangle, Coffee, Wifi, Car, BatteryCharging, Users } from 'lucide-react';

const icons = {
  "Cafe": <Coffee size={18}/>,
  "Wifi": <Wifi size={18}/>,
  "Parking": <Car size={18}/>,
  "Shopping": <Star size={18}/>,
  "Restrooms": <Car size={18}/>,
  "Food Court": <Coffee size={18}/>,
  "Premium Lounge": <Star size={18}/>,
  "Scenic View": <Star size={18}/>,
  "Mall": <Star size={18}/>
};

const StationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [station, setStation] = useState(null);
  const [queuePos, setQueuePos] = useState(null);
  const [qLength, setQLength] = useState(0);

  useEffect(() => {
    const sts = JSON.parse(localStorage.getItem('chargeSpotStations') || '[]');
    const found = sts.find(s => s.id === id);
    setStation(found);
    
    if (user && found) {
      setQueuePos(getQueuePosition(found.id, user.id));
      setQLength(getQueueLength(found.id));
    }
  }, [id, user]);

  if (!station) return (
    <div className="page-layout details-layout">
      <Sidebar />
      <div className="main-content details-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: 'var(--text-muted)' }}>Loading station...</h2>
      </div>
    </div>
  );

  const engineResult = calculateAvailabilityConfidence(station);
  const waitPrediction = predictWaitingTime(station);
  
  const getStatusColor = (status) => {
    if (status === "AVAILABLE" || status === "LIKELY AVAILABLE") return "var(--status-green)";
    if (status === "LIMITED" || status === "LIKELY OCCUPIED") return "var(--status-orange)";
    if (status === "OFFLINE") return "var(--status-gray)";
    return "var(--status-red)";
  };

  const handleJoinQueue = () => {
    const res = joinQueue(station.id, user.id);
    if (res.success) {
      setQueuePos(res.position);
      setQLength(getQueueLength(station.id));
    } else {
      alert(res.error);
    }
  };

  const handleLeaveQueue = () => {
    leaveQueue(station.id, user.id);
    setQueuePos(null);
    setQLength(getQueueLength(station.id));
  };

  return (
    <div className="page-layout details-layout">
      <Sidebar />
      <div className="main-content details-content">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} /> Back
        </button>

        <div className="details-header glass-panel">
          <div className="title-row">
            <h1>{station.name}</h1>
            <div className="rating">
              <Star className="text-warning" size={20} fill="#f59e0b" />
              <span>{station.rating}</span>
            </div>
          </div>
          <p className="text-muted flex-row"><MapPin size={16}/> {station.location}, {station.city}</p>
          
          <div className="action-row">
            <button className="btn-primary" onClick={() => navigate(`/book/${station.id}`)}>
              <BatteryCharging size={18}/> Book Slot
            </button>
            <button className="btn-secondary" onClick={() => window.open(`https://maps.google.com/?q=${station.coordinates[0]},${station.coordinates[1]}`, '_blank')}>
              <Navigation size={18}/> Navigate
            </button>
          </div>
        </div>

        <div className="details-grid">
          {/* Smart Engine Status Panel */}
          <div className="smart-status-panel glass-panel">
            <div className="panel-hdr flex-row">
              <ShieldCheck className="text-primary" size={24}/>
              <h3>Smart Availability Engine</h3>
            </div>
            
            <div className="confidence-meter-container">
               <div className="meter-label">Confidence Score</div>
               <div className="meter-value" style={{ color: getStatusColor(engineResult.status) }}>
                 {engineResult.score}%
               </div>
               <div className="meter-bar-bg">
                 <div className="meter-bar-fill" style={{ width: `${engineResult.score}%`, backgroundColor: getStatusColor(engineResult.status) }}></div>
               </div>
               <div className="meter-text">System Status: <strong style={{ color: getStatusColor(engineResult.status) }}>{engineResult.status}</strong></div>
            </div>

            <div className="signals-breakdown">
              <h4>Active Signals:</h4>
              <ul>
                {engineResult.reasons.map((r, i) => (
                  <li key={i}><div className="dot"></div> {r}</li>
                ))}
              </ul>
              {engineResult.hasConflict && (
                <div className="conflict-alert bg-orange-soft text-orange">
                  <AlertTriangle size={20}/> 
                  Anomaly detected in incoming data signals. Score adjusted.
                </div>
              )}
            </div>
          </div>

          <div className="details-column">
            {/* Quick Info & Queue */}
            <div className="quick-info glass-panel">
              <div className="info-block">
                <Clock size={20} className="text-muted"/>
                <div>
                  <div className="info-title">Waiting Time</div>
                  <div className="info-val">{waitPrediction.minutes > 0 ? `${waitPrediction.minutes} mins` : 'No wait'}</div>
                </div>
              </div>
              <div className="info-block">
                <Users size={20} className="text-muted"/>
                <div>
                  <div className="info-title">Virtual Queue</div>
                  <div className="info-val">{qLength} waiting</div>
                </div>
              </div>
            </div>

            {/* Queue Actions */}
            {engineResult.status !== 'AVAILABLE' && (
              <div className="queue-panel glass-panel mt-20">
                <div className="queue-header">
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Virtual Queue</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Get notified when a slot opens up.</p>
                  </div>
                  {queuePos ? (
                    <div className="queue-badge bg-primary-soft text-primary">
                      Position #{queuePos}
                    </div>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={handleJoinQueue}>Join Queue</button>
                  )}
                </div>
                {queuePos && (
                  <div className="queue-active mt-16">
                    <p style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>You will be notified when it's your turn.</p>
                    <button className="btn-secondary btn-sm" onClick={handleLeaveQueue}>Leave Queue</button>
                  </div>
                )}
              </div>
            )}

            {/* Chargers */}
            <div className="chargers-list glass-panel mt-20">
              <h3>Chargers ({station.chargers.length})</h3>
              <div className="charger-grid">
                {station.chargers.map(c => {
                  const cColor = c.status === 'AVAILABLE' ? 'var(--status-green)' : c.status === 'OFFLINE' ? 'var(--status-gray)' : 'var(--status-red)';
                  return (
                    <div key={c.id} className="charger-card">
                      <div className="c-head">
                        <span className="c-id">{c.id}</span>
                        <span className="badge-status" style={{ backgroundColor: `${cColor}22`, color: cColor }}>{c.status}</span>
                      </div>
                      <div className="c-body">
                        <div>Type: <strong>{c.type}</strong></div>
                        <div>Speed: <strong>{c.speed}</strong></div>
                        <div>₹{c.price}/kWh</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Amenities */}
            {station.amenities && station.amenities.length > 0 && (
              <div className="amenities glass-panel mt-20">
                <h3>Amenities</h3>
                <div className="amenity-tags">
                  {station.amenities.map(a => (
                    <div key={a} className="amenity-tag">
                      {icons[a] || <Star size={18}/>} {a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .details-layout { display: flex; height: 100vh; overflow: hidden; }
        .details-content { flex: 1; margin-left: 260px; overflow-y: auto; padding: 40px; padding-bottom: 100px; display: flex; flex-direction: column; gap: 24px; }
        
        .back-btn { display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 1rem; margin-bottom: 8px; width: fit-content; padding: 0; background: none; border: none; cursor: pointer; transition: color 0.2s; }
        .back-btn:hover { color: var(--text-main); }
        
        .details-header { padding: 30px; display: flex; flex-direction: column; gap: 16px; border-top: 4px solid var(--primary-color); }
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .title-row h1 { margin: 0; font-size: 2rem; }
        .rating { display: flex; align-items: center; gap: 6px; font-size: 1.25rem; font-weight: 600; }
        .flex-row { display: flex; align-items: center; gap: 8px; margin: 0; }
        
        .action-row { display: flex; gap: 16px; margin-top: 16px; }
        .btn-primary, .btn-secondary { display: flex; align-items: center; gap: 8px; }
        .btn-sm { padding: 8px 16px; font-size: 0.9rem; }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        
        .smart-status-panel { padding: 30px; position: relative; overflow: hidden; height: fit-content; }
        .smart-status-panel::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 100%; background: radial-gradient(circle at top right, rgba(16, 185, 129, 0.1), transparent 50%); z-index: -1; }
        .panel-hdr { margin-bottom: 30px; }
        .panel-hdr h3 { margin: 0; font-size: 1.3rem; }
        
        .confidence-meter-container { text-align: center; margin-bottom: 30px; }
        .meter-label { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .meter-value { font-size: 4rem; font-weight: 800; line-height: 1; margin-bottom: 16px; text-shadow: 0 0 20px currentColor; }
        .meter-bar-bg { width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: var(--radius-full); overflow: hidden; margin-bottom: 12px; }
        .meter-bar-fill { height: 100%; transition: width 1s ease-out; }
        .meter-text { font-size: 1.1rem; }
        
        .signals-breakdown h4 { margin-top: 0; margin-bottom: 16px; font-size: 1rem; color: var(--text-muted); }
        .signals-breakdown ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .signals-breakdown li { display: flex; align-items: center; gap: 12px; font-size: 0.95rem; color: var(--text-muted); }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
        
        .conflict-alert { display: flex; align-items: flex-start; gap: 10px; padding: 16px; border-radius: var(--radius-md); margin-top: 20px; font-size: 0.9rem; line-height: 1.5; }
        
        .details-column { display: flex; flex-direction: column; gap: 24px; }
        .quick-info { display: flex; gap: 24px; padding: 24px; }
        .info-block { display: flex; align-items: center; gap: 16px; flex: 1; }
        .info-title { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-val { font-weight: 600; font-size: 1.1rem; }
        
        .queue-panel { padding: 24px; border: 1px solid var(--border-color); }
        .queue-header { display: flex; justify-content: space-between; align-items: center; }
        .queue-badge { padding: 8px 16px; border-radius: var(--radius-full); font-weight: 700; font-size: 0.9rem; border: 1px solid currentColor; }
        .queue-active { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); }
        
        .chargers-list { padding: 24px; }
        .chargers-list h3 { margin: 0 0 20px 0; font-size: 1.2rem; }
        .charger-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .charger-card { background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; }
        .c-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .c-id { font-weight: 700; font-size: 1.1rem; }
        .badge-status { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
        .c-body { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: var(--text-muted); }
        .c-body strong { color: var(--text-main); }
        
        .amenities { padding: 24px; }
        .amenities h3 { margin: 0 0 20px 0; font-size: 1.2rem; }
        .amenity-tags { display: flex; flex-wrap: wrap; gap: 12px; }
        .amenity-tag { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(255,255,255,0.05); border-radius: var(--radius-full); font-size: 0.95rem; }
        
        .mt-16 { margin-top: 16px; }
        .mt-20 { margin-top: 20px; }
      `}</style>
    </div>
  );
};

export default StationDetails;
