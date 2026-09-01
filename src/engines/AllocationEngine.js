/**
 * Dynamic Slot Allocation & Virtual Queue Engine
 */

// ─── Booking Management ───────────────────────────────────────────────

export const handleBooking = (stationId, chargerId, userId, date, time) => {
  const bookings = JSON.parse(localStorage.getItem('chargeSpotBookings') || '[]');

  // Conflict detection: same station + charger + date + overlapping time
  const hasConflict = bookings.some(b =>
    b.stationId === stationId &&
    b.chargerId === chargerId &&
    b.date === date &&
    b.time === time &&
    (b.status === 'CONFIRMED' || b.status === 'AT_RISK')
  );

  if (hasConflict) {
    return { error: 'This slot is already booked. Please choose a different time.' };
  }

  const newBooking = {
    id: `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    stationId,
    chargerId,
    userId,
    date,
    time,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  bookings.push(newBooking);
  localStorage.setItem('chargeSpotBookings', JSON.stringify(bookings));
  return newBooking;
};

export const cancelBooking = (bookingId) => {
  const bookings = JSON.parse(localStorage.getItem('chargeSpotBookings') || '[]');
  const updated = bookings.map(b =>
    b.id === bookingId ? { ...b, status: 'CANCELLED' } : b
  );
  localStorage.setItem('chargeSpotBookings', JSON.stringify(updated));
  return updated;
};

export const getActiveBookings = (userId) => {
  const bookings = JSON.parse(localStorage.getItem('chargeSpotBookings') || '[]');
  return bookings.filter(b => b.userId === userId && (b.status === 'CONFIRMED' || b.status === 'AT_RISK'));
};

export const getAllBookings = (userId) => {
  const bookings = JSON.parse(localStorage.getItem('chargeSpotBookings') || '[]');
  return userId ? bookings.filter(b => b.userId === userId) : bookings;
};

// ─── No-Show / Grace Period Simulation ────────────────────────────────

export const checkNoShows = () => {
  const bookings = JSON.parse(localStorage.getItem('chargeSpotBookings') || '[]');
  const now = new Date();
  let updated = false;

  const processed = bookings.map(booking => {
    if (booking.status === 'CONFIRMED') {
      const createdAt = new Date(booking.createdAt);
      const diffMins = (now - createdAt) / 1000 / 60;
      // Simulate: 2-5 min = AT_RISK, >5 min = RELEASED (fast forward for demo)
      if (diffMins > 2 && diffMins <= 5) {
        updated = true;
        return { ...booking, status: 'AT_RISK' };
      } else if (diffMins > 5) {
        updated = true;
        allocateToQueue(booking.stationId, booking.chargerId);
        return { ...booking, status: 'RELEASED' };
      }
    }
    return booking;
  });

  if (updated) {
    localStorage.setItem('chargeSpotBookings', JSON.stringify(processed));
  }
  return processed;
};

export const allocateToQueue = (stationId, chargerId) => {
  // Notify the first person in the queue for this station
  const queue = JSON.parse(localStorage.getItem('chargeSpotQueue') || '[]');
  const nextInQueue = queue.find(q => q.stationId === stationId && q.status === 'WAITING');
  if (nextInQueue) {
    console.log(`[AllocationEngine] Slot at ${stationId}/${chargerId} released. Offering to user ${nextInQueue.userId} (queue position 1)`);
    // In real app: send push notification. Here we just log.
  }
};

// ─── Virtual Queue ─────────────────────────────────────────────────────

export const joinQueue = (stationId, userId) => {
  const queue = JSON.parse(localStorage.getItem('chargeSpotQueue') || '[]');

  // Check already in queue
  const existing = queue.find(q => q.stationId === stationId && q.userId === userId && q.status === 'WAITING');
  if (existing) {
    return { error: 'Already in queue for this station.', entry: existing };
  }

  // Count current waiters at this station
  const stationQueue = queue.filter(q => q.stationId === stationId && q.status === 'WAITING');
  const position = stationQueue.length + 1;

  const entry = {
    id: `Q-${Date.now()}`,
    stationId,
    userId,
    position,
    joinedAt: new Date().toISOString(),
    status: 'WAITING',
  };

  queue.push(entry);
  localStorage.setItem('chargeSpotQueue', JSON.stringify(queue));
  return { success: true, entry, position };
};

export const leaveQueue = (stationId, userId) => {
  const queue = JSON.parse(localStorage.getItem('chargeSpotQueue') || '[]');
  const updated = queue.map(q =>
    q.stationId === stationId && q.userId === userId && q.status === 'WAITING'
      ? { ...q, status: 'LEFT' }
      : q
  );
  localStorage.setItem('chargeSpotQueue', JSON.stringify(updated));

  // Re-number remaining positions
  let pos = 1;
  const renumbered = updated.map(q => {
    if (q.stationId === stationId && q.status === 'WAITING') {
      return { ...q, position: pos++ };
    }
    return q;
  });
  localStorage.setItem('chargeSpotQueue', JSON.stringify(renumbered));
  return renumbered;
};

export const getQueuePosition = (stationId, userId) => {
  const queue = JSON.parse(localStorage.getItem('chargeSpotQueue') || '[]');
  const entry = queue.find(q => q.stationId === stationId && q.userId === userId && q.status === 'WAITING');
  return entry ? entry.position : null;
};

export const getQueueLength = (stationId) => {
  const queue = JSON.parse(localStorage.getItem('chargeSpotQueue') || '[]');
  return queue.filter(q => q.stationId === stationId && q.status === 'WAITING').length;
};

export const getUserQueues = (userId) => {
  const queue = JSON.parse(localStorage.getItem('chargeSpotQueue') || '[]');
  return queue.filter(q => q.userId === userId && q.status === 'WAITING');
};
