import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { calculateAvailabilityConfidence } from '../engines/AvailabilityEngine';
import { predictWaitingTime, recommendBestStation } from '../engines/PredictiveEngine';
import { syncStations } from '../services/chargingStationApi';
import { useAppState } from '../services/appState';
import { getStationAvailableNow, getConnectorCurrentState } from '../engines/ReservationEngine';
import { searchCityCoordinates } from '../services/geocodingService';
import { Search, Filter, Map, List, Zap, Clock, ChevronRight, MapPin, BatteryCharging, X, SlidersHorizontal, Navigation, RefreshCw, AlertTriangle } from 'lucide-react';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom colored marker for station status
const makeIcon = (color, isUser = false) => {
  if (isUser) {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:24px;height:24px;border-radius:50%;
        background:${color};border:4px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  }
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });
};

const MapBounds = ({ stations, center }) => {
  const map = useMap();
  useEffect(() => {
    if (stations && stations.length > 0) {
      // Filter out extreme outliers (e.g. coordinates in Africa or 0,0) for bounds calculation
      // India roughly spans Lat 6 to 38, Lng 68 to 98. We allow a slightly wider bounding box to be safe.
      const validCoords = stations
        .map(s => s.coordinates)
        .filter(c => 
          c && c.length >= 2 && 
          c[0] >= -90 && c[0] <= 90 && 
          c[1] >= -180 && c[1] <= 180 && 
          !(c[0] === 0 && c[1] === 0) &&
          // Indian Subcontinent constraint to prevent Africa zoom issue
          c[0] > 0 && c[0] < 40 && c[1] > 60 && c[1] < 100
        );

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        if (center && center[0] > 0 && center[0] < 40 && center[1] > 60 && center[1] < 100) {
          bounds.extend(center);
        }
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } else if (center && center[0] >= -90 && center[0] <= 90 && center[1] >= -180 && center[1] <= 180 && !(center[0] === 0 && center[1] === 0)) {
        map.setView(center, 13);
      } else {
        map.setView([20.5937, 78.9629], 5); // India default
      }
    } else if (center && center[0] >= -90 && center[0] <= 90 && center[1] >= -180 && center[1] <= 180 && !(center[0] === 0 && center[1] === 0)) {
      map.setView(center, 13);
    } else {
      map.setView([20.5937, 78.9629], 5);
    }
  }, [stations, center, map]);
  return null;
};

const statusColors = {
  'AVAILABLE': '#10b981',
  'LIKELY AVAILABLE': '#10b981',
  'LIMITED': '#f59e0b',
  'LIKELY OCCUPIED': '#f59e0b',
  'OCCUPIED': '#ef4444',
  'OFFLINE': '#6b7280',
};

const StationFinder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stations, bookings, queue: queues } = useAppState();
  const [viewMode, setViewMode] = useState('map');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpeed, setFilterSpeed] = useState('ALL');
  const [filterAvailability, setFilterAvailability] = useState('ALL');
  const [filterCity, setFilterCity] = useState('ALL');
  const [sortBy, setSortBy] = useState('recommended');

  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Center of India
  const [userLocation, setUserLocation] = useState(null);
  const [apiError, setApiError] = useState(null);

  const fetchData = async (coords = null) => {
     if (coords) setMapCenter(coords);
     const { stations: sts, error } = await syncStations(coords, !coords); // pass fetchIndiaWide
     if (error && (!sts || sts.length === 0)) {
       setApiError(error);
     } else {
       setApiError(null);
     }
  };

  const handleMyLocation = () => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords?.latitude && pos?.coords?.longitude) {
            const coords = [pos.coords.latitude, pos.coords.longitude];
            setMapCenter(coords);
            setUserLocation(coords);
            setSearchQuery('');
          }
        },
        (err) => console.warn("MyLocation error:", err),
        { timeout: 5000 }
      );
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchingLocation(true);
    const coords = await searchCityCoordinates(searchQuery);
    setIsSearchingLocation(false);
    if (coords) {
      fetchData(coords);
    }
  };

  useEffect(() => {
    const load = async () => {
       // Fetch India-wide OCM results as requested
       fetchData(null);
       
       if (navigator?.geolocation) {
         try {
           const pos = await new Promise((resolve) => {
             navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 4000 });
           });
           if (pos?.coords?.latitude && pos?.coords?.longitude) {
             const coords = [pos.coords.latitude, pos.coords.longitude];
             setMapCenter(coords);
             setUserLocation(coords);
           }
         } catch (e) {}
       }
    };
    load();
  }, []);

  const cities = useMemo(() => {
    const all = [...new Set(stations.map(s => s.city))].filter(Boolean).sort();
    return ['ALL', ...all];
  }, [stations]);

  const processedStations = useMemo(() => {
    const isValid = (st) => {
      if (!st || typeof st !== 'object' || !st.id || !st.name) return false;
      if (!Array.isArray(st.coordinates) || st.coordinates.length < 2) return false;
      const lat = st.coordinates[0];
      const lng = st.coordinates[1];
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
      if (!Array.isArray(st.chargers)) return false;
      return true;
    };
    const validSts = stations.filter(isValid);
    const refCoords = mapCenter && isValid({id:'x', name:'x', coordinates: mapCenter, chargers:[]}) ? mapCenter : [20.5937, 78.9629]; // Center of India fallback
    const ranked = recommendBestStation(validSts, { ...user, currentLocation: refCoords }, bookings, queues);
    return ranked;
  }, [stations, user, mapCenter, bookings, queues]);

  const filteredStations = useMemo(() => {
    return processedStations.filter(st => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !st.name.toLowerCase().includes(q) &&
          !st.location.toLowerCase().includes(q) &&
          !st.city.toLowerCase().includes(q)
        ) return false;
      }

      // Speed filter
      if (filterSpeed === 'FAST') {
        if (!st.chargers.some(c => parseInt(c.speed) >= 50 && parseInt(c.speed) < 150)) return false;
      } else if (filterSpeed === 'ULTRA') {
        if (!st.chargers?.some(c => parseInt(c.speed) >= 150)) return false;
      } else if (filterSpeed === 'SLOW') {
        if (!st.chargers?.some(c => parseInt(c.speed) <= 22)) return false;
      }

      // Availability filter
      if (filterAvailability !== 'ALL') {
        const result = calculateAvailabilityConfidence(st, bookings, queues);
        if (filterAvailability === 'AVAILABLE' && result.status !== 'AVAILABLE' && result.status !== 'LIKELY AVAILABLE') return false;
        if (filterAvailability === 'LIMITED' && result.status !== 'LIMITED') return false;
        if (filterAvailability === 'OCCUPIED' && result.status !== 'OCCUPIED' && result.status !== 'LIKELY OCCUPIED') return false;
      }

      // City filter
      if (filterCity !== 'ALL' && st.city !== filterCity) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
      if (sortBy === 'wait') return a.waitPrediction.minutes - b.waitPrediction.minutes;
      if (sortBy === 'price') return parseFloat(a.avgPrice) - parseFloat(b.avgPrice);
      return b.recommendationScore - a.recommendationScore; // recommended (default)
    });
  }, [processedStations, searchQuery, filterSpeed, filterAvailability, filterCity, sortBy, bookings, queues]);

  const hasActiveFilters = filterSpeed !== 'ALL' || filterAvailability !== 'ALL' || filterCity !== 'ALL' || sortBy !== 'recommended';

  const clearFilters = () => {
    setFilterSpeed('ALL');
    setFilterAvailability('ALL');
    setFilterCity('ALL');
    setSortBy('recommended');
    setSearchQuery('');
  };

  const getStatusColor = (status) => statusColors[status] || '#6b7280';

  return (
    <div className="finder-layout">
      <Sidebar />
      <div className="finder-content">
        {/* Header bar */}
        <div className="finder-header glass-panel">
          <form className="search-wrap" onSubmit={handleSearchSubmit}>
            <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by city (e.g. Bhimavaram, Vijayawada)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {isSearchingLocation && (
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>Searching...</span>
            )}
            {searchQuery && (
              <button type="button" className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </form>

          <div className="header-controls">
            <button
              className="filter-toggle-btn"
              onClick={handleMyLocation}
              title="Recenter map to my location"
            >
              <Navigation size={16} /> My Location
            </button>

            <button
              className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
              onClick={() => setShowFilters(s => !s)}
            >
              <SlidersHorizontal size={16} />
              Filters
              {hasActiveFilters && <span className="filter-dot" />}
            </button>

            <div className="view-toggle">
              <button className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
                <Map size={16} /> Map
              </button>
              <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                <List size={16} /> List
              </button>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="filter-panel glass-panel">
            <div className="filter-row">
              <div className="filter-group">
                <label>Charger Speed</label>
                <div className="filter-pills">
                  {[['ALL', 'All'], ['SLOW', '≤22kW'], ['FAST', '50–149kW'], ['ULTRA', '150kW+']].map(([val, label]) => (
                    <button key={val} className={`pill ${filterSpeed === val ? 'active' : ''}`} onClick={() => setFilterSpeed(val)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <label>Availability</label>
                <div className="filter-pills">
                  {[['ALL', 'All'], ['AVAILABLE', 'Available'], ['LIMITED', 'Limited'], ['OCCUPIED', 'Occupied']].map(([val, label]) => (
                    <button key={val} className={`pill ${filterAvailability === val ? 'active' : ''}`} onClick={() => setFilterAvailability(val)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <label>City</label>
                <select className="filter-select" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
                  {cities.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All Cities' : c}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>Sort By</label>
                <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="recommended">Recommended</option>
                  <option value="distance">Distance (nearest)</option>
                  <option value="wait">Wait Time</option>
                  <option value="price">Price (lowest)</option>
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                <X size={14} /> Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Result count */}
        <div className="result-count" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Showing <strong style={{ color: 'var(--text-main)' }}>{filteredStations.length}</strong> of {stations.length} stations
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--glass-bg)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}></div>
            Blue indicator represents your present location
          </span>
        </div>

        {/* Content */}
        <div className="finder-body">
          {viewMode === 'map' ? (
            <div className="map-container glass-panel">
              <MapContainer
                center={mapCenter}
                zoom={9}
                key={`${mapCenter[0]}-${mapCenter[1]}`}
                style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                zoomControl={false}
              >
                <ZoomControl position="bottomright" />
                <MapBounds stations={filteredStations} center={mapCenter} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {userLocation && (
                  <Marker position={userLocation} icon={makeIcon('#3b82f6', true)}>
                    <Popup>Your Location</Popup>
                  </Marker>
                )}
                <Marker position={[20.5937, 78.9629]} icon={makeIcon('#10b981', false)}>
                  <Popup>India Center</Popup>
                </Marker>
                <MarkerClusterGroup
                  chunkedLoading
                  maxClusterRadius={40}
                  showCoverageOnHover={false}
                >
                  {filteredStations.map(station => {
                    const c = station.coordinates;
                    // Do not render outlier markers (e.g. 0,0 or Africa) on the India-focused map
                    if (!c || c.length < 2 || c[0] === 0 || c[1] === 0 || c[0] < 0 || c[0] > 40 || c[1] < 60 || c[1] > 100) return null;
                    const result = calculateAvailabilityConfidence(station, bookings, queues);
                    const color = getStatusColor(result.status);
                    return (
                      <Marker key={station.id} position={station.coordinates} icon={makeIcon(color)}>
                        <Popup minWidth={220}>
                          <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px' }}>
                            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#111' }}>{station.name}</h3>
                            <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#555' }}>
                              <MapPin size={12} /> {station.location}
                            </p>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}22`, color, padding: '3px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, marginBottom: 8 }}>
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                              {result.status} · {result.score}%
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: 10 }}>
                              ₹{(station.chargers.reduce((a, c) => a + c.price, 0) / station.chargers.length).toFixed(1)}/kWh · {station.chargers.length} chargers
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                              <button
                                style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                                onClick={() => navigate(`/station/${station.id}`)}
                              >View Details</button>
                              <button
                                style={{ 
                                  background: result.status === 'AVAILABLE' || result.status === 'LIMITED' ? '#f0fdf4' : '#f3f4f6', 
                                  color: result.status === 'AVAILABLE' || result.status === 'LIMITED' ? '#10b981' : '#9ca3af', 
                                  border: `1px solid ${result.status === 'AVAILABLE' || result.status === 'LIMITED' ? '#10b981' : '#d1d5db'}`, 
                                  borderRadius: 8, padding: '8px', fontWeight: 600, 
                                  cursor: result.status === 'AVAILABLE' || result.status === 'LIMITED' ? 'pointer' : 'not-allowed', 
                                  fontSize: '0.85rem' 
                                }}
                                onClick={() => {
                                  if (result.status === 'AVAILABLE' || result.status === 'LIMITED') {
                                    navigate(`/book/${station.id}`);
                                  }
                                }}
                                disabled={result.status !== 'AVAILABLE' && result.status !== 'LIMITED'}
                              >Book Now</button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          ) : (
            <div className="list-container">
              {filteredStations.length === 0 ? (
                <div className="glass-panel empty-state">
                  <Search size={36} color="var(--text-muted)" />
                  <h3 style={{ marginTop: 16, marginBottom: 8 }}>No stations found</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Try adjusting your filters or search query.</p>
                  <button className="btn-primary" style={{ marginTop: 20 }} onClick={clearFilters}>Clear Filters</button>
                </div>
              ) : (
                filteredStations.map(station => {
                  const result = calculateAvailabilityConfidence(station, bookings);
                  const color = getStatusColor(result.status);
                  const availableChargers = result.metrics?.availableConnectors ?? ((station.networkApiStatus === 'OFFLINE' || station.networkApiStatus === 'MAINTENANCE') ? 0 : getStationAvailableNow(station, bookings));
                  return (
                    <div key={station.id} className="list-card glass-panel" onClick={() => navigate(`/station/${station.id}`)}>
                      <div className="list-card-left">
                        <div className="list-card-info">
                          <h3>{station.name}</h3>
                          <p className="list-location">
                            <MapPin size={13} /> {station.location}, {station.city}
                          </p>
                          <div className="charger-badges">
                            {station.chargers.map((c, i) => (
                              <span
                                key={i}
                                className="c-badge"
                                style={{ opacity: getConnectorCurrentState(c, station.id, bookings) === 'OFFLINE' ? 0.4 : 1 }}
                              >
                                {c.speed}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="list-card-stats">
                          <div className="status-badge" style={{ background: `${color}22`, color }}>
                            <div className="status-dot" style={{ background: color }} /> {result.status} ({result.score}%)
                          </div>
                          <div className="list-stat"><Clock size={13} style={{ color: 'var(--text-muted)' }} /> {station.waitPrediction?.minutes > 0 ? `${station.waitPrediction.minutes} min wait` : 'No wait'}</div>
                          <div className="list-stat"><MapPin size={13} style={{ color: 'var(--text-muted)' }} /> {station.distanceKm} km</div>
                          <div className="list-stat"><Zap size={13} style={{ color: 'var(--text-muted)' }} /> {availableChargers}/{station.chargers.length} free</div>
                        </div>
                      </div>
                      <div className="list-card-actions">
                        <button
                          className="btn-primary"
                          style={{ 
                            padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6,
                            opacity: result.status === 'AVAILABLE' || result.status === 'LIMITED' ? 1 : 0.5,
                            cursor: result.status === 'AVAILABLE' || result.status === 'LIMITED' ? 'pointer' : 'not-allowed'
                          }}
                          onClick={e => { 
                            e.stopPropagation(); 
                            if (result.status === 'AVAILABLE' || result.status === 'LIMITED') {
                              navigate(`/book/${station.id}`); 
                            }
                          }}
                          disabled={result.status !== 'AVAILABLE' && result.status !== 'LIMITED'}
                        >
                          <BatteryCharging size={14} /> {result.status === 'AVAILABLE' || result.status === 'LIMITED' ? 'Book' : 'Unavailable'}
                        </button>
                        <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .finder-layout { display: flex; height: 100vh; overflow: hidden; }
        .finder-content { flex: 1; margin-left: 260px; display: flex; flex-direction: column; padding: 20px; gap: 14px; overflow: hidden; }

        .finder-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; gap: 16px; flex-shrink: 0; }
        .search-wrap { display: flex; align-items: center; gap: 10px; flex: 1; background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: var(--radius-full); border: 1px solid var(--border-color); }
        .search-input { flex: 1; background: transparent; border: none; color: var(--text-main); font-size: 0.95rem; font-family: inherit; outline: none; }
        .clear-search { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; padding: 2px; }
        .clear-search:hover { color: var(--text-main); }

        .header-controls { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .filter-toggle-btn { display: flex; align-items: center; gap: 7px; padding: 10px 16px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: var(--radius-full); color: var(--text-muted); cursor: pointer; font-family: inherit; font-size: 0.9rem; position: relative; transition: var(--transition-fast); }
        .filter-toggle-btn:hover, .filter-toggle-btn.active { background: rgba(255,255,255,0.1); color: var(--text-main); }
        .filter-toggle-btn.has-filters { border-color: var(--primary-color); color: var(--primary-color); }
        .filter-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary-color); }
        .view-toggle { display: flex; background: rgba(255,255,255,0.05); border-radius: var(--radius-full); padding: 4px; gap: 2px; }
        .toggle-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius-full); color: var(--text-muted); background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.9rem; transition: var(--transition-fast); }
        .toggle-btn.active { background: var(--bg-secondary); color: var(--text-main); font-weight: 600; }

        .filter-panel { padding: 20px 24px; flex-shrink: 0; }
        .filter-row { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
        .filter-group { display: flex; flex-direction: column; gap: 8px; min-width: 160px; }
        .filter-group label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .pill { padding: 6px 12px; border-radius: var(--radius-full); background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.82rem; cursor: pointer; font-family: inherit; transition: var(--transition-fast); }
        .pill:hover { color: var(--text-main); }
        .pill.active { background: var(--primary-color); border-color: var(--primary-color); color: white; font-weight: 600; }
        .filter-select { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-main); font-family: inherit; font-size: 0.9rem; cursor: pointer; }
        .filter-select option { background: var(--bg-secondary); }
        .clear-filters-btn { display: flex; align-items: center; gap: 6px; margin-top: 16px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-family: inherit; font-size: 0.85rem; }
        .clear-filters-btn:hover { color: var(--status-red); }

        .result-count { padding: 0 4px; flex-shrink: 0; }

        .finder-body { flex: 1; min-height: 0; display: flex; }
        .map-container { flex: 1; border-radius: var(--radius-md) !important; overflow: hidden; z-index: 1; padding: 0 !important; }

        .list-container { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 4px; }
        .empty-state { padding: 60px; display: flex; flex-direction: column; align-items: center; text-align: center; }

        .list-card { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; gap: 16px; }
        .list-card:hover { transform: translateX(4px); box-shadow: var(--shadow-glass), 0 0 18px rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.25); }
        .list-card-left { display: flex; flex: 1; gap: 20px; align-items: center; min-width: 0; }
        .list-card-info { flex: 1; min-width: 0; }
        .list-card-info h3 { margin: 0 0 4px; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .list-location { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--text-muted); margin: 0 0 10px; }
        .charger-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .c-badge { background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }

        .list-card-stats { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; white-space: nowrap; }
        .list-stat { display: flex; align-items: center; gap: 5px; font-size: 0.85rem; font-weight: 500; }
        .status-badge { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .list-card-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
      `}</style>
    </div>
  );
};

export default StationFinder;
