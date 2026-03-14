import axios from 'axios';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const PLACE_PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';
const MAX_ATTRACTION_RADIUS_METERS = 50000;
const MAX_ATTRACTIONS_TO_FETCH = 120;
const MAX_STOPS_PER_DAY = 7;
const MAX_ATTRACTION_QUERY_VARIANTS = 10;
const MAX_RECOMMENDATION_ENRICHED_STOPS = 36;
const AMENITY_LOOKUP_TIMEOUT_MS = 3500;
const RESTAURANT_STOP_INTERVAL = 3;
const RESTAURANT_MIN_GAP_STOPS = 3;
const ATM_STOP_INTERVAL = 5;
const ATM_MIN_GAP_STOPS = 4;
const WASHROOM_STOP_INTERVAL = 3;
const WASHROOM_MIN_GAP_STOPS = 2;
const MAX_RESTAURANT_RECOMMENDATIONS_PER_DAY = 3;
const MAX_ATM_RECOMMENDATIONS_PER_DAY = 1;
const MAX_WASHROOM_RECOMMENDATIONS_PER_DAY = 1;

const BUDGET_RANGES = {
  $: { min: 1, max: 2 },
  $$: { min: 2, max: 3 },
  $$$: { min: 3, max: 4 },
};

const CATEGORY_VISIT_MINUTES = {
  museum: 70,
  attraction: 55,
  viewpoint: 35,
  default: 50,
};

// ─── Error helper ────────────────────────────────────────────────────────────

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function parseDateOnly(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInclusive(startDate, endDate) {
  const diff = Math.floor(
    (parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;
  return Math.max(1, diff);
}

function buildStopsPerDayTargets(totalStops, durationDays) {
  if (durationDays <= 0) {
    return [];
  }
  const base = Math.floor(totalStops / durationDays);
  const remainder = totalStops % durationDays;
  return Array.from({ length: durationDays }, (_unused, index) => base + (index < remainder ? 1 : 0));
}

// ─── Google Geocoding ────────────────────────────────────────────────────────

async function geocodeWithGoogle(query) {
  const response = await axios.get(GEOCODING_URL, {
    params: { address: query.trim(), key: GOOGLE_KEY },
    timeout: 10000,
  });

  const result = response.data?.results?.[0];
  if (!result) throw httpError(`Could not find coordinates for "${query}".`, 400);

  const components = result.address_components || [];
  const find = (type) => components.find((c) => c.types.includes(type))?.long_name;
  const label =
    find('sublocality_level_1') ||
    find('sublocality') ||
    find('locality') ||
    result.formatted_address.split(',')[0] ||
    query;

  return {
    label,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    source: 'manual',
  };
}

async function reverseGeocodeWithGoogle(latitude, longitude) {
  try {
    const response = await axios.get(GEOCODING_URL, {
      params: { latlng: `${latitude},${longitude}`, key: GOOGLE_KEY },
      timeout: 10000,
    });

    const result = response.data?.results?.[0];
    if (!result) return 'Local Area';

    const components = result.address_components || [];
    const find = (type) => components.find((c) => c.types.includes(type))?.long_name;
    return (
      find('sublocality_level_1') ||
      find('sublocality') ||
      find('locality') ||
      find('administrative_area_level_2') ||
      result.formatted_address.split(',')[0] ||
      'Local Area'
    );
  } catch (_error) {
    return 'Local Area';
  }
}

// ─── Google Places Nearby Search ─────────────────────────────────────────────

async function googleNearbySearch({ latitude, longitude, radiusMeters, type, keyword }) {
  const params = {
    location: `${latitude},${longitude}`,
    radius: radiusMeters,
    key: GOOGLE_KEY,
  };
  if (type) params.type = type;
  if (keyword) params.keyword = keyword;

  const response = await axios.get(PLACES_NEARBY_URL, { params, timeout: 15000 });
  const status = response.data?.status;
  if (status !== 'OK' && status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${status}`);
  }
  return response.data?.results || [];
}

const GOOGLE_TYPE_TO_CATEGORY = {
  museum: 'museum',
  art_gallery: 'museum',
  amusement_park: 'attraction',
  zoo: 'attraction',
  tourist_attraction: 'attraction',
  park: 'attraction',
  natural_feature: 'attraction',
};

const EXCLUDED_PLACE_TYPES = new Set([
  'travel_agency',
  'insurance_agency',
  'real_estate_agency',
  'finance',
  'accounting',
  'lawyer',
  'car_rental',
  'lodging',
  'hospital',
  'doctor',
  'school',
  'university',
]);

const EXCLUDED_NAME_KEYWORDS = [
  'travel',
  'travels',
  'agency',
  'tours',
  'tour and travels',
  'company',
  'co.',
  'pvt',
  'ltd',
  'llp',
  'office',
  'services',
];

const PUBLIC_ATTRACTION_TYPES = new Set([
  'tourist_attraction',
  'museum',
  'art_gallery',
  'park',
  'natural_feature',
  'zoo',
  'aquarium',
  'church',
  'hindu_temple',
  'mosque',
  'synagogue',
  'place_of_worship',
  'shopping_mall',
  'stadium',
  'amusement_park',
  'rv_park',
  'city_hall',
]);

const EXPANDED_ATTRACTION_QUERIES = [
  { type: 'tourist_attraction' },
  { type: 'museum' },
  { type: 'art_gallery' },
  { type: 'park' },
  { type: 'zoo' },
  { type: 'amusement_park' },
  { type: 'aquarium' },
  { type: 'hindu_temple' },
  { type: 'church' },
  { type: 'mosque' },
  { type: 'synagogue' },
  { keyword: 'fort palace castle monument heritage' },
  { keyword: 'old town heritage district archaeological ruins' },
  { keyword: 'viewpoint hill sunset sunrise skyline observation tower' },
  { keyword: 'river walk lake promenade ghat waterfront' },
  { keyword: 'famous market shopping district handicraft antique night market' },
  { keyword: 'famous street boulevard city square clock tower landmark bridge' },
  { keyword: 'theme park water park adventure park entertainment complex' },
  { keyword: 'science center planetarium exhibition hall cultural center' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function googleNearbySearchAllPages({ latitude, longitude, radiusMeters, type, keyword, maxPages = 1 }) {
  const allResults = [];
  let nextPageToken = null;
  let page = 0;

  do {
    const params = nextPageToken
      ? { pagetoken: nextPageToken, key: GOOGLE_KEY }
      : {
          location: `${latitude},${longitude}`,
          radius: radiusMeters,
          key: GOOGLE_KEY,
          ...(type ? { type } : {}),
          ...(keyword ? { keyword } : {}),
        };

    if (nextPageToken) {
      await sleep(1800);
    }

    const response = await axios.get(PLACES_NEARBY_URL, { params, timeout: 15000 });
    const status = response.data?.status;
    if (status !== 'OK' && status !== 'ZERO_RESULTS' && status !== 'INVALID_REQUEST') {
      break;
    }
    allResults.push(...(response.data?.results || []));
    nextPageToken = response.data?.next_page_token || null;
    page += 1;
  } while (nextPageToken && page < maxPages);

  return allResults;
}

function normalizeGooglePlace(place) {
  const category =
    place.types?.reduce((found, t) => found || GOOGLE_TYPE_TO_CATEGORY[t], null) ||
    'attraction';

  const photoReference = place.photos?.[0]?.photo_reference || '';
  const imageUrl = photoReference
    ? `${PLACE_PHOTO_URL}?maxwidth=1400&photoreference=${encodeURIComponent(photoReference)}&key=${GOOGLE_KEY}`
    : '';

  return {
    id: place.place_id,
    label: place.name,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    imageUrl,
    tags: {
      tourism: category === 'museum' ? 'museum' : 'attraction',
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      openNow: place.opening_hours?.open_now,
    },
  };
}

function isLikelyPublicAttraction(place) {
  const types = place.types || [];
  if (types.some((type) => EXCLUDED_PLACE_TYPES.has(type))) {
    return false;
  }

  const lowerName = String(place.name || '').toLowerCase();
  if (EXCLUDED_NAME_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return false;
  }

  const keywordBoost = [
    'fort',
    'palace',
    'castle',
    'museum',
    'monument',
    'heritage',
    'ruins',
    'viewpoint',
    'garden',
    'park',
    'temple',
    'church',
    'mosque',
    'shrine',
    'market',
    'bazaar',
    'ghat',
    'lake',
    'waterfall',
    'square',
    'bridge',
    'clock tower',
    'planetarium',
    'science center',
    'gallery',
    'aquarium',
    'amusement',
    'theme park',
  ];

  return (
    types.some((type) => PUBLIC_ATTRACTION_TYPES.has(type)) ||
    keywordBoost.some((keyword) => lowerName.includes(keyword))
  );
}

function attractionPopularityScore(place) {
  const rating = Number(place.rating || 0);
  const ratingsCount = Number(place.user_ratings_total || 0);
  return rating * 100 + Math.min(ratingsCount, 5000) * 0.06;
}

async function getNearbyAttractions({ latitude, longitude, radiusMeters = 7000, limit = 240 }) {
  const queryResults = await Promise.allSettled(
    EXPANDED_ATTRACTION_QUERIES.slice(0, MAX_ATTRACTION_QUERY_VARIANTS).map((query) =>
      googleNearbySearchAllPages({
        latitude,
        longitude,
        radiusMeters,
        type: query.type,
        keyword: query.keyword,
        maxPages: 1,
      })
    )
  );
  const combined = queryResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  const seen = new Set();
  const deduped = combined.filter((p) => p.name && !seen.has(p.place_id) && seen.add(p.place_id));
  const strictPublic = deduped
    .filter((place) => isLikelyPublicAttraction(place))
    .filter((place) => Number(place.user_ratings_total || 0) >= 20 && Number(place.rating || 0) >= 3.8)
    .sort((a, b) => attractionPopularityScore(b) - attractionPopularityScore(a));

  if (strictPublic.length >= Math.min(4, limit)) {
    return strictPublic.slice(0, limit).map(normalizeGooglePlace);
  }

  // Fallback when an area has sparse ratings: still exclude obvious companies/agencies.
  const publicFallback = deduped
    .filter((place) => isLikelyPublicAttraction(place))
    .sort((a, b) => attractionPopularityScore(b) - attractionPopularityScore(a));
  return publicFallback.slice(0, limit).map(normalizeGooglePlace);
}

async function getNearbyAmenity({ amenity, latitude, longitude, radiusMeters, limit }) {
  const typeMap = {
    restaurant: { type: 'restaurant' },
    atm: { type: 'atm' },
    toilets: { type: 'establishment', keyword: 'public toilet' },
  };
  const { type, keyword } = typeMap[amenity] || { type: amenity };

  try {
    const results = await googleNearbySearch({ latitude, longitude, radiusMeters, type, keyword });
    const strictAmenityResults = results.filter((place) => {
      if (!place?.name) {
        return false;
      }
      const placeTypes = place.types || [];
      const lowerName = String(place.name).toLowerCase();

      if (amenity === 'restaurant') {
        // Strictly restaurants only: exclude hotels/guest houses/resorts that may show up nearby.
        const isRestaurant = placeTypes.includes('restaurant');
        const hasHospitalityType = placeTypes.includes('lodging');
        const hasHotelLikeName =
          lowerName.includes('hotel') ||
          lowerName.includes('guest house') ||
          lowerName.includes('guesthouse') ||
          lowerName.includes('resort') ||
          lowerName.includes('inn');
        return isRestaurant && !hasHospitalityType && !hasHotelLikeName;
      }

      if (amenity === 'atm') {
        return placeTypes.includes('atm');
      }

      if (amenity === 'toilets') {
        return true;
      }

      return true;
    });

    return strictAmenityResults.map(normalizeGooglePlace).slice(0, limit);
  } catch (_error) {
    return [];
  }
}

// ─── Google Distance Matrix ─────────────────────────────────────────────────

function haversineDistanceKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude));
  return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function buildFallbackMatrix(points) {
  const distances = points.map((from, i) =>
    points.map((to, j) => (i === j ? 0 : haversineDistanceKm(from, to) * 1000))
  );
  const durations = distances.map((row) => row.map((m) => (m / 1000 / 24) * 3600));
  return { distances, durations };
}

async function getDistanceMatrix(points) {
  if (points.length <= 1) return { durations: [[0]], distances: [[0]] };

  try {
    const coordsStr = points.map((p) => `${p.latitude},${p.longitude}`).join('|');
    const response = await axios.get(DISTANCE_MATRIX_URL, {
      params: {
        origins: coordsStr,
        destinations: coordsStr,
        key: GOOGLE_KEY,
      },
      timeout: 15000,
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.rows?.length) {
      throw new Error(`Distance Matrix error: ${data.status}`);
    }

    const durations = data.rows.map((row) =>
      row.elements.map((el) => (el.status === 'OK' ? el.duration.value : Infinity))
    );
    const distances = data.rows.map((row) =>
      row.elements.map((el) => (el.status === 'OK' ? el.distance.value : Infinity))
    );

    return { durations, distances };
  } catch (_error) {
    return buildFallbackMatrix(points);
  }
}

// ─── TSP Algorithms (unchanged) ─────────────────────────────────────────────

function nearestNeighborOrder(matrixDurations) {
  const total = matrixDurations.length;
  const visited = new Set([0]);
  const order = [0];
  let current = 0;

  while (order.length < total) {
    let nextIndex = null;
    let nextDuration = Number.POSITIVE_INFINITY;
    for (let candidate = 1; candidate < total; candidate += 1) {
      if (visited.has(candidate)) continue;
      if (matrixDurations[current][candidate] < nextDuration) {
        nextDuration = matrixDurations[current][candidate];
        nextIndex = candidate;
      }
    }
    if (nextIndex === null) break;
    visited.add(nextIndex);
    order.push(nextIndex);
    current = nextIndex;
  }
  return order;
}

function routeDuration(order, matrixDurations) {
  let sum = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    sum += matrixDurations[order[i]][order[i + 1]];
  }
  return sum;
}

function twoOptImprove(order, matrixDurations, maxPasses = 8) {
  let bestOrder = [...order];
  let bestDuration = routeDuration(bestOrder, matrixDurations);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let improved = false;
    for (let i = 1; i < bestOrder.length - 2; i += 1) {
      for (let k = i + 1; k < bestOrder.length - 1; k += 1) {
        const candidate = [
          ...bestOrder.slice(0, i),
          ...bestOrder.slice(i, k + 1).reverse(),
          ...bestOrder.slice(k + 1),
        ];
        const candidateDuration = routeDuration(candidate, matrixDurations);
        if (candidateDuration < bestDuration) {
          bestOrder = candidate;
          bestDuration = candidateDuration;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return bestOrder;
}

// ─── Category / time helpers ─────────────────────────────────────────────────

function estimateVisitMinutes(attraction) {
  const cat = attraction.tags?.tourism === 'museum' ? 'museum' : (attraction.category || 'attraction');
  return CATEGORY_VISIT_MINUTES[cat] || CATEGORY_VISIT_MINUTES.default;
}

function derivePriceLevel(tags) {
  if (tags?.priceLevel != null) return tags.priceLevel;
  return 2; // default mid-range
}

function isMealTime(totalMinutes) {
  const hour = 8 + Math.floor(totalMinutes / 60);
  return (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
}

function looksCommercialOrTransit(label = '') {
  const text = label.toLowerCase();
  return ['market', 'mall', 'station', 'terminal', 'bazaar', 'downtown', 'center'].some(
    (word) => text.includes(word)
  );
}

// ─── Fallback attractions (last resort only) ─────────────────────────────────

function fallbackAttractions(center, count) {
  const seed = [
    { label: `${center.label} Museum`, latitude: center.latitude + 0.015, longitude: center.longitude + 0.006 },
    { label: `${center.label} Heritage Walk`, latitude: center.latitude - 0.008, longitude: center.longitude + 0.012 },
    { label: `${center.label} Market`, latitude: center.latitude + 0.01, longitude: center.longitude - 0.009 },
    { label: `${center.label} Park`, latitude: center.latitude - 0.013, longitude: center.longitude - 0.007 },
    { label: `${center.label} Art Gallery`, latitude: center.latitude + 0.004, longitude: center.longitude + 0.015 },
    { label: `${center.label} Viewpoint`, latitude: center.latitude - 0.014, longitude: center.longitude + 0.004 },
  ];
  return seed.slice(0, count).map((pt, i) => ({
    id: `fallback-${i + 1}`,
    ...pt,
    imageUrl: '',
    category: i % 3 === 0 ? 'museum' : 'attraction',
    tags: {},
  }));
}

// ─── Location resolver ────────────────────────────────────────────────────────

async function resolveLocationInput(input, role) {
  // Already resolved coords passed directly
  if (input?.selected && Number.isFinite(input.selected.latitude)) {
    return {
      label: input.selected.label || input.text || `${role} location`,
      latitude: input.selected.latitude,
      longitude: input.selected.longitude,
      source: input.selected.source || 'selected',
      accuracy: input.selected.accuracy ?? null,
    };
  }

  if (Number.isFinite(input?.latitude) && Number.isFinite(input?.longitude)) {
    return {
      label: input.label || input.text || `${role} location`,
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source || 'selected',
      accuracy: input.accuracy ?? null,
    };
  }

  if (input?.text?.trim()) {
    return geocodeWithGoogle(input.text.trim());
  }

  if (role === 'from') {
    throw httpError('Current location is required. Please provide live location access.', 400);
  }
  return null;
}

// ─── Smart recommendation helper ─────────────────────────────────────────────

async function fetchSmartRecommendation(amenity, stop, radiusMeters, fallbackLabel) {
  try {
    const candidates = await Promise.race([
      getNearbyAmenity({
        amenity,
        latitude: stop.latitude,
        longitude: stop.longitude,
        radiusMeters,
        limit: 3,
      }),
      new Promise((resolve) => setTimeout(() => resolve([]), AMENITY_LOOKUP_TIMEOUT_MS)),
    ]);
    if (candidates[0]) return candidates[0];
  } catch (_error) {
    // fall through to synthetic fallback
  }
  return {
    id: `fallback-${amenity}-${stop.id}`,
    label: `${fallbackLabel} near ${stop.label}`,
    latitude: stop.latitude + 0.002,
    longitude: stop.longitude + 0.002,
    imageUrl: '',
    tags: {},
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateItineraryPlan(payload) {
  const fromInput = await resolveLocationInput(payload.fromLocation, 'from');
  const areaName = await reverseGeocodeWithGoogle(fromInput.latitude, fromInput.longitude);
  const userEnteredFromLabel =
    payload?.fromLocation?.text?.trim() ||
    payload?.fromLocation?.selected?.label?.trim() ||
    fromInput.label?.trim() ||
    '';
  const canonicalFromLabel = userEnteredFromLabel || areaName || fromInput.label || 'Local Area';
  const from = { ...fromInput, label: canonicalFromLabel };
  const center = { ...from, source: from.source || 'live' };

  const startDate = payload.startDate || toIsoDate(new Date());
  const endDate = payload.endDate || startDate;
  const durationDays = getDaysInclusive(startDate, endDate);
  const maxTotalStopsForTrip = Math.max(1, durationDays * MAX_STOPS_PER_DAY);

  // Fetch real attractions from Google Places using max supported nearby radius.
  let attractions = [];
  try {
    attractions = await getNearbyAttractions({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMeters: MAX_ATTRACTION_RADIUS_METERS,
      limit: Math.min(MAX_ATTRACTIONS_TO_FETCH, maxTotalStopsForTrip),
    });
  } catch (_error) {
    attractions = [];
  }

  // Only use fallback as last resort
  if (attractions.length === 0) {
    attractions = fallbackAttractions(center, Math.min(24, maxTotalStopsForTrip));
  }

  const routeNodes = [
    { id: 'origin', label: from.label, latitude: from.latitude, longitude: from.longitude },
    ...attractions,
  ];

  const matrix = await getDistanceMatrix(routeNodes);
  const nearestPath = nearestNeighborOrder(matrix.durations);
  const optimizedPath = twoOptImprove(nearestPath, matrix.durations);
  const orderedAttractions = optimizedPath
    .slice(1)
    .map((nodeIndex) => routeNodes[nodeIndex])
    .slice(0, maxTotalStopsForTrip);

  const targetStopsPerDay = buildStopsPerDayTargets(orderedAttractions.length, durationDays);
  const days = [];
  let currentDayIndex = 0;
  let dayMinutes = 0;
  let dayStops = [];
  let dayTravelMeters = 0;
  let previousNodeIndex = 0;
  let lastRestaurantRecommendationAt = Number.NEGATIVE_INFINITY;
  let lastAtmRecommendationAt = Number.NEGATIVE_INFINITY;
  let lastWashroomRecommendationAt = Number.NEGATIVE_INFINITY;
  let restaurantsRecommendedToday = 0;
  let atmsRecommendedToday = 0;
  let washroomsRecommendedToday = 0;

  for (let stopIndex = 0; stopIndex < orderedAttractions.length; stopIndex += 1) {
    const stop = orderedAttractions[stopIndex];
    const matrixNodeIndex = routeNodes.findIndex((n) => n.id === stop.id);
    const travelMinutes = Math.round((matrix.durations[previousNodeIndex][matrixNodeIndex] || 0) / 60);
    const travelDistanceMeters = Math.round(matrix.distances[previousNodeIndex][matrixNodeIndex] || 0);
    const visitMinutes = estimateVisitMinutes(stop);
    while (currentDayIndex < durationDays - 1 && (targetStopsPerDay[currentDayIndex] || 0) === 0 && dayStops.length === 0) {
      const dayDate = new Date(parseDateOnly(startDate).getTime() + currentDayIndex * 864e5);
      days.push({
        day: currentDayIndex + 1,
        date: toIsoDate(dayDate),
        stops: dayStops,
        totalMinutes: dayMinutes,
        totalDistanceKm: Number((dayTravelMeters / 1000).toFixed(1)),
      });
      currentDayIndex += 1;
      dayMinutes = 0;
      dayTravelMeters = 0;
      dayStops = [];
      previousNodeIndex = 0;
      lastRestaurantRecommendationAt = Number.NEGATIVE_INFINITY;
      lastAtmRecommendationAt = Number.NEGATIVE_INFINITY;
      lastWashroomRecommendationAt = Number.NEGATIVE_INFINITY;
      restaurantsRecommendedToday = 0;
      atmsRecommendedToday = 0;
      washroomsRecommendedToday = 0;
    }

    const stopRuntimeMinutes = dayMinutes + travelMinutes + visitMinutes;
    const recommendations = [];
    const shouldEnrichStop = stopIndex < MAX_RECOMMENDATION_ENRICHED_STOPS;
    const dayStopPosition = dayStops.length + 1;
    const restaurantGap = dayStopPosition - lastRestaurantRecommendationAt;
    const atmGap = dayStopPosition - lastAtmRecommendationAt;
    const washroomGap = dayStopPosition - lastWashroomRecommendationAt;

    // Restaurant recommendation
    const shouldRecommendMeal =
      dayStopPosition % RESTAURANT_STOP_INTERVAL === 0 ||
      (isMealTime(stopRuntimeMinutes) && restaurantGap >= RESTAURANT_MIN_GAP_STOPS);
    if (
      shouldEnrichStop &&
      shouldRecommendMeal &&
      restaurantGap >= RESTAURANT_MIN_GAP_STOPS &&
      restaurantsRecommendedToday < MAX_RESTAURANT_RECOMMENDATIONS_PER_DAY
    ) {
      const restaurants = await Promise.race([
        getNearbyAmenity({
          amenity: 'restaurant',
          latitude: stop.latitude,
          longitude: stop.longitude,
          radiusMeters: 1200,
          limit: 5,
        }).catch(() => []),
        new Promise((resolve) => setTimeout(() => resolve([]), AMENITY_LOOKUP_TIMEOUT_MS)),
      ]);

      const budgetRange = BUDGET_RANGES[payload.budget] || BUDGET_RANGES.$$;
      const filtered = restaurants.filter((r) => {
        const level = derivePriceLevel(r.tags);
        return level >= budgetRange.min && level <= budgetRange.max;
      });
      const topRestaurant = filtered[0] || restaurants[0];
      if (topRestaurant) {
        recommendations.push({ type: 'restaurant', reason: 'Meal time or logical sightseeing break', place: topRestaurant });
        lastRestaurantRecommendationAt = dayStopPosition;
        restaurantsRecommendedToday += 1;
      }
    }

    // ATM recommendation
    const requiresAtm =
      dayStopPosition % ATM_STOP_INTERVAL === 0 ||
      travelMinutes >= 40 ||
      (looksCommercialOrTransit(stop.label) && atmGap >= ATM_MIN_GAP_STOPS);
    if (
      shouldEnrichStop &&
      requiresAtm &&
      atmGap >= ATM_MIN_GAP_STOPS &&
      atmsRecommendedToday < MAX_ATM_RECOMMENDATIONS_PER_DAY
    ) {
      const atm = await fetchSmartRecommendation('atm', stop, 1500, 'ATM');
      if (atm) {
        recommendations.push({ type: 'atm', reason: 'Commercial corridor or long travel stretch', place: atm });
        lastAtmRecommendationAt = dayStopPosition;
        atmsRecommendedToday += 1;
      }
    }

    // Washroom recommendation
    const needsWashroom =
      dayStopPosition % WASHROOM_STOP_INTERVAL === 0 ||
      travelMinutes >= 30 ||
      (looksCommercialOrTransit(stop.label) && washroomGap >= WASHROOM_MIN_GAP_STOPS);
    if (
      shouldEnrichStop &&
      needsWashroom &&
      washroomGap >= WASHROOM_MIN_GAP_STOPS &&
      washroomsRecommendedToday < MAX_WASHROOM_RECOMMENDATIONS_PER_DAY
    ) {
      const washroom = await fetchSmartRecommendation('toilets', stop, 1200, 'Washroom');
      if (washroom) {
        recommendations.push({ type: 'washroom', reason: 'Tourist/transit hotspot or comfort break window', place: washroom });
        lastWashroomRecommendationAt = dayStopPosition;
        washroomsRecommendedToday += 1;
      }
    }

    dayStops.push({
      sequence: stopIndex + 1,
      id: stop.id,
      label: stop.label,
      category: stop.tags?.tourism === 'museum' ? 'museum' : (stop.category || 'attraction'),
      imageUrl: stop.imageUrl || '',
      latitude: stop.latitude,
      longitude: stop.longitude,
      travelMinutesFromPrevious: travelMinutes,
      travelDistanceKmFromPrevious: Number((travelDistanceMeters / 1000).toFixed(1)),
      visitMinutes,
      recommendations,
    });

    dayMinutes += travelMinutes + visitMinutes;
    dayTravelMeters += travelDistanceMeters;
    previousNodeIndex = matrixNodeIndex;

    const dayTarget = targetStopsPerDay[currentDayIndex] || 0;
    const isLastAttraction = stopIndex === orderedAttractions.length - 1;
    if (!isLastAttraction && dayTarget > 0 && dayStops.length >= dayTarget && currentDayIndex < durationDays - 1) {
      const dayDate = new Date(parseDateOnly(startDate).getTime() + currentDayIndex * 864e5);
      days.push({
        day: currentDayIndex + 1,
        date: toIsoDate(dayDate),
        stops: dayStops,
        totalMinutes: dayMinutes,
        totalDistanceKm: Number((dayTravelMeters / 1000).toFixed(1)),
      });
      currentDayIndex += 1;
      dayMinutes = 0;
      dayTravelMeters = 0;
      dayStops = [];
      previousNodeIndex = 0;
      lastRestaurantRecommendationAt = Number.NEGATIVE_INFINITY;
      lastAtmRecommendationAt = Number.NEGATIVE_INFINITY;
      lastWashroomRecommendationAt = Number.NEGATIVE_INFINITY;
      restaurantsRecommendedToday = 0;
      atmsRecommendedToday = 0;
      washroomsRecommendedToday = 0;
    }
  }

  if (dayStops.length > 0 || days.length === 0) {
    const dayDate = new Date(parseDateOnly(startDate).getTime() + currentDayIndex * 864e5);
    days.push({
      day: currentDayIndex + 1,
      date: toIsoDate(dayDate),
      stops: dayStops,
      totalMinutes: dayMinutes,
      totalDistanceKm: Number((dayTravelMeters / 1000).toFixed(1)),
    });
  }

  const totalStops = days.reduce((sum, day) => sum + day.stops.length, 0);
  const totalDistanceKm = Number(days.reduce((sum, day) => sum + day.totalDistanceKm, 0).toFixed(1));
  const coverImageUrl =
    orderedAttractions.find((item) => item?.imageUrl)?.imageUrl ||
    days.find((day) => day.stops?.[0]?.imageUrl)?.stops?.[0]?.imageUrl ||
    '';

  return {
    title: canonicalFromLabel,
    coverImageUrl,
    createdAtIso: new Date().toISOString(),
    startDate,
    endDate,
    durationDays,
    budget: payload.budget,
    from,
    status: 'planned',
    optimization: {
      routeOptimized: true,
      timeOptimized: true,
      costOptimized: true,
      algorithm: 'Nearest Neighbor + 2-Opt + Greedy Time Allocation',
    },
    stats: { totalStops, totalDistanceKm },
    days,
  };
}
