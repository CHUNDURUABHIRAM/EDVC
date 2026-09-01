import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { handleBooking } from '../engines/AllocationEngine';
import { predictWaitingTime } from '../engines/PredictiveEngine';
import { Calendar, Clock, CreditCard, CheckCircle, ChevronLeft, ShieldAlert, Zap } from 'lucide-react';

const BookingFlow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [station, setStation] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedCharger, setSelectedCharger] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [bookingDetails, setBookingDetails] = useState(null);

  useEffect(() => {
    const sts = JSON.parse(localStorage.getItem('chargeSpotStations') || '[]');
    const found = sts.find(s => s.id === id);
    setStation(found);
    
    // Default to today
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    setSelectedDate(localISOTime);
  }, [id]);

  if (!station) return (
    <div className="page-layout booking-layout">
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: 'var(--text-muted)' }}>Loading station...</h2>
      </div>
    </div>
  );

  const getEstimatedPrice = () => {
    if (!selectedCharger) return 0;
    const charger = station.chargers.find(c => c.id === selectedCharger);
    // Rough estimate: assume 30 kWh needed
    return charger ? (charger.price * 30).toFixed(2) : 0;
  };

  const handlePayment = async () => {
    setError('');
    setIsProcessing(true);
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1200)); 
    
    const res = handleBooking(station.id, selectedCharger, user.id, selectedDate, selectedTime);
    
    setIsProcessing(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setBookingDetails(res);
      setStep(3); // Success
    }
  };

  const waitPrediction = predictWaitingTime(station);

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
                    const isAvail = c.status === 'AVAILABLE';
                    const isSelected = selectedCharger === c.id;
                    return (
                      <div 
                        key={c.id} 
                        className={`charger-option ${isSelected ? 'selected' : ''} ${!isAvail ? 'dimmed' : ''}`}
                        onClick={() => setSelectedCharger(c.id)}
                      >
                        <div className="co-left">
                          <div className="co-id">{c.id}</div>
                          <div className="co-info">
                            <strong style={{ color: isSelected ? 'var(--text-main)' : 'var(--text-muted)' }}>{c.type}</strong>
                            <span>{c.speed}</span>
                          </div>
                        </div>
                        <div className="co-right">
                          <span style={{ fontSize: '0.85rem' }}>₹{c.price}/kWh</span>
                          {!isAvail && <span style={{ fontSize: '0.75rem', color: 'var(--status-orange)', fontWeight: 600 }}>IN USE</span>}
                        </div>
                      </div>
                    )
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
                disabled={!selectedCharger || !selectedTime || !selectedDate}
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
                  <span className="s-value">₹{getEstimatedPrice()}</span>
                </div>
                <div className="summary-row">
                  <span className="s-label">Convenience Fee</span>
                  <span className="s-value">₹25.00</span>
                </div>
                <div className="divider"></div>
                <div className="total-row">
                  <span>Total to Pay Now</span>
                  <span>₹25.00</span>
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
                {isProcessing ? <span className="spinner"></span> : <><CreditCard size={20}/> Pay ₹25.00 Securely</>}
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
              <h1 style={{ margin: '0 0 12px', fontSize: '2rem' }}>Booking Confirmed!</h1>
              <p className="text-muted" style={{ fontSize: '1.1rem' }}>Your slot at {station.name} has been reserved.</p>
              
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
