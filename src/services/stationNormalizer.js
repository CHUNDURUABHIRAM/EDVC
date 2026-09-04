export const normalizeStationStatus = (station) => {
  const s = { ...station };
  if (!s.chargers || s.chargers.length === 0) {
    s.networkApiStatus = 'UNAVAILABLE';
    s.metrics = {
      totalConnectors: 0,
      availableConnectors: 0,
      occupiedConnectors: 0,
      reservedConnectors: 0,
      maintenanceConnectors: 0,
      offlineConnectors: 0
    };
    return s;
  }

  let allMaintenance = true;
  let allOffline = true;
  let allOccupied = true;
  let allReserved = true;
  let hasAvailable = false;

  s.chargers.forEach(c => {
    if (c.status !== 'MAINTENANCE') allMaintenance = false;
    if (c.status !== 'OFFLINE') allOffline = false;
    if (c.status !== 'OCCUPIED' && c.status !== 'CHARGING') allOccupied = false;
    if (c.status !== 'RESERVED') allReserved = false;
    if (c.status === 'AVAILABLE') hasAvailable = true;
  });

  if (allMaintenance) {
    s.networkApiStatus = 'MAINTENANCE';
  } else if (allOffline) {
    s.networkApiStatus = 'OFFLINE';
  } else if (allOccupied) {
    s.networkApiStatus = 'OCCUPIED';
  } else if (allReserved) {
    s.networkApiStatus = 'RESERVED';
  } else if (hasAvailable) {
    if (s.networkApiStatus === 'MAINTENANCE' || s.networkApiStatus === 'OFFLINE' || s.networkApiStatus === 'OCCUPIED') {
      s.networkApiStatus = 'AVAILABLE';
    }
  }

  s.metrics = {
    totalConnectors: s.chargers.length,
    availableConnectors: s.chargers.filter(c => c.status === 'AVAILABLE').length,
    occupiedConnectors: s.chargers.filter(c => c.status === 'OCCUPIED' || c.status === 'CHARGING').length,
    reservedConnectors: s.chargers.filter(c => c.status === 'RESERVED').length,
    maintenanceConnectors: s.chargers.filter(c => c.status === 'MAINTENANCE').length,
    offlineConnectors: s.chargers.filter(c => c.status === 'OFFLINE').length,
  };

  return s;
};
