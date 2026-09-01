import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, MapPin, Clock, ShieldCheck, BatteryCharging, ChevronRight } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="navbar glass-panel">
        <div className="container nav-content">
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>
            <Zap className="text-primary" size={28} />
            <h2>Charge<span className="text-primary">Spot</span></h2>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
            <button className="btn-secondary" onClick={() => navigate('/auth')}>Login</button>
            <button className="btn-primary" onClick={() => navigate('/auth')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Charge Smarter.<br/>
              <span className="text-gradient">Drive Further.</span>
            </h1>
            <p className="hero-subtitle">
              Find reliable EV charging availability, predict waiting time, and reserve your charging slot before you arrive. No more range anxiety, no more waiting lines.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary btn-lg" onClick={() => navigate('/finder')}>
                <MapPin className="icon" /> Find a Charger
              </button>
              <button className="btn-secondary btn-lg" onClick={() => navigate('/demo')}>
                <ShieldCheck className="icon" /> See Smart Engine Demo
              </button>
            </div>
          </div>
        </div>
        
        {/* Background Gradients */}
        <div className="glow-sphere blob-1"></div>
        <div className="glow-sphere blob-2"></div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title text-center">Why ChargeSpot?</h2>
          <div className="features-grid">
            <div className="feature-card glass-panel">
              <div className="icon-wrapper bg-primary-soft">
                <ShieldCheck size={32} className="text-primary" />
              </div>
              <h3>Verified Availability</h3>
              <p>Our Smart Engine detects conflicts between APIs and sensors to give you a true Confidence Score.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="icon-wrapper bg-primary-soft">
                <Clock size={32} className="text-primary" />
              </div>
              <h3>AI Wait Times & Queue</h3>
              <p>Know exactly how long you'll wait. Join the virtual queue if a station is busy.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="icon-wrapper bg-primary-soft">
                <BatteryCharging size={32} className="text-primary" />
              </div>
              <h3>Dynamic Reservations</h3>
              <p>Book your slot securely. Our dynamic allocation handles no-shows fairly to maximize charger use.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container glass-panel cta-box text-center">
          <h2>Ready to power up your journey?</h2>
          <p>Join thousands of EV owners enjoying stress-free charging today.</p>
          <button className="btn-primary mt-6" onClick={() => navigate('/auth')}>
            Create your account <ChevronRight size={20} />
          </button>
        </div>
      </section>
      
      {/* Private CSS for this component (can be moved later or kept in index.css) */}
      <style>{`
        .landing-page { padding-top: 80px; }
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          border-radius: 0; border-top: none; border-left: none; border-right: none;
        }
        .nav-content { display: flex; justify-content: space-between; align-items: center; height: 80px; }
        .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1.5rem; }
        .text-primary { color: var(--primary-color); }
        .nav-links { display: flex; gap: 24px; align-items: center; }
        .nav-links a { font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover { color: var(--primary-color); }
        
        .hero { position: relative; min-height: 85vh; display: flex; align-items: center; text-align: center; }
        .hero-content { position: relative; z-index: 10; max-width: 800px; margin: 0 auto; }
        .hero-title { font-size: 4rem; font-weight: 800; line-height: 1.2; margin-bottom: 24px; letter-spacing: -0.02em; }
        .hero-subtitle { font-size: 1.25rem; color: var(--text-muted); margin-bottom: 40px; }
        .hero-buttons { display: flex; gap: 16px; justify-content: center; }
        .btn-lg { padding: 16px 32px; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; }
        
        .glow-sphere { position: absolute; border-radius: 50%; filter: blur(100px); z-index: 1; opacity: 0.15; }
        .blob-1 { width: 500px; height: 500px; background: var(--primary-color); top: -100px; right: -100px; }
        .blob-2 { width: 400px; height: 400px; background: var(--secondary-color); bottom: 100px; left: -100px; }
        
        .features { padding: 100px 0; background: var(--bg-secondary); }
        .section-title { font-size: 2.5rem; font-weight: 700; margin-bottom: 60px; }
        .text-center { text-align: center; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
        .feature-card { padding: 40px 30px; text-align: left; }
        .icon-wrapper { width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; background: var(--primary-glow); }
        .feature-card h3 { font-size: 1.5rem; margin-bottom: 16px; }
        .feature-card p { color: var(--text-muted); line-height: 1.6; }
        
        .cta { padding: 100px 0; }
        .cta-box { padding: 80px 40px; background: linear-gradient(to right, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1)); border: 1px solid var(--primary-glow); }
        .cta-box h2 { font-size: 2.5rem; margin-bottom: 20px; }
        .cta-box p { font-size: 1.25rem; color: var(--text-muted); }
        .mt-6 { margin-top: 30px; }
      `}</style>
    </div>
  );
};

export default LandingPage;
