/**
 * Calculates Availability Confidence Score based on multiple signals.
 * Core innovation for ChargeSpot prototype.
 */
export const calculateAvailabilityConfidence = (station) => {
  let score = 100;
  let status = "AVAILABLE";
  let reasons = [];

  const { networkApiStatus, activeSessions, recentActivity, bookingQueue } = station;
  const totalChargers = station.chargers.length;

  // Signal 1: Network API
  if (networkApiStatus === "OFFLINE") {
    score -= 40;
    reasons.push("Network API reports station is offline");
    status = "OFFLINE";
  } else if (networkApiStatus === "OCCUPIED") {
    score -= 30;
    reasons.push("Network API reports occupied");
    status = "OCCUPIED";
  } else {
    reasons.push("Network API reports available");
  }

  // Signal 2: Active Sessions vs Total Chargers
  if (activeSessions >= totalChargers) {
    score -= 50;
    reasons.push(`All ${totalChargers} chargers have active sessions`);
    status = "OCCUPIED";
  } else if (activeSessions > 0) {
    score -= (activeSessions / totalChargers) * 20;
    reasons.push(`${activeSessions}/${totalChargers} chargers currently in use`);
  }

  // Signal 3: Recent Activity (Heartbeats, user reports)
  if (recentActivity === "HIGH" && status === "AVAILABLE") {
    score -= 15;
    reasons.push("High recent activity indicates potential incoming users");
  } else if (recentActivity === "LOW" && status === "AVAILABLE") {
    score += 5; // Boost confidence if quiet and reported available
  }

  // Signal 4: Booking Queue
  if (bookingQueue > 0) {
    score -= (bookingQueue * 15);
    reasons.push(`${bookingQueue} users in virtual queue`);
    if (bookingQueue >= totalChargers) status = "OCCUPIED";
  }

  // Conflict Detection
  let hasConflict = false;
  if (networkApiStatus === "AVAILABLE" && (activeSessions >= totalChargers || bookingQueue > 0)) {
    hasConflict = true;
    score -= 20; // Penalty for conflicting data
    reasons.push("Conflict detected: API says available, but active sessions/queue exist");
    status = "LIKELY OCCUPIED";
  }
  
  if (networkApiStatus === "OCCUPIED" && activeSessions === 0 && recentActivity === "LOW") {
    hasConflict = true;
    score -= 10;
    reasons.push("Conflict detected: API says occupied, but no active sessions detected");
    status = "LIKELY AVAILABLE";
  }

  // Normalize score
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Final Status determination based on confidence
  if (score < 40 && status !== "OFFLINE") status = "OCCUPIED";
  else if (score >= 40 && score < 70 && !hasConflict) status = "LIMITED";
  else if (score >= 70 && !hasConflict) status = "AVAILABLE";

  return {
    score,
    status,
    reasons,
    hasConflict
  };
};
