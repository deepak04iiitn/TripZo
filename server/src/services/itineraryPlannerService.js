import axios from 'axios';
import GeocodeCache from '../models/GeocodeCache.js';
import ItineraryCache from '../models/ItineraryCache.js';
import PlaceCache from '../models/PlaceCache.js';
import { assertCanGenerateNewItinerary, recordGoogleApiUsageCost } from './creditGuardService.js';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const PLACE_PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';
const MAX_ATTRACTIONS_TO_FETCH = 50;
const MAX_CITY_ATTRACTION_QUERY_VARIANTS = 8;
const MAX_CITY_TEXT_SEARCH_PAGES = 2;
const MAX_STOPS_PER_DAY = 7;
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
const MEDICAL_STOP_INTERVAL = 6;
const MEDICAL_MIN_GAP_STOPS = 5;
const MAX_MEDICAL_RECOMMENDATIONS_PER_DAY = 1;

const BUDGET_RANGES = {
  $: { min: 1, max: 2 },
  $$: { min: 2, max: 3 },
  $$$: { min: 3, max: 4 },
};

const COORDINATE_CACHE_PRECISION = 3;

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

// ─── Cache helpers ────────────────────────────────────────────────────────────

function toRoundedCoordinate(value, precision = COORDINATE_CACHE_PRECISION) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(precision));
}

function normalizeLocationName(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/,?\s*india$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCityFromAddressComponents(addressComponents = [], fallback = '') {
  const find = (type) => addressComponents.find((component) => component.types?.includes(type))?.long_name;
  return (
    find('locality') ||
    find('postal_town') ||
    find('administrative_area_level_2') ||
    find('administrative_area_level_1') ||
    fallback ||
    'Local Area'
  );
}

function extractCityHintFromInput(input = {}) {
  const raw = String(input?.text || input?.selected?.label || input?.label || '').trim();
  if (!raw) {
    return '';
  }
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : raw;
}

function buildLocationKey(latitude, longitude) {
  const lat = toRoundedCoordinate(latitude);
  const lng = toRoundedCoordinate(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return `${lat}:${lng}`;
}

function normalizeCachedPlaces(places = []) {
  return places.map((place) => ({
    place_id: place.placeId || '',
    name: place.name || '',
    types: Array.isArray(place.types) ? place.types : [],
    geometry: {
      location: {
        lat: place.latitude,
        lng: place.longitude,
      },
    },
    rating: place.rating ?? undefined,
    user_ratings_total: place.userRatingsTotal ?? undefined,
    price_level: place.priceLevel ?? undefined,
    photos: place.photoReference ? [{ photo_reference: place.photoReference }] : [],
  }));
}

function normalizePlacesForCache(places = []) {
  return places
    .filter((place) => Number.isFinite(place?.geometry?.location?.lat) && Number.isFinite(place?.geometry?.location?.lng))
    .map((place) => ({
      placeId: place.place_id || '',
      name: place.name || '',
      types: Array.isArray(place.types) ? place.types : [],
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: Number.isFinite(place.rating) ? place.rating : null,
      userRatingsTotal: Number.isFinite(place.user_ratings_total) ? place.user_ratings_total : null,
      priceLevel: Number.isFinite(place.price_level) ? place.price_level : null,
      photoReference: place.photos?.[0]?.photo_reference || '',
    }));
}

function getCandidateFromLabels(payload = {}) {
  const labels = [
    payload?.fromLocation?.text,
    payload?.fromLocation?.selected?.label,
    payload?.fromLocation?.label,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return [...new Set(labels)];
}

function getCoordinatesFromPayload(payload = {}) {
  const selected = payload?.fromLocation?.selected || {};
  if (Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)) {
    return { latitude: selected.latitude, longitude: selected.longitude };
  }
  if (Number.isFinite(payload?.fromLocation?.latitude) && Number.isFinite(payload?.fromLocation?.longitude)) {
    return { latitude: payload.fromLocation.latitude, longitude: payload.fromLocation.longitude };
  }
  return null;
}

// ─── Google Geocoding ────────────────────────────────────────────────────────

async function geocodeWithGoogle(query) {
  const rawQuery = String(query || '').trim();
  const normalizedQuery = normalizeLocationName(rawQuery);
  if (!normalizedQuery) {
    throw httpError('Location query is required.', 400);
  }

  const cached = await GeocodeCache.findOne({
    $or: [{ normalizedName: normalizedQuery }, { aliases: normalizedQuery }],
  }).lean();
  if (cached) {
    return {
      label: cached.locationName || rawQuery,
      latitude: cached.latitude,
      longitude: cached.longitude,
      source: 'cache',
    };
  }

  const response = await axios.get(GEOCODING_URL, {
    params: { address: rawQuery, key: GOOGLE_KEY },
    timeout: 10000,
  });
  await recordGoogleApiUsageCost({ apiType: 'geocode', requestCount: 1 });

  const result = response.data?.results?.[0];
  if (!result) throw httpError(`Could not find coordinates for "${query}".`, 400);

  const components = result.address_components || [];
  const find = (type) => components.find((c) => c.types.includes(type))?.long_name;
  const city = extractCityFromAddressComponents(components, rawQuery);
  const label =
    find('sublocality_level_1') ||
    find('sublocality') ||
    find('locality') ||
    result.formatted_address.split(',')[0] ||
    rawQuery;

  const latitude = result.geometry.location.lat;
  const longitude = result.geometry.location.lng;
  const latitudeRounded = toRoundedCoordinate(latitude);
  const longitudeRounded = toRoundedCoordinate(longitude);
  const formattedAddress = result.formatted_address || '';
  const canonicalNormalizedName = normalizeLocationName(formattedAddress || label || rawQuery);

  await GeocodeCache.findOneAndUpdate(
    { normalizedName: canonicalNormalizedName || normalizedQuery },
    {
      locationName: label,
      normalizedName: canonicalNormalizedName || normalizedQuery,
      latitude,
      longitude,
      latitudeRounded,
      longitudeRounded,
      formattedAddress,
      source: 'google',
      $addToSet: {
        aliases: { $each: [normalizedQuery, canonicalNormalizedName].filter(Boolean) },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    label,
    city,
    latitude,
    longitude,
    source: 'manual',
  };
}

async function reverseGeocodeDetailsWithGoogle(latitude, longitude) {
  try {
    const latitudeRounded = toRoundedCoordinate(latitude);
    const longitudeRounded = toRoundedCoordinate(longitude);
    const cached = await GeocodeCache.findOne({
      latitudeRounded,
      longitudeRounded,
    }).lean();
    if (cached?.locationName) {
      return {
        label: cached.locationName,
        city: extractCityFromAddressComponents([], cached.locationName),
      };
    }

    const response = await axios.get(GEOCODING_URL, {
      params: { latlng: `${latitude},${longitude}`, key: GOOGLE_KEY },
      timeout: 10000,
    });
    await recordGoogleApiUsageCost({ apiType: 'geocode', requestCount: 1 });

    const result = response.data?.results?.[0];
    if (!result) {
      return { label: 'Local Area', city: 'Local Area' };
    }

    const components = result.address_components || [];
    const find = (type) => components.find((c) => c.types.includes(type))?.long_name;
    const city = extractCityFromAddressComponents(components, 'Local Area');
    const label = find('sublocality_level_1') || find('sublocality') || city || result.formatted_address.split(',')[0] || 'Local Area';
    const formattedAddress = result.formatted_address || '';
    const canonicalNormalizedName = normalizeLocationName(formattedAddress || label);

    await GeocodeCache.findOneAndUpdate(
      { normalizedName: canonicalNormalizedName || normalizeLocationName(label) },
      {
        locationName: label,
        normalizedName: canonicalNormalizedName || normalizeLocationName(label),
        latitude,
        longitude,
        latitudeRounded,
        longitudeRounded,
        formattedAddress,
        source: 'google_reverse',
        $addToSet: {
          aliases: {
            $each: [normalizeLocationName(label), canonicalNormalizedName].filter(Boolean),
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return { label, city };
  } catch (_error) {
    return { label: 'Local Area', city: 'Local Area' };
  }
}

// ─── Google Places Nearby Search ─────────────────────────────────────────────

async function getCachedNearbyPlaces({ latitude, longitude, radiusMeters, type, keyword, maxPages = 1 }) {
  const latitudeRounded = toRoundedCoordinate(latitude);
  const longitudeRounded = toRoundedCoordinate(longitude);
  const locationKey = buildLocationKey(latitude, longitude);
  const geocodeMatch = await GeocodeCache.findOne({ latitudeRounded, longitudeRounded }).lean();
  const normalizedLocationName =
    normalizeLocationName(geocodeMatch?.locationName || geocodeMatch?.formattedAddress || '') || locationKey;
  const query = {
    locationKey,
    radiusMeters,
    type: String(type || ''),
    keyword: String(keyword || ''),
    maxPages,
  };

  const cached = await PlaceCache.findOne(query).lean();
  if (cached) {
    return normalizeCachedPlaces(cached.places);
  }

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
    await recordGoogleApiUsageCost({ apiType: 'places_nearby', requestCount: 1 });
    const status = response.data?.status;
    if (status !== 'OK' && status !== 'ZERO_RESULTS' && status !== 'INVALID_REQUEST') {
      throw new Error(`Places API error: ${status}`);
    }
    allResults.push(...(response.data?.results || []));
    nextPageToken = response.data?.next_page_token || null;
    page += 1;
  } while (nextPageToken && page < maxPages);

  await PlaceCache.findOneAndUpdate(
    query,
    {
      ...query,
      normalizedLocationName,
      latitudeRounded,
      longitudeRounded,
      source: 'google_places',
      places: normalizePlacesForCache(allResults),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return allResults;
}

async function googleNearbySearch({ latitude, longitude, radiusMeters, type, keyword }) {
  return getCachedNearbyPlaces({ latitude, longitude, radiusMeters, type, keyword, maxPages: 1 });
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
  'restaurant',
  'food',
  'cafe',
  'meal_takeaway',
  'meal_delivery',
  'train_station',
  'subway_station',
  'transit_station',
  'bus_station',
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
  'restaurant',
  'railway station',
  'train station',
  'metro station',
  'junction',
  'hotel',
  'resort',
  'guest house',
  'guesthouse',
  'hostel',
  'inn',
  'stay',
  'stays',
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


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function googleNearbySearchAllPages({ latitude, longitude, radiusMeters, type, keyword, maxPages = 1 }) {
  try {
    return await getCachedNearbyPlaces({ latitude, longitude, radiusMeters, type, keyword, maxPages });
  } catch (_error) {
    return [];
  }
}

async function googleTextSearchAllPages({ query, maxPages = 1 }) {
  const allResults = [];
  let nextPageToken = null;
  let page = 0;

  do {
    const params = nextPageToken
      ? { pagetoken: nextPageToken, key: GOOGLE_KEY }
      : { query, key: GOOGLE_KEY };

    if (nextPageToken) {
      await sleep(1800);
    }

    const response = await axios.get(PLACES_TEXT_SEARCH_URL, { params, timeout: 15000 });
    await recordGoogleApiUsageCost({ apiType: 'places_nearby', requestCount: 1 });
    const status = response.data?.status;
    if (status !== 'OK' && status !== 'ZERO_RESULTS' && status !== 'INVALID_REQUEST') {
      throw new Error(`Places Text Search API error: ${status}`);
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
      placeTypes: Array.isArray(place.types) ? place.types : [],
    },
  };
}

function isExcludedStayFoodTransitPlace(place = {}) {
  const lowerName = String(place.name || place.label || '').toLowerCase();
  const rawTypes = [
    ...(Array.isArray(place.types) ? place.types : []),
    ...(Array.isArray(place.tags?.placeTypes) ? place.tags.placeTypes : []),
  ];
  const lowerTypes = rawTypes.map((type) => String(type || '').toLowerCase());
  const category = String(place.category || '').toLowerCase();
  const tourismTag = String(place.tags?.tourism || '').toLowerCase();

  if (lowerTypes.some((type) => EXCLUDED_PLACE_TYPES.has(type))) {
    return true;
  }
  if (EXCLUDED_NAME_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return true;
  }
  return (
    category === 'restaurant' ||
    category === 'hotel' ||
    category === 'lodging' ||
    tourismTag === 'hotel' ||
    tourismTag === 'hostel'
  );
}

function isLikelyPublicAttraction(place) {
  const types = place.types || [];
  if (types.some((type) => EXCLUDED_PLACE_TYPES.has(type)) || isExcludedStayFoodTransitPlace(place)) {
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

function compareByPopularityPriority(a, b) {
  const ratingsCountA = Number(a.user_ratings_total || 0);
  const ratingsCountB = Number(b.user_ratings_total || 0);
  if (ratingsCountA !== ratingsCountB) {
    return ratingsCountB - ratingsCountA;
  }
  const ratingA = Number(a.rating || 0);
  const ratingB = Number(b.rating || 0);
  if (ratingA !== ratingB) {
    return ratingB - ratingA;
  }
  // Google Nearby/Text Search does not expose a separate "reviews count" field;
  // user_ratings_total is used as the closest reliable review-volume proxy.
  const reviewsCountA = Number(a.user_ratings_total || 0);
  const reviewsCountB = Number(b.user_ratings_total || 0);
  return reviewsCountB - reviewsCountA;
}

function buildCityAttractionQueries(cityName) {
  const city = String(cityName || '').trim();
  return [
    `top tourist attractions in ${city}`,
    `best places to visit in ${city}`,
    `must visit places in ${city}`,
    `top rated museums in ${city}`,
    `top landmarks in ${city}`,
    `famous heritage sites in ${city}`,
    `top cultural places in ${city}`,
    `top things to do in ${city}`,
  ];
}

function normalizeManualSelectedAttractions(selectedAttractions = []) {
  return selectedAttractions
    .filter((item) => Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude))
    .filter((item) => !isExcludedStayFoodTransitPlace(item))
    .map((item, index) => ({
      id: String(item.id || `manual-${index + 1}`),
      label: String(item.label || `Selected Place ${index + 1}`),
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      imageUrl: String(item.imageUrl || ''),
      category: item.tags?.tourism === 'museum' ? 'museum' : (item.category || 'attraction'),
      tags: {
        ...(item.tags || {}),
        tourism: item.tags?.tourism || 'attraction',
        rating: item.tags?.rating,
        userRatingsTotal: item.tags?.userRatingsTotal || item.tags?.reviews,
        placeTypes: Array.isArray(item.tags?.placeTypes) ? item.tags.placeTypes : [],
      },
    }));
}

async function getCityTopAttractions({ cityName, limit = 240 }) {
  const queries = buildCityAttractionQueries(cityName).slice(0, MAX_CITY_ATTRACTION_QUERY_VARIANTS);
  const queryResults = await Promise.allSettled(
    queries.map((query) => googleTextSearchAllPages({ query, maxPages: MAX_CITY_TEXT_SEARCH_PAGES }))
  );
  const combined = queryResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  const seen = new Set();
  const deduped = combined.filter((p) => p.name && !seen.has(p.place_id) && seen.add(p.place_id));
  const strictPublic = deduped
    .filter((place) => isLikelyPublicAttraction(place))
    .filter((place) => Number(place.user_ratings_total || 0) >= 20 && Number(place.rating || 0) >= 3.8)
    .sort(compareByPopularityPriority);

  if (strictPublic.length >= Math.min(4, limit)) {
    return strictPublic.slice(0, limit).map(normalizeGooglePlace);
  }

  // Fallback when an area has sparse ratings: still exclude obvious companies/agencies.
  const publicFallback = deduped
    .filter((place) => isLikelyPublicAttraction(place))
    .sort(compareByPopularityPriority);
  return publicFallback.slice(0, limit).map(normalizeGooglePlace);
}

async function getNearbyAmenity({ amenity, latitude, longitude, radiusMeters, limit }) {
  const typeMap = {
    restaurant: { type: 'restaurant' },
    atm: { type: 'atm' },
    toilets: { type: 'establishment', keyword: 'public toilet' },
    medical: { type: 'pharmacy', keyword: 'medical store clinic pharmacy' },
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

      if (amenity === 'medical') {
        // Accept pharmacies, hospitals, clinics, doctors, and health establishments.
        const hasMedicalType = placeTypes.some((t) =>
          ['pharmacy', 'drugstore', 'hospital', 'doctor', 'health', 'dentist'].includes(t)
        );
        const hasMedicalKeyword = [
          'pharmacy',
          'medical',
          'clinic',
          'hospital',
          'chemist',
          'drugstore',
          'health',
          'dispensary',
        ].some((kw) => lowerName.includes(kw));
        return hasMedicalType || hasMedicalKeyword;
      }

      return true;
    });

    // Rank by userRatingsTotal first (popularity), then by rating value.
    const sorted = [...strictAmenityResults].sort((a, b) => {
      const ratingsA = Number(a.user_ratings_total || 0);
      const ratingsB = Number(b.user_ratings_total || 0);
      if (ratingsA !== ratingsB) return ratingsB - ratingsA;
      return Number(b.rating || 0) - Number(a.rating || 0);
    });

    return sorted.map(normalizeGooglePlace).slice(0, limit);
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
    await recordGoogleApiUsageCost({
      apiType: 'distance_matrix',
      elementCount: points.length * points.length,
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
    const selectedSource = input.selected.source || 'selected';
    const explicitText = String(input?.text || '').trim();
    if (selectedSource === 'manual' && explicitText) {
      try {
        const geocoded = await geocodeWithGoogle(explicitText);
        return {
          ...geocoded,
          label: explicitText,
          source: 'manual',
          accuracy: input.selected.accuracy ?? null,
        };
      } catch (_error) {
        // Fall back to provided coordinates below.
      }
    }
    return {
      label: input.selected.label || input.text || `${role} location`,
      latitude: input.selected.latitude,
      longitude: input.selected.longitude,
      source: selectedSource,
      accuracy: input.selected.accuracy ?? null,
      city: extractCityHintFromInput(input),
    };
  }

  if (Number.isFinite(input?.latitude) && Number.isFinite(input?.longitude)) {
    return {
      label: input.label || input.text || `${role} location`,
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source || 'selected',
      accuracy: input.accuracy ?? null,
      city: extractCityHintFromInput(input),
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

async function resolveCityContext(fromResolvedLocation) {
  if (fromResolvedLocation?.city?.trim()) {
    return fromResolvedLocation.city.trim();
  }
  if (fromResolvedLocation?.label?.trim() && fromResolvedLocation?.source === 'manual') {
    return fromResolvedLocation.label.trim();
  }
  const reverse = await reverseGeocodeDetailsWithGoogle(fromResolvedLocation.latitude, fromResolvedLocation.longitude);
  return reverse.city || reverse.label || fromResolvedLocation.label || 'Local Area';
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

async function findCachedItinerary(payload) {
  const startDate = payload.startDate || toIsoDate(new Date());
  const endDate = payload.endDate || startDate;
  const durationDays = getDaysInclusive(startDate, endDate);
  const budget = payload?.budget;
  const normalizedFromCandidates = getCandidateFromLabels(payload).map((label) => normalizeLocationName(label));

  if (normalizedFromCandidates.length) {
    const cachedByName = await ItineraryCache.findOne({
      normalizedFromLocation: { $in: normalizedFromCandidates },
      durationDays,
      budget,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (cachedByName?.itineraryData) {
      return cachedByName.itineraryData;
    }
  }

  const coordinates = getCoordinatesFromPayload(payload);
  if (coordinates) {
    const fromLatitudeRounded = toRoundedCoordinate(coordinates.latitude);
    const fromLongitudeRounded = toRoundedCoordinate(coordinates.longitude);
    const cachedByCoordinates = await ItineraryCache.findOne({
      fromLatitudeRounded,
      fromLongitudeRounded,
      durationDays,
      budget,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (cachedByCoordinates?.itineraryData) {
      return cachedByCoordinates.itineraryData;
    }
  }

  return null;
}

async function saveItineraryToCache(payload, itineraryData) {
  const startDate = payload.startDate || toIsoDate(new Date());
  const endDate = payload.endDate || startDate;
  const durationDays = getDaysInclusive(startDate, endDate);
  const budget = payload?.budget;
  const fromLabel = itineraryData?.from?.label || getCandidateFromLabels(payload)[0] || '';
  const normalizedFromLocation = normalizeLocationName(fromLabel);
  const coordinates = itineraryData?.from
    ? { latitude: itineraryData.from.latitude, longitude: itineraryData.from.longitude }
    : getCoordinatesFromPayload(payload);

  const fromLatitudeRounded = toRoundedCoordinate(coordinates?.latitude);
  const fromLongitudeRounded = toRoundedCoordinate(coordinates?.longitude);
  const toLabel = String(
    payload?.toLocation?.text || payload?.toLocation?.selected?.label || payload?.toLocation?.label || ''
  ).trim();
  const normalizedToLocation = normalizeLocationName(toLabel);
  const query =
    normalizedFromLocation
      ? { normalizedFromLocation, durationDays, budget }
      : { fromLatitudeRounded, fromLongitudeRounded, durationDays, budget };

  await ItineraryCache.findOneAndUpdate(
    query,
    {
      fromLocation: fromLabel,
      normalizedFromLocation,
      toLocation: toLabel,
      normalizedToLocation,
      fromLatitudeRounded,
      fromLongitudeRounded,
      durationDays,
      budget,
      itineraryData,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function previewCityAttractions(payload) {
  await assertCanGenerateNewItinerary();
  const fromInput = await resolveLocationInput(payload.fromLocation, 'from');
  const city = await resolveCityContext(fromInput);
  const attractions = await getCityTopAttractions({
    cityName: city,
    limit: Math.min(MAX_ATTRACTIONS_TO_FETCH, Math.max(10, Number(payload?.limit || 50))),
  });

  return {
    city,
    from: fromInput,
    attractions,
  };
}

export async function generateItineraryPlan(payload) {
  const isManualPlanning = payload?.planMode === 'manual';
  const hasProvidedAttractions = Array.isArray(payload?.selectedAttractions) && payload.selectedAttractions.length > 0;
  const shouldUseCache = !hasProvidedAttractions;
  if (shouldUseCache) {
    const cachedItinerary = await findCachedItinerary(payload);
    if (cachedItinerary) {
      return {
        ...cachedItinerary,
        cacheMeta: { itinerary: 'hit' },
      };
    }
  }
  await assertCanGenerateNewItinerary();

  const fromInput = await resolveLocationInput(payload.fromLocation, 'from');
  const reverseGeo = await reverseGeocodeDetailsWithGoogle(fromInput.latitude, fromInput.longitude);
  const areaName = reverseGeo.label;
  const detectedCity = reverseGeo.city;
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

  const cityContext = (fromInput.city || detectedCity || canonicalFromLabel || 'Local Area').trim();

  // Fetch top attractions city-wise or use manually selected attractions.
  let attractions = [];
  if (hasProvidedAttractions) {
    attractions = normalizeManualSelectedAttractions(payload.selectedAttractions).slice(0, MAX_ATTRACTIONS_TO_FETCH);
  } else {
    try {
      attractions = await getCityTopAttractions({
        cityName: cityContext,
        limit: MAX_ATTRACTIONS_TO_FETCH,
      });
    } catch (_error) {
      attractions = [];
    }
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
  let lastMedicalRecommendationAt = Number.NEGATIVE_INFINITY;
  let restaurantsRecommendedToday = 0;
  let atmsRecommendedToday = 0;
  let washroomsRecommendedToday = 0;
  let medicalsRecommendedToday = 0;

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
      lastMedicalRecommendationAt = Number.NEGATIVE_INFINITY;
      restaurantsRecommendedToday = 0;
      atmsRecommendedToday = 0;
      washroomsRecommendedToday = 0;
      medicalsRecommendedToday = 0;
    }

    const stopRuntimeMinutes = dayMinutes + travelMinutes + visitMinutes;
    const recommendations = [];
    const shouldEnrichStop = stopIndex < MAX_RECOMMENDATION_ENRICHED_STOPS;
    const dayStopPosition = dayStops.length + 1;
    const restaurantGap = dayStopPosition - lastRestaurantRecommendationAt;
    const atmGap = dayStopPosition - lastAtmRecommendationAt;
    const washroomGap = dayStopPosition - lastWashroomRecommendationAt;
    const medicalGap = dayStopPosition - lastMedicalRecommendationAt;

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
      // Filter by budget price level, then rank by popularity (userRatingsTotal) first, rating value second.
      const withinBudget = restaurants.filter((r) => {
        const level = derivePriceLevel(r.tags);
        return level >= budgetRange.min && level <= budgetRange.max;
      });
      const pool = withinBudget.length ? withinBudget : restaurants;
      const topRestaurant = [...pool].sort((a, b) => {
        const ratingCountA = Number(a.tags?.userRatingsTotal || 0);
        const ratingCountB = Number(b.tags?.userRatingsTotal || 0);
        if (ratingCountA !== ratingCountB) return ratingCountB - ratingCountA;
        return Number(b.tags?.rating || 0) - Number(a.tags?.rating || 0);
      })[0];
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

    // Medical shop / clinic recommendation
    const needsMedical =
      dayStopPosition % MEDICAL_STOP_INTERVAL === 0 ||
      (looksCommercialOrTransit(stop.label) && medicalGap >= MEDICAL_MIN_GAP_STOPS);
    if (
      shouldEnrichStop &&
      needsMedical &&
      medicalGap >= MEDICAL_MIN_GAP_STOPS &&
      medicalsRecommendedToday < MAX_MEDICAL_RECOMMENDATIONS_PER_DAY
    ) {
      const medical = await fetchSmartRecommendation('medical', stop, 1500, 'Medical Shop');
      if (medical) {
        recommendations.push({ type: 'medical', reason: 'Nearest pharmacy or clinic on route', place: medical });
        lastMedicalRecommendationAt = dayStopPosition;
        medicalsRecommendedToday += 1;
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
      lastMedicalRecommendationAt = Number.NEGATIVE_INFINITY;
      restaurantsRecommendedToday = 0;
      atmsRecommendedToday = 0;
      washroomsRecommendedToday = 0;
      medicalsRecommendedToday = 0;
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

  const itinerary = {
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

  if (shouldUseCache) {
    await saveItineraryToCache(payload, itinerary);
  }
  return itinerary;
}
