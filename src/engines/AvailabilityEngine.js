/**
 * Calculates Availability Confidence Score based on multiple signals.
 * Deterministically driven by real-time station data, bookings, and queue state.
 */
import { getStationQueueCount, getStationAvailableNow } from './ReservationEngine';

export const calculateAvailabilityConfidence = (station = {}, bookings = []) => {
  if (!station || typeof station !== 'object') {
    return { score: 0, status: "UNKNOWN", reasons: ["Invalid station data"], hasConflict: false };
  }

  const networkApiStatus = station?.networkApiStatus || "AVAILABLE";
  const chargers = Array.isArray(station?.chargers) ? station.chargers : [];
  const totalConnectors = Math.max(1, chargers.length);
  
  // Hard blocker: If offline or maintenance, confidence is 0
  if (networkApiStatus === "OFFLINE") {
    return { score: 0, status: "OFFLINE", reasons: ["Network API reports station is offline"], hasConflict: false };
  }
  if (networkApiStatus === "MAINTENANCE") {
    return { score: 0, status: "MAINTENANCE", reasons: ["Station is under maintenance"], hasConflict: false };
  }

  const availableConnectors = getStationAvailableNow(station, bookings);
  const currentBookings = bookings.filter(b => {
    if (b.stationId !== station.id) return false;
    if (b.status !== 'CONFIRMED' && b.status !== 'AT_RISK' && b.status !== 'ACTIVE' && b.status !== 'IN_PROGRESS') return false;
    
    // Only count bookings that are currently active or starting within the next 30 minutes
    const now = new Date();
    if (b.date && b.time) {
      const [year, month, day] = b.date.split('-').map(Number);
      const [hour, minute] = b.time.split(':').map(Number);
      const slotStart = new Date(year, month - 1, day, hour, minute);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1 hour slot
      
      const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      
      // If the slot hasn't started yet and is more than 30 mins away, don't count it against CURRENT availability
      if (slotStart > thirtyMinsFromNow) {
        return false;
      }
      
      // If the slot has already passed completely, don't count it (though expirePastBookings should handle this)
      if (now > slotEnd) {
        return false;
      }
    }
    return true;
  }).length;
  const queueLength = getStationQueueCount(station.id, bookings);

  let score = 0;
  let reasons = [];

  // 1. Availability Score (Base maximum: 70 points)
  // Higher ratio of available connectors yields higher score
  const availabilityRatio = availableConnectors / totalConnectors;
  const availabilityPoints = Math.round(availabilityRatio * 70);
  score += availabilityPoints;
  reasons.push(`Availability: ${availableConnectors}/${totalConnectors} free (+${availabilityPoints})`);

  // 2. Operational Base Bonus (Max: 30 points)
  // Just being online and not occupied gives a baseline reliability boost
  let operationalPoints = 30;
  if (networkApiStatus === "OCCUPIED") {
    operationalPoints = 10;
  }
  score += operationalPoints;
  reasons.push(`Operational status: ${networkApiStatus} (+${operationalPoints})`);

  // 3. Booking Penalty (Deducts from score)
  // High volume of active bookings limits confidence in walk-in availability
  const bookingPenalty = Math.min(30, currentBookings * 15);
  if (bookingPenalty > 0) {
    score -= bookingPenalty;
    reasons.push(`Bookings: ${currentBookings} active (-${bookingPenalty})`);
  }

  // 4. Queue Penalty (Deducts heavily from score)
  const queuePenalty = Math.min(30, queueLength * 20);
  if (queuePenalty > 0) {
    score -= queuePenalty;
    reasons.push(`Queue: ${queueLength} waiting (-${queuePenalty})`);
  }
  
  // Normalize score bounds
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Final Status determination based on deterministic logic
  let status = "AVAILABLE";
  let hasConflict = false;

  if (availableConnectors === 0) {
    status = "OCCUPIED";
    if (networkApiStatus === "AVAILABLE") {
      hasConflict = true;
      reasons.push("Conflict: API reports available but 0 connectors are free");
    }
  } else if (currentBookings >= totalConnectors || queueLength > 0) {
    status = "LIKELY OCCUPIED";
  } else if (availableConnectors < totalConnectors && availableConnectors > 0) {
    status = "LIMITED";
  }

  // Edge case overrides based on final score
  if (score < 30 && status !== "OCCUPIED") {
    status = "LIKELY OCCUPIED";
  }

  return {
    score,
    status,
    reasons,
    hasConflict,
    metrics: { totalConnectors, availableConnectors, currentBookings, queueLength }
  };
};
