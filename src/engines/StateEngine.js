/**
 * StateEngine.js
 * 
 * Legacy compatibility shim.
 * All canonical availability/reservation/booking logic has been centralized in ReservationEngine.js.
 * This file re-exports everything from ReservationEngine and adds the synchronizePlatformState function.
 */

import { appState } from '../services/appState';
export {
  FALLBACK_PRICE_PER_KWH, CONVENIENCE_FEE, ENERGY_NEED_KWH, SLOT_DURATION_MINUTES, BUFFER_MINUTES,
  resolvePricePerKWh, calculateEnergyCost, calculateTotalPrice,
  parseBookingDateTime, getBookingInterval, getProtectedInterval, intervalsOverlap,
  getBookingTemporalState,
  getActiveQueueEntries, getStationQueueCount, getUserQueueEntries, getTotalActiveQueueCount,
  getConnectorAvailability, getConnectorCurrentState, deriveStationStatus,
  getBookingSortPriority, sortBookings, getStationAvailableNow,
} from './ReservationEngine';

// deriveConnectorStatus is an alias for getConnectorCurrentState for backward compat
export { getConnectorCurrentState as deriveConnectorStatus } from './ReservationEngine';

import { getBookingTemporalState } from './ReservationEngine';

/**
 * Centralized platform synchronization function.
 * Called whenever ANY booking state changes.
 * Auto-transitions CONFIRMED -> ACTIVE -> COMPLETED based on time.
 * Does NOT persist derived connector statuses to avoid stale state.
 */
export const synchronizePlatformState = () => {
  const bookings = appState.getBookings();
  const currentTime = new Date();

  const updatedBookings = bookings.map(b => {
    const temporalState = getBookingTemporalState(b, currentTime);
    let newStatus = b.status;
    let changed = false;
    if (temporalState === 'COMPLETED' && (b.status === 'CONFIRMED' || b.status === 'ACTIVE')) {
      newStatus = 'COMPLETED';
      changed = true;
    } else if (temporalState === 'ACTIVE' && b.status === 'CONFIRMED') {
      newStatus = 'ACTIVE';
      changed = true;
    } else if (temporalState === 'COMPLETED' && b.status === 'PENDING') {
      newStatus = 'CANCELLED';
      changed = true;
    }
    return { ...b, status: newStatus, _changed: changed };
  });

  const changedBookings = updatedBookings.filter(b => b._changed);
  if (changedBookings.length > 0) {
    import('../services/firebaseBookings').then(({ updateBookingStatus }) => {
      changedBookings.forEach(b => updateBookingStatus(b.id, b.status));
    });
  }

  // Persist the updated bookings to appState (still used for UI reactivity)
  appState.setBookings(updatedBookings);
};

export const getQueuePositionForBooking = (booking, bookings) => {
  const pending = (bookings || []).filter(b => b.status === 'PENDING' && b.stationId === booking.stationId);
  pending.sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
  const index = pending.findIndex(b => b.id === booking.id);
  return index !== -1 ? index + 1 : null;
};