import { db } from '../firebase';
import { auth } from '../services/firebaseAuth';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDocs, query, orderBy, where, getDoc, runTransaction } from 'firebase/firestore';

// Debug logger
const logFirestore = (msg, obj) => {
  console.log('[FIRESTORE DEBUG]', msg, obj);
};

const BOOKINGS_COLLECTION = 'bookings';

// In‑memory cache of bookings
let cachedBookings = [];
let isMigrated = false;

// Required fields for a booking document
const REQUIRED_FIELDS = [
  'id',
  'userId',
  'userName',
  'userEmail',
  'evModel',
  'stationId',
  'chargerId',
  'date',
  'time',
  'status',
  'energyNeed',
  'pricePerKWh',
  'energyCost',
  'convenienceFee',
  'totalPrice',
];

/** Validate that a booking object contains all required fields */
function validateBookingData(data) {
  const missing = REQUIRED_FIELDS.filter(f => data[f] === undefined || data[f] === null);
  if (missing.length) {
    throw new Error(`Booking data missing required fields: ${missing.join(', ')}`);
  }
}

/** Subscribe to bookings collection (admin flag determines scope) */
export const subscribeToBookings = (callback, isAdmin = false, passedUid = null) => {
  const uid = passedUid || auth.currentUser?.uid;
  const adminFlag = !!isAdmin;
  const prefix = isAdmin ? '[ADMIN FIRESTORE]' : '[USER FIRESTORE]';
  console.log(`${prefix} Auth UID: ${uid}`);
  if (isAdmin) console.log(`${prefix} Admin verified: ${adminFlag}`);



  // Guard against undefined UID for non-admin queries (e.g., during tests or unauthenticated state)
  if (!adminFlag && !uid) {
    console.warn(`${prefix} No UID available; returning no-op unsubscribe.`);
    return () => {};
  }
  const q = adminFlag
    ? query(collection(db, BOOKINGS_COLLECTION), orderBy('createdAt', 'desc'))
    : query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));

  console.log(`${prefix} Subscribing to bookings`, { admin: adminFlag, query: q });

  return onSnapshot(
    q,
    snapshot => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      cachedBookings = bookings;
      if (callback) callback(bookings);
      window.dispatchEvent(new Event('chargespot-state-changed'));
      console.log(`${prefix} Snapshot count:`, snapshot.size);
      console.log(`${prefix} Snapshot booking IDs:`, bookings.map(b => b.id).join(', '));
    },
    error => {
      console.error(`${prefix} Snapshot error:`, error);
    }
  );
};





export const getCachedBookings = () => cachedBookings;

/** Update a booking document */
export const updateBooking = async (bookingId, updates) => {
  if (!auth.currentUser) {
    throw new Error('User not authenticated');
  }
  const docRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
};

/** Create a new booking document */
export const createBooking = async bookingData => {
  if (!auth.currentUser) {
    throw new Error('User not authenticated');
  }
  const uid = auth.currentUser.uid;
  if (bookingData.userId && bookingData.userId !== uid) {
    throw new Error('Permission denied: cannot create booking for another user');
  }

  // Fetch user profile to get display name (fallback to email prefix)
  let userName = '';
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const profile = userSnap.data();
      userName = profile.displayName || profile.name || (profile.email ? profile.email.split('@')[0] : '');
    }
  } catch (e) {
    console.warn('[BOOKING FIRESTORE DEBUG] Failed to fetch user profile for name', e);
  }

  // Prepare final data, include userName (fallback to email prefix if still empty)
  const finalData = {
    ...bookingData,
    userId: bookingData.userId || uid,
    userEmail: bookingData.userEmail || (auth.currentUser && auth.currentUser.email) || '',
    userName: bookingData.userName || userName || (bookingData.userEmail ? bookingData.userEmail.split('@')[0] : ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  validateBookingData(finalData);

  const docRef = doc(db, BOOKINGS_COLLECTION, finalData.id);

  // Import helpers for interval calculations
  const { getBookingInterval, getProtectedInterval, intervalsOverlap } = await import('../engines/ReservationEngine');

  // Detailed debug logging before Firestore write
  console.log('[BOOKING FIRESTORE DEBUG] operation: createBooking');
  console.log('[BOOKING FIRESTORE DEBUG] auth UID:', uid);
  console.log('[BOOKING FIRESTORE DEBUG] booking userId:', finalData.userId);
  console.log('[BOOKING FIRESTORE DEBUG] booking ID:', finalData.id);
  console.log('[BOOKING FIRESTORE DEBUG] collection:', BOOKINGS_COLLECTION);
  console.log('[BOOKING FIRESTORE DEBUG] payload:', finalData);

  try {

    await setDoc(doc(db, BOOKINGS_COLLECTION, finalData.id), finalData);

  } catch (error) {
    console.error('[BOOKING FIRESTORE ERROR] code:', error.code, 'message:', error.message);
    throw error;
  }

  // Update in‑memory cache so admin test shortcut sees the new booking
  cachedBookings = [finalData, ...cachedBookings];
  // Ensure cache stays sorted by createdAt (newest first)
  cachedBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  console.log('[FIRESTORE DEBUG] Booking created successfully', finalData);
  return finalData;
};

export const updateBookingStatus = async (bookingId, status) => {
  await updateBooking(bookingId, { status });
};

export const acceptBooking = async bookingId => updateBookingStatus(bookingId, 'CONFIRMED');
export const rejectBooking = async bookingId => updateBookingStatus(bookingId, 'CANCELLED');
export const cancelBooking = async bookingId => updateBookingStatus(bookingId, 'CANCELLED');
export const markBookingCompleted = async bookingId => updateBookingStatus(bookingId, 'COMPLETED');

/** Migrate legacy bookings stored in localStorage to Firestore. */
export const migrateLocalBookings = async () => {
  if (isMigrated) return;

  try {
    const stored = localStorage.getItem('chargeSpotBookings');
    if (!stored) { isMigrated = true; return; }
    const localBookings = JSON.parse(stored);
    if (!Array.isArray(localBookings) || localBookings.length === 0) {
      isMigrated = true;
      return;
    }

    // Determine if current user is admin and query accordingly
    let queryRef;
    const uid = auth.currentUser?.uid;
    if (uid) {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const isAdmin = userDoc.exists() && userDoc.data().role === 'admin';
      queryRef = isAdmin
        ? collection(db, BOOKINGS_COLLECTION)
        : query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
    } else {
      // No authenticated user; empty result set
      queryRef = collection(db, BOOKINGS_COLLECTION);
    }
    const firestoreSnap = await getDocs(queryRef);
    const firestoreIds = new Set(firestoreSnap.docs.map(d => d.id));

    for (const b of localBookings) {
      if (!b?.id) {
        console.warn('[MIGRATION] Skipping booking without ID', b);
        continue;
      }
      if (firestoreIds.has(b.id)) continue;

      const migratedBooking = {
        ...b,
        userId: b.userId || b.uid || b.userUid || null,
        userName: b.userName || b.name || '',
        userEmail: b.userEmail || b.email || '',
        evModel: b.evModel || '',
        createdAt: b.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!migratedBooking.userId) {
        console.warn(`[MIGRATION] Booking ${b.id} has no valid userId. Skipping automatic migration.`);
        continue;
      }

      try {
        validateBookingData(migratedBooking);
        const docRef = doc(db, BOOKINGS_COLLECTION, migratedBooking.id);
        await setDoc(docRef, migratedBooking, { merge: true });
        firestoreIds.add(migratedBooking.id);
        console.log(`[MIGRATION] Migrated legacy booking ${migratedBooking.id}`);
      } catch (error) {
        console.warn(`[MIGRATION] Skipping legacy booking ${b.id}:`, error);
      }
    }

    isMigrated = true;
  } catch (error) {
    console.error('[MIGRATION] Legacy booking migration failed:', error);
    throw error;
  }
};
