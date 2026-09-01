/**
 * Predicts waiting time, computes station recommendation score.
 * Uses Haversine formula for real distance calculation.
 */

// Haversine formula: returns distance in km between two [lat, lng] points
export const haversineDistance = (coords1, coords2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((coords2[0] - coords1[0]) * Math.PI) / 180;
  const dLng = ((coords2[1] - coords1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coords1[0] * Math.PI) / 180) *
      Math.cos((coords2[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const predictWaitingTime = (station) => {
  const { activeSessions, historicalDurations, bookingQueue, chargers } = station;
  const totalChargers = chargers ? chargers.length : 1;

  // Immediately available
  if (activeSessions < totalChargers && bookingQueue === 0) {
    return { minutes: 0, confidence: 95, message: 'Available immediately' };
  }

  // Average historical duration
  let avgDuration = 30;
  if (historicalDurations && historicalDurations.length > 0) {
    avgDuration = historicalDurations.reduce((a, b) => a + b, 0) / historicalDurations.length;
  }

  // Remaining time for active sessions (assume halfway through)
  const remainingActiveTime = (activeSessions * (avgDuration / 2)) / totalChargers;
  // Time for queue
  const queueTime = (bookingQueue * avgDuration) / totalChargers;
  const estimatedWait = Math.round(remainingActiveTime + queueTime);

  // Confidence decreases with queue length
  const confidence = Math.max(40, 90 - bookingQueue * 10);

  return {
    minutes: estimatedWait,
    confidence,
    message: `Estimated wait: ${estimatedWait} mins`,
  };
};

export const recommendBestStation = (stations, user) => {
  if (!stations || !user) return [];

  const userCoords = user.currentLocation || [12.9716, 77.5946];

  return stations
    .map(station => {
      // Real distance using Haversine
      const distanceKm = station.coordinates
        ? haversineDistance(userCoords, station.coordinates).toFixed(1)
        : (Math.random() * 10 + 1).toFixed(1);

      const distanceScore = Math.max(0, 100 - distanceKm * 3);

      // Wait time
      const waitPrediction = predictWaitingTime(station);
      const waitScore = Math.max(0, 100 - waitPrediction.minutes * 2);

      // Price score
      const avgPrice = station.chargers.reduce((acc, c) => acc + c.price, 0) / station.chargers.length;
      const priceScore = Math.max(0, 100 - (avgPrice - 10) * 5);

      // Availability
      const availabilityScore =
        station.networkApiStatus === 'AVAILABLE' ? 100 :
        station.networkApiStatus === 'OCCUPIED' ? 20 : 0;

      // Connector match bonus
      const connectorBonus =
        user.preferredConnector &&
        station.chargers.some(c => c.type === user.preferredConnector && c.status === 'AVAILABLE')
          ? 15 : 0;

      // Fast charger bonus
      const hasFastCharger = station.chargers.some(c => parseInt(c.speed) >= 50);
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
        distanceKm: parseFloat(distanceKm),
        waitPrediction,
        avgPrice: avgPrice.toFixed(2),
        recommendationScore: totalScore,
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
};
