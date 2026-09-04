import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { handleBooking } from '../engines/AllocationEngine';
import { predictWaitingTime } from '../engines/PredictiveEngine';
import { syncStations } from '../services/chargingStationApi';
import { useAppState, appState } from '../services/appState';
import {
  getConnectorAvailability, calculateTotalPrice, calculateEnergyCost, parseBookingDateTime, SLOT_DURATION_MINUTES,
} from '../engines/ReservationEngine';
import { Calendar, Clock, CreditCard, CheckCircle, ChevronLeft, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';

const BookingFlow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stations, bookings, queue: queues } = useAppState();
  
  const [station, setStation] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedCharger, setSelectedCharger] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [bookingDetails, setBookingDetails] = useState(null);

  useEffect(() => {
    const loadStation = async () => {
      let found = stations.find(s => s.id === id);
      if (!found) {
        const { stations: synced } = await syncStations(null, true);
        found = (synced || []).find(s => s.id === id);
      }
      setStation(found);
      
      const tzOffset = (new Date()).getTimezoneOffset() * 60000;
      const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
      setSelectedDate(localISOTime);
    };
    if (id) loadStation();
  }, [id, stations]);

  // Compute requested time interval as Date objects for use with ReservationEngine
  const getRequestedInterval = () => {
    if (!selectedDate || !selectedTime) return null;
    const start = parseBookingDateTime(selectedDate, selectedTime);
    if (!start) return null;
    const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
    return { start, end };
  };

  // Per-connector availability using the centralized ReservationEngine
  const getConnectorAvailInfo = (chargerId) => {
    if (!station || !chargerId) return null;
    const connector = station.chargers?.find(c => c.id === chargerId);
    if (!connector) return null;
    const interval = getRequestedInterval();
    return getConnectorAvailability(
      connector, station,
      interval?.start || null, interval?.end || null,
      bookings
    );
  };

  // Deterministic price from ReservationEngine (no Math.random(), falls back to ₹8.5/kWh)
  const getEnergyCost = () => {
    if (!selectedCharger || !station) return null;
    const connector = station.chargers?.find(c => c.id === selectedCharger);
    return calculateEnergyCost(connector);
  };

  const getTotalPrice = () => {
    if (!selectedCharger || !station) return null;
    const connector = station.chargers?.find(c => c.id === selectedCharger);
    return calculateTotalPrice(connector);
  };

  // Current availability check for selected charger + selected time
  const selectedChargerAvailInfo = useMemo(() => {
    if (!selectedCharger || !selectedDate || !selectedTime || !station) return null;
    return getConnectorAvailInfo(selectedCharger);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharger, selectedDate, selectedTime, bookings, station]);

  const isSlotBlocked = selectedChargerAvailInfo && !selectedChargerAvailInfo.available;
  const slotBlockReason = selectedChargerAvailInfo?.reason || '';
  const slotBlockState = selectedChargerAvailInfo?.state || '';

  if (!station) return (
    <div className="page-layout booking-layout">
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: 'var(--text-muted)' }}>Loading station...</h2>
      </div>
    </div>
  );

  const handlePayment = async () => {
    // Final pre‑payment availability check (prevents race conditions)
    if (isSlotBlocked) {
      setError(slotBlockReason || 'This slot is no longer available.');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');

      // Ensure a valid authenticated user exists
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Your session has expired. Please log in again.');
      }
      const uid = currentUser.uid;

      // Build a complete user snapshot for the booking
      const userSnapshot = {
        userId: uid,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || currentUser.email || '',
        evModel: user?.evModel || 'Unknown EV',
      };

      // Simulate network delay (preserve original UX)
      await new Promise(r => setTimeout(r, 1200));

      const res = await handleBooking(
        station.id,
        selectedCharger,
        userSnapshot,
        selectedDate,
        selectedTime,
      );

      if (!res) {
        throw new Error('Booking service returned no response.');
      }

      if (res.error && !res.queued) {
        setError(res.error);
        return;
      }

      setBookingDetails({
        ...res,
        totalPaid: getTotalPrice(),
        queued: !!res.queued,
        position: res.position ?? null,
      });
      setStep(3);
    } catch (e) {
      console.error('[BOOKING CONFIRM ERROR]', e);
      setError(e?.message || 'Failed to create booking. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const waitPrediction = predictWaitingTime(station, bookings, queues);

  return (
    <div className="page-layout booking-layout">
      <Sidebar />
      <div className="main-content booking-content">
        {step < 3 && (
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ChevronLeft size={20} /> Back
          </button>
        )}

        <div className="booking-container">
          {/* Progress Header */}
          {step < 3 && (
            <div className="step-indicator">
              <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Select Slot</div>
              <div className={`step-line ${step >= 2 ? 'active-line' : ''}`}></div>
              <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Payment</div>
            </div>
          )}

          {step === 1 && (
            <div className="booking-step glass-panel">
              <h2 style={{ margin: '0 0 8px' }}>Reserve at {station.name}</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', fontSize: '0.95rem' }}>Select a charger and time for your session.</p>
              
              <div className="form-group mt-20">
                <label>Available Chargers</label>
                <div className="charger-options">
                  {station.chargers.map(c => {
                    const availInfo = selectedDate && selectedTime
                      ? getConnectorAvailInfo(c.id)
                      : null;
                    const isCurrentlyBlocked = availInfo ? !availInfo.available : false;
                    const isMaintOrOffline = c.operationalStatus === 'MAINTENANCE' || c.status === 'MAINTENANCE' || c.operationalStatus === 'OFFLINE' || c.status === 'OFFLINE';
                    const isSelected = selectedCharger === c.id;
                    const blockState = availInfo?.state || '';
                    
                    // Badge text and color
                    let badge = null;
                    if (isMaintOrOffline) {
                      badge = { text: c.status?.toUpperCase() || 'OFFLINE', color: 'var(--text-muted)' };
                    } else if (blockState === 'ACTIVE_BOOKING') {
                      badge = { text: 'IN USE', color: 'var(--status-red)' };
                    } else if (blockState === 'FUTURE_RESERVATION') {
                      badge = { text: 'RESERVED', color: '#f59e0b' };
                    } else if (blockState === 'DOUBLE_BOOKING') {
                      badge = { text: 'CONFLICT', color: 'var(--status-red)' };
                    } else if (!isCurrentlyBlocked && availInfo) {
                      badge = { text: 'AVAILABLE', color: 'var(--status-green)' };
                    }

                    return (
                      <div key={c.id}>
                        <div 
                          className={`charger-option ${isSelected ? 'selected' : ''} ${isCurrentlyBlocked || isMaintOrOffline ? 'dimmed' : ''}`}
                          onClick={() => !(isMaintOrOffline) && setSelectedCharger(c.id)}
                        >
                          <div className="co-left">
                            <div className="co-id">{c.id}</div>
                            <div className="co-info">
                              <strong style={{ color: isSelected ? 'var(--text-main)' : 'var(--text-muted)' }}>{c.type}</strong>
                              <span>{c.speed}</span>
                            </div>
                          </div>
                          <div className="co-right">
                            <span style={{ fontSize: '0.85rem' }}>{isNaN(parseFloat(c.price)) ? c.price : `₹${c.price}/kWh`}</span>
                            {badge && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: badge.color }}>{badge.text}</span>
                            )}
                          </div>
                        </div>
                        {/* Show detailed reason when this charger is selected and blocked */}
                        {isSelected && isCurrentlyBlocked && availInfo && (
                          <div style={{ margin: '4px 0 8px', padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: '0.83rem', color: '#f59e0b', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <strong>Slot unavailable</strong> — {availInfo.reason}
                              {availInfo.availableAfter && (
                                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                                  Available again after {availInfo.availableAfter.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              {blockState === 'FUTURE_RESERVATION' && (
                                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Try another available charger at this station.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="datetime-row mt-20">
                <div className="form-group">
                  <label><Calendar size={16}/> Date</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={selectedDate} />
                </div>
                <div className="form-group">
                  <label><Clock size={16}/> Expected Arrival Time</label>
                  <input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
                </div>
              </div>

              {waitPrediction.minutes > 0 && (
                <div className="wait-prediction-note">
                  <Clock size={18} />
                  <span>Estimated wait upon arrival: <strong>{waitPrediction.minutes} mins</strong></span>
                </div>
              )}

              <div className="grace-period-notice bg-primary-soft mt-20">
                <ShieldAlert className="text-primary" size={24} style={{ flexShrink: 0 }}/>
                <div>
                  <strong style={{ display: 'block', marginBottom: 4 }}>Dynamic Allocation Grace Period Active</strong>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>If you do not arrive within 15 minutes of your slot time, your reservation may be automatically allocated to the next user in the virtual queue.</p>
                </div>
              </div>

              <button 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '24px', padding: '14px', fontSize: '1rem' }}
                disabled={!selectedCharger || !selectedTime || !selectedDate || isSlotBlocked}
                onClick={() => setStep(2)}
              >
                Continue to Payment
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="booking-step glass-panel text-center payment-step">
              <h2 style={{ margin: '0 0 24px' }}>Confirm & Pay</h2>
              
              <div className="summary-box">
                <div className="summary-row">
                  <span className="s-label">Station</span>
                  <span className="s-value">{station.name}</span>
                </div>
                <div className="summary-row">
                  <span className="s-label">Charger ID</span>
                  <span className="s-value">{selectedCharger}</span>
                </div>
                <div className="summary-row">
                  <span className="s-label">Arrival Time</span>
                  <span className="s-value">{selectedDate} at {selectedTime}</span>
                </div>
                <div className="divider"></div>
                <div className="summary-row">
                  <span className="s-label">Est. Energy Cost (30kWh)</span>
                  <span className="s-value">₹{getEnergyCost()?.toFixed(2) || '255.00'}</span>
                </div>
                <div className="summary-row">
                  <span className="s-label">Convenience Fee</span>
                  <span className="s-value">₹25.00</span>
                </div>
                <div className="divider"></div>
                <div className="total-row">
                  <span>Total to Pay Now</span>
                  <span>₹{getTotalPrice()?.toFixed(2) || '280.00'}</span>
                </div>
              </div>

              {error && (
                <div className="error-banner mb-20" style={{ textAlign: 'left', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-red)', borderRadius: 8, display: 'flex', gap: 8 }}>
                  <ShieldAlert size={20} /> {error}
                </div>
              )}

              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? <span className="spinner"></span> : <><CreditCard size={20}/> Pay ₹{getTotalPrice()?.toFixed(2) || '280.00'} Securely</>}
              </button>
              
              <button 
                className="btn-secondary" 
                style={{ width: '100%', marginTop: '12px', padding: '14px' }} 
                onClick={() => { setStep(1); setError(''); }} 
                disabled={isProcessing}
              >
                Go Back
              </button>
            </div>
          )}

          {step === 3 && bookingDetails && (
            <div className="booking-step glass-panel text-center success-step" style={{ padding: '60px 40px' }}>
              <div className="icon-wrapper bg-primary-soft mx-auto" style={{ width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <CheckCircle className="text-primary" size={40} />
              </div>
              <h1 style={{ margin: '0 0 12px', fontSize: '2rem' }}>{bookingDetails.queued ? 'Waitlist Joined!' : 'Booking Request Sent!'}</h1>
              <p className="text-muted" style={{ fontSize: '1.1rem', margin: 0 }}>
                {bookingDetails.queued 
                  ? `You are at position #${bookingDetails.position} in the virtual queue for ${station.name}.`
                  : `Your slot request at ${station.name} is pending admin approval.`}
              </p>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)', marginTop: '8px' }}>Amount: ₹{bookingDetails.totalPaid}</p>
              
              <div className="qr-box mx-auto" style={{ marginTop: 32, marginBottom: 32 }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${bookingDetails.id}&bgcolor=ffffff&color=111111`} alt="Booking QR" style={{ borderRadius: 12 }}/>
                <p style={{ marginTop: 16, fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 600 }}>{bookingDetails.id}</p>
              </div>

              <div className="grace-period-notice bg-orange-soft" style={{ textAlign: 'left', margin: '0 auto 24px', maxWidth: 400 }}>
                <ShieldAlert size={24} style={{ color: 'var(--status-orange)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>Please arrive by <strong>{bookingDetails.time}</strong> on {bookingDetails.date}. Slots are released to the virtual queue after 15 mins of inactivity.</span>
              </div>

              <button className="btn-primary" style={{ width: '100%', maxWidth: 400, padding: '14px', fontSize: '1rem' }} onClick={() => navigate('/history')}>
                View in My Bookings
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .booking-layout { display: flex; height: 100vh; overflow: hidden; }
        .booking-content { flex: 1; margin-left: 260px; padding: 40px; overflow-y: auto; }
        
        .back-btn { display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 1rem; margin-bottom: 24px; padding: 0; background: none; border: none; cursor: pointer; transition: color 0.2s; }
        .back-btn:hover { color: var(--text-main); }
        
        .booking-container { max-width: 600px; margin: 0 auto; }
        
        .step-indicator { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
        .step { color: var(--text-muted); font-weight: 500; padding: 8px 16px; border-radius: var(--radius-full); background: rgba(255,255,255,0.05); }
        .step.active { color: var(--text-main); font-weight: 600; background: var(--primary-glow); border: 1px solid var(--primary-color); }
        .step-line { flex: 1; height: 2px; background: rgba(255,255,255,0.1); margin: 0 16px; transition: background 0.3s; }
        .step-line.active-line { background: var(--primary-color); }
        
        .booking-step { padding: 40px; border-radius: var(--radius-lg); }
        
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-center { text-align: center; }
        .mb-20 { margin-bottom: 20px; }
        
        .form-group label { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 12px; color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-main); color-scheme: dark; font-family: inherit; font-size: 1rem; }
        .form-group input:focus { border-color: var(--primary-color); outline: none; }
        
        .charger-options { display: flex; flex-direction: column; gap: 12px; }
        .charger-option { padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
        .charger-option:hover:not(.dimmed) { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.3); }
        .charger-option.selected { border-color: var(--primary-color); background: rgba(16, 185, 129, 0.1); box-shadow: 0 0 0 1px var(--primary-color); }
        .charger-option.dimmed { opacity: 0.5; }
        
        .co-left { display: flex; align-items: center; gap: 16px; }
        .co-id { font-weight: 700; background: var(--bg-secondary); padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); }
        .selected .co-id { background: var(--primary-color); color: white; border-color: var(--primary-color); }
        .co-info { display: flex; flex-direction: column; font-size: 0.9rem; color: var(--text-muted); }
        .co-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        
        .datetime-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        
        .wait-prediction-note { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: var(--radius-md); margin-top: 20px; color: var(--text-muted); font-size: 0.9rem; }
        .wait-prediction-note strong { color: var(--text-main); }
        
        .grace-period-notice { padding: 16px 20px; border-radius: var(--radius-md); display: flex; align-items: flex-start; gap: 16px; }
        
        .summary-box { background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 24px; text-align: left; margin-bottom: 24px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.95rem; }
        .summary-row:last-child { margin-bottom: 0; }
        .s-label { color: var(--text-muted); }
        .s-value { font-weight: 500; }
        .divider { height: 1px; background: var(--border-color); margin: 16px 0; }
        .total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 1.25rem; color: var(--primary-color); }
        
        .qr-box { background: white; padding: 24px; border-radius: 16px; display: inline-block; color: #111; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .qr-box p { margin: 0; }
        
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default BookingFlow;
