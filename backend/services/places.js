const { Client } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

// Search for wedding venues, planners, coordinators within radius
async function searchWeddingPros(location, radiusMiles, type) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set in .env');

  const radiusMeters = Math.round(radiusMiles * 1609.34);

  const typeQueries = {
    venue: 'wedding venue',
    planner: 'wedding planner',
    coordinator: 'wedding coordinator',
    florist: 'wedding florist',
  };

  const query = typeQueries[type] || type;

  // First, geocode the location to get lat/lng
  let latitude, longitude;
  try {
    const geocodeRes = await client.geocode({
      params: {
        address: location,
        key: apiKey,
      },
    });

    if (!geocodeRes.data.results || geocodeRes.data.results.length === 0) {
      throw new Error(`Could not geocode location: ${location}`);
    }

    const { lat, lng } = geocodeRes.data.results[0].geometry.location;
    latitude = lat;
    longitude = lng;
  } catch (err) {
    throw new Error(`Geocoding failed for "${location}": ${err.message}`);
  }

  const results = [];
  let pageToken = null;

  // Use Nearby Search (which supports radius) instead of Text Search
  for (let page = 0; page < 3; page++) {
    const params = {
      location: { lat: latitude, lng: longitude },
      radius: radiusMeters,
      keyword: query,
      key: apiKey,
    };
    if (pageToken) params.pagetoken = pageToken;

    try {
      const res = await client.placesNearby({ params });

      const places = res.data.results || [];
      for (const place of places) {
        results.push({
          place_id: place.place_id,
          name: place.name,
          address: place.vicinity || place.formatted_address,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          types: place.types || [],
        });
      }

      pageToken = res.data.next_page_token;
      if (!pageToken) break;

      // Google requires a short delay before using next_page_token
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      throw new Error(`Nearby search failed: ${err.message}`);
    }
  }

  return results;
}

// Get details for a specific place
async function getPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set in .env');

  const res = await client.placeDetails({
    params: {
      place_id: placeId,
      fields: ['name', 'formatted_address', 'website', 'formatted_phone_number', 'editorial_summary', 'reviews', 'rating', 'types', 'geometry'],
      key: apiKey,
    },
  });

  const p = res.data.result;
  if (!p) return null;

  // Extract a "specific detail" from editorial summary or top review
  let specificDetail = '';
  if (p.editorial_summary?.overview) {
    specificDetail = p.editorial_summary.overview;
  } else if (p.reviews?.length > 0) {
    // Use a snippet from a top review (truncated, no personal data)
    const review = p.reviews[0].text || '';
    specificDetail = review.substring(0, 120).replace(/\n/g, ' ').trim();
    if (review.length > 120) specificDetail += '…';
  }

  return {
    place_id: placeId,
    name: p.name,
    address: p.formatted_address,
    website: p.website,
    phone: p.formatted_phone_number,
    specific_detail: specificDetail,
    types: p.types || [],
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
  };
}

// Calculate distance between two lat/lng points in miles
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Score a prospect for fit (0-100)
function scoreFit({ distance, rating, reviewCount, radiusMiles }) {
  let score = 50;
  // Distance penalty (closer = better)
  const distanceRatio = distance / radiusMiles;
  score -= Math.round(distanceRatio * 20);
  // Rating boost
  if (rating >= 4.5) score += 25;
  else if (rating >= 4.0) score += 15;
  else if (rating >= 3.5) score += 5;
  // Volume boost
  if (reviewCount >= 100) score += 15;
  else if (reviewCount >= 50) score += 10;
  else if (reviewCount >= 20) score += 5;
  return Math.max(0, Math.min(100, score));
}

module.exports = { searchWeddingPros, getPlaceDetails, haversineDistance, scoreFit };
