/**
 * ReservationEngine.js - Single source of truth for connector availability.
 *
 * Rules:
 * - Future CONFIRMED reservations do NOT make connectors IN USE.
 * - Charger C1 reservation NEVER affects C2/C3/C4.
 * - 30-minute protection buffer BEFORE each future reservation.
 * - Availability computed per connector for specific requested time interval.
 * - No Math.random() for prices, ratings, or availability.
 */

// â”€â”€â”€ Price / Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const FALLBACK_PRICE_PER_KWH = 8.5;
export const CONVENIENCE_FEE = 25;
export const ENERGY_NEED_KWH = 30;
export const SLOT_DURATION_MINUTES = 60;
export const BUFFER_MINUTES = 30;

export const resolvePricePerKWh = (connector) => {
  if (!connector) return FALLBACK_PRICE_PER_KWH;
  const raw = String(connector.price || '').toLowerCase().trim();
  if (!raw || raw === 'unavailable' || raw === 'unknown' || raw === '-') return FALLBACK_PRICE_PER_KWH;
  if (raw === 'free') return 0;
  const match = raw.match(/[\d.]+/);
  if (match) {
    const parsed = parseFloat(match[0]);
    if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) return parsed;
  }
  return FALLBACK_PRICE_PER_KWH;
};

export const calculateEnergyCost = (connector) =>
  parseFloat((resolvePricePerKWh(connector) * ENERGY_NEED_KWH).toFixed(2));

export const calculateTotalPrice = (connector) =>
  parseFloat((calculateEnergyCost(connector) + CONVENIENCE_FEE).toFixed(2));

// â”€â”€â”€ Time Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const parseBookingDateTime = (date, time) => {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if ([year, month, day, hour, minute].some(isNaN)) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

export const getBookingInterval = (booking) => {
  const start = parseBookingDateTime(booking.date, booking.time);
  if (!start) return null;
  return { start, end: new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000) };
};

export const getProtectedInterval = (booking) => {
  const interval = getBookingInterval(booking);
  if (!interval) return null;
  return { start: new Date(interval.start.getTime() - BUFFER_MINUTES * 60 * 1000), end: interval.end };
};

export const intervalsOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

// â”€â”€â”€ Booking Temporal State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getBookingTemporalState = (booking, currentTime = new Date()) => {
  if (!booking) return 'UNKNOWN';
  
  if (['CANCELLED', 'REJECTED', 'COMPLETED'].includes(booking.status)) return booking.status;
  const interval = getBookingInterval(booking);
  if (!interval) return booking.status || 'UNKNOWN';
  if (currentTime >= interval.end) return 'COMPLETED';
  if (currentTime >= interval.start) return 'ACTIVE';
  return 'FUTURE';
};

// â”€â”€â”€ Queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns all PENDING bookings (awaiting admin approval).
 * Future CONFIRMED reservations are NOT queue entries.
 */
export const getActiveQueueEntries = (bookings) =>
  (bookings || []).filter(b => b.status === 'PENDING');

export const getStationQueueCount = (stationId, bookings) =>
  getActiveQueueEntries(bookings).filter(b => b.stationId === stationId).length;

export const getUserQueueEntries = (userId, bookings) =>
  getActiveQueueEntries(bookings).filter(b => b.userId === userId);

export const getTotalActiveQueueCount = (bookings) =>
  getActiveQueueEntries(bookings).length;

// â”€â”€â”€ Core Availability Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * getConnectorAvailability
 * 
 * The SINGLE canonical function for whether a connector is available
 * for a requested time interval.
 * 
 * Returns:
 *   { available, state, reason, conflictingBooking, protectedStart, protectedEnd, availableAfter }
 */
export const getConnectorAvailability = (connector, station, requestedStart, requestedEnd, allBookings) => {
  const make = (available, state, reason, extra = {}) => ({
    available, state, reason,
    conflictingBooking: null, protectedStart: null, protectedEnd: null, availableAfter: null,
    ...extra,
  });

  if (!connector) return make(false, 'UNKNOWN', 'Connector not found');
  if (connector.operationalStatus === 'MAINTENANCE' || connector.status === 'MAINTENANCE')
    return make(false, 'MAINTENANCE', 'This charger is under maintenance.');
  if (connector.operationalStatus === 'OFFLINE' || connector.status === 'OFFLINE')
    return make(false, 'OFFLINE', 'This charger is currently offline.');
  if (!requestedStart || !requestedEnd) return make(true, 'AVAILABLE', 'Available');

  const now = new Date();
  const connectorBookings = (allBookings || []).filter(b =>
    b.stationId === station.id && b.chargerId === connector.id &&
    ['CONFIRMED', 'ACTIVE', 'AT_RISK', 'PENDING'].includes(b.status)
  );

  for (const b of connectorBookings) {
    const interval = getBookingInterval(b);
    if (!interval) continue;
    const temporal = getBookingTemporalState(b, now);

    if (temporal === 'ACTIVE') {
      if (intervalsOverlap(requestedStart, requestedEnd, interval.start, interval.end)) {
        const endStr = interval.end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return make(false, 'ACTIVE_BOOKING',
          'Charger ' + connector.id + ' is currently in use until ' + endStr + '.',
          { conflictingBooking: b, availableAfter: interval.end }
        );
      }
    } else if (temporal === 'FUTURE') {
      const prot = getProtectedInterval(b);
      if (!prot) continue;
      if (intervalsOverlap(requestedStart, requestedEnd, prot.start, prot.end)) {
        const opts = { hour: '2-digit', minute: '2-digit' };
        const resStart = interval.start.toLocaleTimeString('en-IN', opts);
        const resEnd = interval.end.toLocaleTimeString('en-IN', opts);
        const protStart = prot.start.toLocaleTimeString('en-IN', opts);
        return make(false, 'FUTURE_RESERVATION',
          'Charger ' + connector.id + ' is reserved ' + resStart + ' to ' + resEnd + '. New bookings blocked from ' + protStart + ' to prevent overlap.',
          { conflictingBooking: b, protectedStart: prot.start, protectedEnd: prot.end, availableAfter: interval.end }
        );
      }
    } else if (b.status === 'PENDING') {
      if (intervalsOverlap(requestedStart, requestedEnd, interval.start, interval.end)) {
        return make(false, 'DOUBLE_BOOKING',
          'Charger ' + connector.id + ' already has a pending booking for this time.',
          { conflictingBooking: b, availableAfter: interval.end }
        );
      }
    }
  }

  return make(true, 'AVAILABLE', 'Available for your selected time.');
};

/**
 * Returns the CURRENT real-time display state of a connector.
 * State: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'OFFLINE'
 */
export const getConnectorCurrentState = (connector, stationId, allBookings, currentTime = new Date()) => {
  if (connector.operationalStatus === 'MAINTENANCE' || connector.status === 'MAINTENANCE') return 'MAINTENANCE';
  if (connector.operationalStatus === 'OFFLINE' || connector.status === 'OFFLINE') return 'OFFLINE';
  const bookings = (allBookings || []).filter(b =>
    b.stationId === stationId && b.chargerId === connector.id &&
    ['CONFIRMED', 'ACTIVE', 'AT_RISK'].includes(b.status)
  );
  for (const b of bookings) { if (getBookingTemporalState(b, currentTime) === 'ACTIVE') return 'OCCUPIED'; }
  for (const b of bookings) { if (getBookingTemporalState(b, currentTime) === 'FUTURE') return 'RESERVED'; }
  return 'AVAILABLE';
};

/**
 * Derives station network status from connector states.
 * One RESERVED connector does NOT make the station OCCUPIED.
 */
export const deriveStationStatus = (station, allBookings, currentTime = new Date()) => {
  const chargers = (station && station.chargers) ? station.chargers : [];
  if (!chargers.length) return 'UNKNOWN';
  const states = chargers.map(c => getConnectorCurrentState(c, station.id, allBookings, currentTime));
  if (states.every(s => s === 'MAINTENANCE')) return 'MAINTENANCE';
  if (states.every(s => s === 'OFFLINE')) return 'OFFLINE';
  if (states.every(s => s === 'OCCUPIED')) return 'OCCUPIED';
  if (states.some(s => s === 'AVAILABLE')) return 'AVAILABLE';
  return 'LIMITED';
};

// â”€â”€â”€ Booking Sort â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getBookingSortPriority = (booking, currentTime = new Date()) => {
  const t = getBookingTemporalState(booking, currentTime);
  if (t === 'ACTIVE') return 1;
  if (t === 'FUTURE' && booking.status === 'CONFIRMED') return 2;
  if (booking.status === 'PENDING') return 3;
  if (booking.status === 'AT_RISK') return 4;
  if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') return 5;
  return 6; // COMPLETED
};

export const sortBookings = (bookings, currentTime = new Date()) =>
  [...bookings].sort((a, b) => {
    const pa = getBookingSortPriority(a, currentTime), pb = getBookingSortPriority(b, currentTime);
    if (pa !== pb) return pa - pb;
    const ia = getBookingInterval(a), ib = getBookingInterval(b);
    if (ia && ib) return ia.start - ib.start;
    return 0;
  });

// â”€â”€â”€ Station Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Counts truly available chargers RIGHT NOW.
 * Future reservations do NOT reduce this count.
 */
export const getStationAvailableNow = (station, allBookings, currentTime = new Date()) =>
  ((station && station.chargers) ? station.chargers : []).filter(c =>
    getConnectorCurrentState(c, station.id, allBookings, currentTime) === 'AVAILABLE'
  ).length;


