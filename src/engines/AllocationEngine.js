/**
 * Dynamic Slot Allocation & Virtual Queue Engine
 */
import { appState } from '../services/appState';
const allocateToQueue = (stationId, chargerId) => {
  // Placeholder: allocate a released booking to the virtual queue
  // In a full implementation, this would find the next waiting user for the given station/connector
  // and promote them to a confirmed booking. For now, just log for debugging.
  console.warn('[QUEUE] allocateToQueue called for', { stationId, chargerId });
};

// ─── Cancellation Rule Helper ─────────────────────────────────────────

export const isCancellationAllowed = (booking) => {
  if (!booking || (booking.status !== 'CONFIRMED' && booking.status !== 'AT_RISK')) {
    return { allowed: false, cutoffTimeStr: '', message: 'Booking cannot be cancelled.' };
  }

  const { date, time } = booking;
  if (!date || !time) {
    return { allowed: true, cutoffTimeStr: '', message: 'Free cancellation available' };
  }

  // Parse slot date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  
  const slotDate = new Date(year, month - 1, day, hour, minute);
  
  // Cutoff is 3 hours before slot time
  const cutoffDate = new Date(slotDate.getTime() - (3 * 60 * 60 * 1000));
  const now = new Date();

  // Formatted cutoff time string e.g. "3:00 PM"
  const cutoffTimeStr = cutoffDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (now <= cutoffDate) {
    return {
      allowed: true,
      cutoffTimeStr,
      message: `Free cancellation available until ${cutoffTimeStr}`
    };
  } else {
    return {
      allowed: false,
      cutoffTimeStr,
      message: `Cancellation closed — less than 3 hours before the charging slot.`
    };
  }
};

// ─── Booking Management ───────────────────────────────────────────────

export const handleBooking = async (stationId, chargerId, userOrId, date, time) => {
  const bookings = appState.getBookings();
  
  // Extract user info
  const isObject = typeof userOrId === 'object' && userOrId !== null;
  const userId = isObject ? userOrId.userId : userOrId;
  const userName = isObject ? userOrId.userName : 'Unknown';
  const userEmail = isObject ? userOrId.userEmail : '';
  const evModel = isObject ? userOrId.evModel : 'Unknown EV';

  // Parse the requested slot into proper Date objects (handles cross-day bookings correctly)
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const reqStart = new Date(year, month - 1, day, hour, minute);
  const reqEnd = new Date(reqStart.getTime() + 60 * 60 * 1000); // 1-hour slot

  const BUFFER_MS = 30 * 60 * 1000; // 30-minute protection window

  // Canonical overlap detection: [startA, endA) overlaps [startB, endB) iff startA < endB && endA > startB
  const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

  const now = new Date();

  for (const b of bookings) {
    if (b.stationId !== stationId || b.chargerId !== chargerId) continue;
    if (!['CONFIRMED', 'ACTIVE', 'AT_RISK', 'PENDING'].includes(b.status)) continue;
    if (!b.date || !b.time) continue;

    const [by, bm, bd] = b.date.split('-').map(Number);
    const [bh, bmin] = b.time.split(':').map(Number);
    const bStart = new Date(by, bm - 1, bd, bh, bmin);
    const bEnd = new Date(bStart.getTime() + 60 * 60 * 1000);

    const isActive = now >= bStart && now < bEnd;
    const isFuture = now < bStart;

    if (isActive && overlaps(reqStart, reqEnd, bStart, bEnd)) {
      // Conflict with active booking – cannot proceed, return error
      return { error: 'This charger is currently in use. Please choose a different time.', queued: false };
    }

    if (isFuture) {
      // Apply 30-minute protection window before future reservations
      const protStart = new Date(bStart.getTime() - BUFFER_MS);
      if (overlaps(reqStart, reqEnd, protStart, bEnd)) {
        // Conflict with future reservation – place in queue
        return { error: null, queued: true, reason: 'Future reservation blocks this time slot.' };
      }
    }

    // PENDING booking at same time = conflict – place in queue
    if (b.status === 'PENDING' && overlaps(reqStart, reqEnd, bStart, bEnd)) {
      return { error: null, queued: true, reason: 'Existing pending booking at this time.' };
    }
  }

  const newBooking = {
    id: `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    stationId,
    chargerId,
    userId,
    userName,
    userEmail,
    evModel,
    date,
    time,
    status: 'PENDING',
    // Fields required by Firestore security rules – provide sensible defaults
    energyNeed: 0,
    pricePerKWh: 0,
    energyCost: 0,
    convenienceFee: 0,
    totalPrice: 0,
    // createdAt and updatedAt are set in createBooking
  };

  console.log('[FIRESTORE DEBUG] New booking object before Firestore:', newBooking);
  const { createBooking } = await import('../services/firebaseBookings');
  await createBooking(newBooking);

  return newBooking;
};


export const acceptBooking = async (bookingId) => {
  const { acceptBooking: fbAccept } = await import('../services/firebaseBookings');
  await fbAccept(bookingId);
  return { id: bookingId, status: 'CONFIRMED' };
};

export const rejectBooking = async (bookingId) => {
  const { rejectBooking: fbReject } = await import('../services/firebaseBookings');
  await fbReject(bookingId);
  return { id: bookingId, status: 'CANCELLED' };
};

export const cancelBooking = async (bookingId) => {
  const bookings = appState.getBookings();
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return { error: 'Booking not found', bookings };

  const check = isCancellationAllowed(booking);
  if (!check.allowed) {
    return { error: check.message, bookings };
  }

  const { cancelBooking: fbCancel } = await import('../services/firebaseBookings');
  await fbCancel(bookingId);

  return { success: true };
};

export const getActiveBookings = (userId) => {
  const bookings = appState.getBookings();
  return bookings.filter(b => b.userId === userId && (b.status === 'CONFIRMED' || b.status === 'AT_RISK'));
};

export const getAllBookings = (userId) => {
  const bookings = appState.getBookings();
  return userId ? bookings.filter(b => b.userId === userId) : bookings;
};

// ─── No-Show / Grace Period Simulation ────────────────────────────────

export const checkNoShows = () => {
  const bookings = appState.getBookings();
  const now = new Date();
  let updated = false;

  const processed = bookings.map(booking => {
    if (booking.status === 'CONFIRMED') {
      const createdAt = new Date(booking.createdAt);
      const diffMins = (now - createdAt) / 1000 / 60;
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
    appState.setBookings(processed);
  }
  return processed;
};

// ─── Virtual Queue ─────────────────────────────────────────────────────

export const joinQueue = (stationId, userId) => {
  const queue = appState.getQueue();

  const existing = queue.find(q => q.stationId === stationId && q.userId === userId && q.status === 'WAITING');
  if (existing) {
    return { error: 'Already in queue for this station.', entry: existing };
  }

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
  appState.setQueue(queue);
  return { success: true, entry, position };
};

export const leaveQueue = (stationId, userId) => {
  const queue = appState.getQueue();
  const updated = queue.map(q =>
    q.stationId === stationId && q.userId === userId && q.status === 'WAITING'
      ? { ...q, status: 'LEFT' }
      : q
  );
  localStorage.setItem('chargeSpotQueue', JSON.stringify(updated));

  let pos = 1;
  const renumbered = updated.map(q => {
    if (q.stationId === stationId && q.status === 'WAITING') {
      return { ...q, position: pos++ };
    }
    return q;
  });
  appState.setQueue(renumbered);
  return renumbered;
};

export const getQueuePosition = (stationId, userId) => {
  const queue = appState.getQueue();
  const entry = queue.find(q => q.stationId === stationId && q.userId === userId && q.status === 'WAITING');
  return entry ? entry.position : null;
};

export const getQueueLength = (stationId) => {
  const queue = appState.getQueue();
  return queue.filter(q => q.stationId === stationId && q.status === 'WAITING').length;
};

export const getUserQueues = (userId) => {
  const queue = appState.getQueue();
  return queue.filter(q => q.userId === userId && q.status === 'WAITING');
};
