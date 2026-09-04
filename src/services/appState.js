import { useState, useEffect } from 'react';
import { normalizeStationStatus } from './stationNormalizer';

const EVENT_NAME = 'chargespot-state-changed';

const getJSON = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const setJSON = (key, val) => {
  localStorage.setItem(key, JSON.stringify(val));
  window.dispatchEvent(new Event(EVENT_NAME));
};

import { synchronizePlatformState } from '../engines/StateEngine';
import { getCachedBookings, subscribeToBookings, migrateLocalBookings } from './firebaseBookings';

// Initialize Firebase integration
let globalBookingUnsubscribe = null;

export const initializeBookingSubscription = (uid) => {
  if (globalBookingUnsubscribe) {
    globalBookingUnsubscribe();
    globalBookingUnsubscribe = null;
  }
  
  if (!uid) return;
  
  globalBookingUnsubscribe = subscribeToBookings(() => {}, false, uid);
};

migrateLocalBookings();

export const appState = {
  // Getters
  getStations: () => getJSON('chargeSpotStations', []),
  getOperatorMods: () => getJSON('chargeSpotOperatorMods', {}),
  getBookings: () => getCachedBookings(),
  getQueue: () => getJSON('chargeSpotQueue', []),

  // Setters
  setStations: (sts) => setJSON('chargeSpotStations', sts),
  setOperatorMods: (mods) => setJSON('chargeSpotOperatorMods', mods),
  setBookings: (bks) => {
    // Legacy support: We no longer write to localStorage directly for bookings
    // Firebase is the single source of truth.
    console.warn("appState.setBookings called. Ignoring to prevent overwriting Firestore data.");
  },
  setQueue: (q) => setJSON('chargeSpotQueue', q),

  // Modifiers
  updateStationNetworkStatus: (stationId, status) => {
    const stations = appState.getStations();
    const station = stations.find(s => s.id === stationId);
    if (!station) return;

    // Save operational status to operator mods
    const mods = appState.getOperatorMods();
    const existingMod = mods[stationId] || {};
    
    // Admin manual override sets the operationalStatus for the station and connectors
    const updatedChargers = (station.chargers || []).map(c => {
      let newOpStatus = existingMod.chargers?.find(mc => mc.id === c.id)?.operationalStatus || null;
      if (status === 'MAINTENANCE' || status === 'OFFLINE') {
        newOpStatus = status;
      } else if (status === 'AVAILABLE') {
        newOpStatus = 'AVAILABLE';
      }
      return { id: c.id, operationalStatus: newOpStatus };
    });

    mods[stationId] = {
      ...existingMod,
      operationalStatus: status,
      chargers: updatedChargers
    };

    appState.setOperatorMods(mods);
    
    // Force sync to recalculate derived states
    synchronizePlatformState();
  },

  updateConnectorStatus: (stationId, connectorId, status) => {
    const stations = appState.getStations();
    const station = stations.find(s => s.id === stationId);
    if (!station) return;

    const mods = appState.getOperatorMods();
    const existingMod = mods[stationId] || {};
    const modChargers = existingMod.chargers || (station.chargers || []).map(c => ({ id: c.id, operationalStatus: null }));
    
    const updatedChargers = modChargers.map(c => 
      c.id === connectorId ? { ...c, operationalStatus: status } : c
    );

    mods[stationId] = {
      ...existingMod,
      chargers: updatedChargers
    };

    appState.setOperatorMods(mods);
    
    // Force sync to recalculate derived states
    synchronizePlatformState();
  },

  // State synchronization explicitly requested by UI or engines
  sync: () => {
    synchronizePlatformState();
  }
};

// React Hook for Shared State Reactivity
export const useAppState = () => {
  const [state, setState] = useState({
    stations: appState.getStations(),
    operatorMods: appState.getOperatorMods(),
    bookings: appState.getBookings(),
    queue: appState.getQueue(),
  });

  useEffect(() => {
    const sync = () => {
      setState({
        stations: appState.getStations(),
        operatorMods: appState.getOperatorMods(),
        bookings: appState.getBookings(),
        queue: appState.getQueue(),
      });
    };

    // Listen to same-tab custom events
    window.addEventListener(EVENT_NAME, sync);
    // Listen to cross-tab storage events
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return state;
};
