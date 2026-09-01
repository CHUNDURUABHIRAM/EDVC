import React, { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { calculateAvailabilityConfidence } from '../engines/AvailabilityEngine';
import { predictWaitingTime } from '../engines/PredictiveEngine';
import { ShieldCheck, Activity, Users, Radio, AlertTriangle, Clock, Zap } from 'lucide-react';

const InnovationDemo = () => {
  // Configurable mock station for demo
  const [stationConfig, setStationConfig] = useState({
    id: "DEMO-001",
    name: "Interactive AI Test Node",
    chargers: [{id: "C1"}, {id: "C2"}, {id: "C3"}, {id: "C4"}],
    networkApiStatus: "AVAILABLE",
    activeSessions: 1,
    recentActivity: "LOW",
    bookingQueue: 0,
    historicalDurations: [30, 45, 20]
  });

  const engineResult = calculateAvailabilityConfidence(stationConfig);
  const waitPrediction = predictWaitingTime(stationConfig);

  const getConfidenceColor = (score) => {
    if (score >= 70) return "var(--status-green)";
    if (score >= 40) return "var(--status-orange)";
    return "var(--status-red)";
  };

  const handleChargerCountChange = (val) => {
    const num = parseInt(val);
    const newChargers = Array(num).fill(0).map((_, i) => ({ id: `C${i+1}` }));
    setStationConfig({
      ...stationConfig,
      chargers: newChargers,
      activeSessions: Math.min(stationConfig.activeSessions, num)
    });
  };

  return (
    <div className="page-layout demo-layout">
      <Sidebar />
      <div className="main-content demo-content">
        <div className="demo-header">
          <h1>Smart Engine Prototype Demo</h1>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>Adjust the raw input signals to see how ChargeSpot's Smart engines instantly auto-correct and resolve data conflicts.</p>
        </div>

        <div className="demo-grid">
          {/* Signal Controls */}
          <div className="control-panel glass-panel">
            <h2 style={{ margin: '0 0 8px' }}>Raw Input Signals</h2>
            <p className="text-muted mb-40 text-sm" style={{ margin: '0 0 32px' }}>Simulate data from station hardware and the app.</p>
            
            <div className="demo-knob">
              <label><Zap size={16}/> Total Chargers at Station</label>
              <input 
                type="range" min="1" max="10" step="1"
                value={stationConfig.chargers.length}
                onChange={(e) => handleChargerCountChange(e.target.value)}
              />
              <div className="knob-val">{stationConfig.chargers.length} Chargers</div>
            </div>

            <div className="demo-knob">
              <label><Radio size={16}/> Network API Status Layer</label>
              <select 
                value={stationConfig.networkApiStatus}
                onChange={(e) => setStationConfig({...stationConfig, networkApiStatus: e.target.value})}
              >
                <option value="AVAILABLE">AVAILABLE (Normal)</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="OFFLINE">OFFLINE (Comms Lost)</option>
              </select>
            </div>

            <div className="demo-knob">
              <label><Activity size={16}/> Active Charging Sessions</label>
              <input 
                type="range" min="0" max={stationConfig.chargers.length} step="1"
                value={stationConfig.activeSessions}
                onChange={(e) => setStationConfig({...stationConfig, activeSessions: parseInt(e.target.value)})}
              />
              <div className="knob-val">{stationConfig.activeSessions} / {stationConfig.chargers.length} in use</div>
            </div>

            <div className="demo-knob">
              <label><Users size={16}/> Virtual Queue Length</label>
              <input 
                type="range" min="0" max="15" step="1"
                value={stationConfig.bookingQueue}
                onChange={(e) => setStationConfig({...stationConfig, bookingQueue: parseInt(e.target.value)})}
              />
              <div className="knob-val">{stationConfig.bookingQueue} Users Waiting</div>
            </div>

            <div className="demo-knob">
              <label><Radio size={16}/> Recent Heartbeat/Activity</label>
              <select 
                value={stationConfig.recentActivity}
                onChange={(e) => setStationConfig({...stationConfig, recentActivity: e.target.value})}
              >
                <option value="LOW">LOW (No recent plug events)</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH (Likely incoming user)</option>
              </select>
            </div>
          </div>

          {/* Engine Output */}
          <div className="output-panel glass-panel">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 24px' }}>
              <ShieldCheck className="text-primary"/> Engine Outputs
            </h2>
            
            {engineResult.hasConflict && (
              <div className="conflict-banner">
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: 4 }}>ANOMALY DETECTED</strong>
                  <p>Inconsistent signals detected. The engine has overridden the raw API state.</p>
                </div>
              </div>
            )}

            <div className="output-split">
              <div className="output-box">
                <div className="result-ring" style={{ background: `conic-gradient(${getConfidenceColor(engineResult.score)} ${engineResult.score}%, transparent 0)` }}>
                  <div className="result-inner">
                    <span className="score-num">{engineResult.score}%</span>
                    <span className="score-lbl">Confidence</span>
                  </div>
                </div>
                <h3 className="final-status mt-20" style={{ color: getConfidenceColor(engineResult.score), margin: '16px 0 0' }}>
                  {engineResult.status}
                </h3>
              </div>

              <div className="output-box" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Clock size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                <span className="score-lbl" style={{ marginBottom: 8 }}>Estimated Wait</span>
                <span className="score-num" style={{ color: 'var(--text-main)' }}>{waitPrediction.minutes}</span>
                <span className="score-lbl" style={{ marginTop: 4 }}>minutes</span>
              </div>
            </div>

            <div className="log-panel mt-40">
              <h4>Availability Reasoning Log</h4>
              <ul>
                {engineResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="dynamic-alloc-demo glass-panel mt-40">
           <h2 style={{ margin: '0 0 8px' }}>Dynamic Slot Allocation Flow</h2>
           <p className="text-muted" style={{ margin: '0 0 24px' }}>How we handle reservations to prevent empty chargers.</p>
           
           <div className="timeline-flow">
             <div className="t-node green">1. User Books Slot for 10:00 AM</div>
             <div className="t-line"></div>
             <div className="t-node gray">2. 10:00 AM arrives (User absent)</div>
             <div className="t-line"></div>
             <div className="t-node orange">3. 10:05 AM - Marked "At Risk"</div>
             <div className="t-line"></div>
             <div className="t-node red">4. 10:15 AM - Slot Released</div>
             <div className="t-line"></div>
             <div className="t-node primary">5. Option sent to Virtual Queue #1</div>
           </div>
        </div>
      </div>

      <style>{`
        .demo-layout { display: flex; min-height: 100vh; overflow: hidden; }
        .demo-content { flex: 1; margin-left: 260px; padding: 40px; overflow-y: auto; }
        .demo-header { margin-bottom: 40px; }
        .demo-header h1 { margin: 0 0 12px; font-size: 2.2rem; }
        
        .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .control-panel, .output-panel { padding: 40px; }
        
        .demo-knob { margin-bottom: 30px; }
        .demo-knob:last-child { margin-bottom: 0; }
        .demo-knob label { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 12px; font-size: 0.95rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .demo-knob select, .demo-knob input[type="range"] { width: 100%; }
        .demo-knob select { padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; font-size: 1rem; cursor: pointer; }
        .demo-knob select option { background: var(--bg-secondary); }
        .demo-knob input[type="range"] { accent-color: var(--primary-color); }
        .knob-val { text-align: right; margin-top: 10px; color: var(--text-main); font-size: 0.95rem; font-weight: 500; }
        
        .conflict-banner { display: flex; align-items: flex-start; gap: 16px; padding: 20px; border-radius: var(--radius-md); margin-bottom: 32px; background: rgba(245, 158, 11, 0.1); color: var(--status-orange); border: 1px solid rgba(245, 158, 11, 0.3); }
        .conflict-banner p { margin: 0; font-size: 0.9rem; line-height: 1.4; color: var(--status-orange); opacity: 0.9; }
        
        .output-split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .output-box { text-align: center; }
        
        .result-ring { width: 180px; height: 180px; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; margin: 0 auto; box-shadow: 0 0 30px rgba(0,0,0,0.3); transition: background 0.3s; }
        .result-inner { width: 160px; height: 160px; background: var(--bg-card); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; }
        .score-num { font-size: 3rem; font-weight: 800; line-height: 1; margin-bottom: 4px; }
        .score-lbl { color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-size: 0.8rem; font-weight: 600; display: block; }
        
        .final-status { text-align: center; font-size: 1.5rem; font-weight: 700; transition: color 0.3s; }
        
        .log-panel { background: rgba(0,0,0,0.2); padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
        .log-panel h4 { margin: 0 0 16px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; font-size: 1.1rem; }
        .log-panel ul { margin: 0; padding-left: 20px; color: var(--text-muted); font-size: 0.95rem; line-height: 1.7; }
        
        .dynamic-alloc-demo { padding: 40px; }
        .timeline-flow { display: flex; flex-direction: column; gap: 8px; }
        .t-node { padding: 14px 20px; border-radius: var(--radius-sm); font-weight: 500; font-size: 1rem; }
        .t-node.green { background: rgba(16, 185, 129, 0.1); border-left: 4px solid var(--status-green); }
        .t-node.gray { background: rgba(107, 114, 128, 0.1); border-left: 4px solid var(--status-gray); }
        .t-node.orange { background: rgba(245, 158, 11, 0.1); border-left: 4px solid var(--status-orange); }
        .t-node.red { background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--status-red); }
        .t-node.primary { background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--secondary-color); }
        .t-line { width: 2px; height: 16px; background: var(--border-color); margin-left: 24px; }
        
        .mt-40 { margin-top: 40px; }
        .mb-40 { margin-bottom: 40px; }
      `}</style>
    </div>
  );
};

export default InnovationDemo;
