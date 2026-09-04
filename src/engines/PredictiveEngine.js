/**
 * Predicts waiting time, computes station recommendation score.
 * Uses Haversine formula for real distance calculation.
 */

import { getStationQueueCount, getStationAvailableNow, getConnectorCurrentState } from './ReservationEngine';

// Haversine formula: returns distance in km between two [lat, lng] points safely
export const haversineDistance = (coords1, coords2) => {
  if (
    !coords1 ||
    !coords2 ||
    !Array.isArray(coords1) ||
    !Array.isArray(coords2) ||
    coords1.length < 2 ||
    coords2.length < 2
  ) {
    return 0;
  }

  const lat1 = Number(coords1[0]);
  const lng1 = Number(coords1[1]);
  const lat2 = Number(coords2[0]);
  const lng2 = Number(coords2[1]);

  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return 0;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const predictWaitingTime = (station = {}, bookings = [], queues = []) => {
  const chargers = Array.isArray(station?.chargers) ? station.chargers : [];
  const totalConnectors = Math.max(1, chargers.length);
  const activeSessions = chargers.filter(c => c.status === 'CHARGING').length;
  
  const currentBookings = bookings.filter(b => b.stationId === station.id && (b.status === 'CONFIRMED' || b.status === 'AT_RISK')).length;
  const queueLength = getStationQueueCount(station.id, bookings);
  const historicalDurations = station?.historicalDurations || [30];

  const availableConnectors = getStationAvailableNow(station, bookings);
  if (availableConnectors > 0 && queueLength === 0) {
    return { minutes: 0, confidence: 95, message: 'Available immediately' };
  }

  // Average historical duration
  let avgDuration = 30;
  if (historicalDurations && historicalDurations.length > 0) {
    avgDuration = historicalDurations.reduce((a, b) => a + b, 0) / historicalDurations.length;
  }

  // Remaining time for active sessions (assume halfway through)
  const remainingActiveTime = (activeSessions * (avgDuration / 2)) / totalConnectors;
  // Time for queue and bookings combined
  const queueTime = ((queueLength + currentBookings) * avgDuration) / totalConnectors;
  const estimatedWait = Math.round(remainingActiveTime + queueTime);

  // Confidence decreases with queue length
  const confidence = Math.max(40, 90 - queueLength * 10);

  return {
    minutes: estimatedWait,
    confidence,
    message: `Estimated wait: ${estimatedWait} mins`,
  };
};

export const recommendBestStation = (stations = [], user = {}, bookings = [], queues = []) => {
  if (!Array.isArray(stations) || stations.length === 0) return [];

  const userCoords = user?.currentLocation && Array.isArray(user.currentLocation) && user.currentLocation.length >= 2
    ? user.currentLocation
    : [12.9716, 77.5946];

  return stations
    .filter(st => st && typeof st === 'object')
    .map(station => {
      const chargers = Array.isArray(station.chargers) ? station.chargers : [];
      
      // Real distance using Haversine
      const distanceKm = (station.coordinates && Array.isArray(station.coordinates) && station.coordinates.length >= 2)
        ? haversineDistance(userCoords, station.coordinates)
        : 5.0;

      const distanceScore = Math.max(0, 100 - distanceKm * 3);

      // Wait time
      const waitPrediction = predictWaitingTime(station, bookings, queues);
      const waitScore = Math.max(0, 100 - waitPrediction.minutes * 2);

      // Price score
      const avgPrice = chargers.length > 0
        ? chargers.reduce((acc, c) => acc + (c?.price || 15), 0) / chargers.length
        : 20;
      const priceScore = Math.max(0, 100 - (avgPrice - 10) * 5);

      // Availability (independent of confidence)
      const availableConnectors = getStationAvailableNow(station, bookings);
      let availabilityScore = (availableConnectors / Math.max(1, chargers.length)) * 100;
      if (station.networkApiStatus === 'OFFLINE' || station.networkApiStatus === 'MAINTENANCE') {
        availabilityScore = 0;
      }

      // Connector match bonus
      const connectorBonus =
        user?.preferredConnector &&
        chargers.some(c => c?.type === user.preferredConnector && getConnectorCurrentState(c, station.id, bookings) === 'AVAILABLE')
          ? 15 : 0;

      // Fast charger bonus
      const hasFastCharger = chargers.some(c => parseInt(c?.speed || 0) >= 50);
      const speedBonus = hasFastCharger ? 10 : 0;

      const totalScore = Math.round(
        distanceScore * 0.3 +
        waitScore * 0.35 +
        priceScore * 0.1 +
        availabilityScore * 0.25 +
        connectorBonus +
        speedBonus
      );

      return {
        ...station,
        chargers,
        distanceKm: Number(distanceKm.toFixed(1)),
        waitPrediction,
        avgPrice: avgPrice.toFixed(2),
        recommendationScore: totalScore,
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
};
