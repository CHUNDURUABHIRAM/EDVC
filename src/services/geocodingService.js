/**
 * Geocoding Service
 * Converts location names (e.g. "Bhimavaram", "Vijayawada", "Visakhapatnam") to [lat, lng] coordinates.
 */

export const searchCityCoordinates = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return null;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())},India&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ChargeSpot-EV-Platform-Prototype'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lat, lng];
      }
    }
    return null;
  } catch (error) {
    console.warn('[GeocodingService] Geocoding lookup failed:', error.message);
    return null;
  }
};
