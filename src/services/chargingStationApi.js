/**
 * Open Charge Map API Integration
 * Performs location-based nearby search using Open Charge Map API.
 */

import { haversineDistance } from '../engines/PredictiveEngine';

const BASE_URL = 'https://api.openchargemap.io/v3/poi';

// Read API key from environment variable safely (NEVER logged or displayed)
const API_KEY = import.meta.env.VITE_OPENCHARGEMAP_API_KEY || import.meta.env.VITE_OCM_API_KEY || '';

/**
 * Fetch charging stations from Open Charge Map centered at specified location.
 */
export const fetchStationsFromOCM = async (params = {}) => {
  const isIndiaWide = params.indiaWide === true;
  const lat = isIndiaWide ? null : (params.latitude ?? 20.5937);
  const lng = isIndiaWide ? null : (params.longitude ?? 78.9629);
  const dist = params.distance ?? 50;

  if (!API_KEY) {
    console.error('[ChargeSpot Developer Configuration Error] VITE_OPENCHARGEMAP_API_KEY is missing in .env.local file!');
  }

  const doFetch = async (queryDistance) => {
    const queryParams = new URLSearchParams({
      output: 'json',
      countrycode: 'IN',
      maxresults: (params.maxresults || 100).toString(),
      compact: 'true',
      verbose: 'false',
    });

    if (!isIndiaWide && lat && lng) {
      queryParams.append('latitude', lat.toString());
      queryParams.append('longitude', lng.toString());
      if (queryDistance) {
        queryParams.append('distance', queryDistance.toString());
        queryParams.append('distanceunit', 'km');
      }
    }

    if (API_KEY) {
      queryParams.append('key', API_KEY);
    }

    const url = `${BASE_URL}?${queryParams.toString()}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  try {
    let rawData = await doFetch(dist);

    // If local search returns no stations, expand search radius
    if (!isIndiaWide && rawData.length === 0) {
      rawData = await doFetch(150);
    }
    if (!isIndiaWide && rawData.length === 0) {
      rawData = await doFetch(300);
    }

    const mapped = mapOCMDataToChargeSpot(rawData);

    // Development logs (PRIVACY SAFE: NEVER logging API key)
    console.log(`[ChargeSpot API Log] User Latitude: ${lat}`);
    console.log(`[ChargeSpot API Log] User Longitude: ${lng}`);
    console.log(`[ChargeSpot API Log] API Results Count: ${mapped.length}`);

    if (!isIndiaWide && mapped.length > 0 && lat && lng) {
      const sortedByDist = [...mapped].sort((a, b) => {
        const dA = haversineDistance([lat, lng], a.coordinates);
        const dB = haversineDistance([lat, lng], b.coordinates);
        return dA - dB;
      });
      const nearest = sortedByDist[0];
      const d = haversineDistance([lat, lng], nearest.coordinates).toFixed(1);
      console.log(`[ChargeSpot API Log] Nearest Station: "${nearest.name}" (${d} km)`);
    }

    return mapped;

  } catch (error) {
    console.warn('[ChargeSpot API Error] Fetch failed:', error.message);
    return null; // Return null to signal API error
  }
};

import { appState } from './appState';

/**
 * Maps OCM POI data to ChargeSpot internal format
 */
const mapOCMDataToChargeSpot = (ocmData) => {
  if (!Array.isArray(ocmData)) return [];

  return ocmData
    .filter(poi => poi && poi.AddressInfo && typeof poi.AddressInfo.Latitude === 'number' && typeof poi.AddressInfo.Longitude === 'number')
    .map(poi => {
      const chargers = (poi.Connections || []).map((conn, idx) => {
        let type = 'Standard';
        if (conn.ConnectionTypeID === 33) type = 'CCS2';
        else if (conn.ConnectionTypeID === 25) type = 'Type 2';
        else if (conn.ConnectionTypeID === 2) type = 'CHAdeMO';

        const kw = conn.PowerKW || (conn.Amps && conn.Voltage ? (conn.Amps * conn.Voltage) / 1000 : 22);

        return {
          id: `C${idx + 1}`,
          type: type,
          speed: `${Math.round(kw)} kW`,
          price: poi.UsageCost ? poi.UsageCost : 'Price unavailable',
          status: poi.StatusTypeID === 50 ? 'AVAILABLE' : 'AVAILABLE'
        };
      });

      if (chargers.length === 0) {
        chargers.push({
          id: 'C1', type: 'CCS2', speed: '50 kW', price: poi.UsageCost ? poi.UsageCost : 'Price unavailable', status: 'AVAILABLE'
        });
      }

      return {
        id: `OCM-${poi.ID}`,
        name: poi.AddressInfo?.Title || 'EV Charging Station',
        operator: poi.OperatorInfo?.Title || 'Independent Operator',
        location: poi.AddressInfo?.AddressLine1 || poi.AddressInfo?.Town || 'Charging Location',
        city: poi.AddressInfo?.Town || poi.AddressInfo?.StateOrProvince || 'Andhra Pradesh',
        coordinates: [Number(poi.AddressInfo.Latitude), Number(poi.AddressInfo.Longitude)],
        networkApiStatus: poi.StatusTypeID === 50 ? 'AVAILABLE' : 'OFFLINE',
        rating: 'Not rated',
        chargers: chargers,
        amenities: ['Parking', 'Wifi'],
        activeSessions: 0,
        bookingQueue: 0,
        recentActivity: 'LOW',
        isLiveData: true
      };
    });
};

import { normalizeStationStatus } from './stationNormalizer';

/**
 * Manages synchronized state between API data and local Operator modifications.
 */
export const syncStations = async (userCoords = null, fetchIndiaWide = false) => {
  const lat = userCoords ? userCoords[0] : 20.5937;
  const lng = userCoords ? userCoords[1] : 78.9629;

  // Fetch real nearby stations from OCM
  const fetched = await fetchStationsFromOCM({
    latitude: lat,
    longitude: lng,
    distance: 50,
    maxresults: fetchIndiaWide ? 2000 : 100,
    indiaWide: fetchIndiaWide
  });

  // If API fetch fails (returns null), return error state so UI can prompt Retry
  if (fetched === null) {
    return {
      stations: [],
      isLiveData: false,
      error: 'Unable to load nearby charging stations'
    };
  }

  let stations = fetched;

  // Filter out any invalid coordinate stations
  stations = stations.filter(st =>
    st &&
    st.id &&
    st.name &&
    Array.isArray(st.coordinates) &&
    st.coordinates.length >= 2 &&
    typeof st.coordinates[0] === 'number' &&
    typeof st.coordinates[1] === 'number' &&
    !isNaN(st.coordinates[0]) &&
    !isNaN(st.coordinates[1]) &&
    st.coordinates[0] >= -90 && st.coordinates[0] <= 90 &&
    st.coordinates[1] >= -180 && st.coordinates[1] <= 180 &&
    !(st.coordinates[0] === 0 && st.coordinates[1] === 0)
  );

  // Overlay local Operator modifications
  const localMods = appState.getOperatorMods();

  const merged = stations.map(st => {
    const mod = localMods[st.id];
    if (mod) {
      const overlaid = {
        ...st,
        isLiveData: true,
        networkApiStatus: mod.networkApiStatus || st.networkApiStatus,
        activeSessions: mod.activeSessions !== undefined ? mod.activeSessions : st.activeSessions,
        bookingQueue: mod.bookingQueue !== undefined ? mod.bookingQueue : st.bookingQueue,
        chargers: (st.chargers || []).map(c => {
          const modC = (mod.chargers || []).find(mc => mc.id === c.id);
          return modC ? { ...c, status: modC.status } : c;
        })
      };
      return normalizeStationStatus(overlaid);
    }
    return normalizeStationStatus({ ...st, isLiveData: true });
  });

  const existingStations = appState.getStations() || [];
  const existingMap = new Map(existingStations.map(s => [s.id, s]));
  merged.forEach(st => existingMap.set(st.id, st));
  const newGlobal = Array.from(existingMap.values());
  
  appState.setStations(newGlobal);

  return { stations: merged, isLiveData: true, error: null };
};
