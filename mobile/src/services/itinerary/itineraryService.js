import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestLiveLocation } from '../maps/locationService';
import { geocodeWithPhoton, reverseGeocodeWithPhoton } from '../maps/googleGeocodingService';
import { buildFallbackMatrix, getOsrmDistanceMatrix } from '../maps/googleRoutingService';
import { getNearbyAmenities, getNearbyAttractions } from '../maps/googlePlacesService';
import {
  createTripApi,
  deleteTripApi,
  generateTripDraftApi,
  listExploreTripsApi,
  listSavedTripsApi,
  listTripsApi,
  removeSavedTripForUserApi,
  saveTripForUserApi,
  updateTripLikeApi,
  updateTripStatusApi,
} from './itineraryApiService';

const TRIPS_STORAGE_KEY = 'tripzo.trips.v1';
const SAVED_TRIP_IDS_STORAGE_KEY = 'tripzo.savedTrips.v1';

const BUDGET_RANGES = {
  $: { min: 0, max: 1, label: 'Low' },
  $$: { min: 1, max: 2, label: 'Medium' },
  $$$: { min: 2, max: 4, label: 'Premium' },
};

const CATEGORY_VISIT_MINUTES = {
  museum: 70,
  attraction: 55,
  viewpoint: 35,
  default: 50,
};
const MAX_ATTRACTION_RADIUS_METERS = 50000;
const MAX_ATTRACTIONS_TO_FETCH = 120;
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

function parseDateOnly(value) {
  const [year, month, day] = String(value || '').split('-').map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysInclusive(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, diffDays);
}

function normalizeAttractionCategory(tags) {
  const tourismType = tags?.tourism;
  if (tourismType === 'museum' || tourismType === 'gallery') {
    return 'museum';
  }
  if (tourismType === 'viewpoint') {
    return 'viewpoint';
  }
  return 'attraction';
}

function inferCategoryFromAttraction(attraction) {
  const byTags = normalizeAttractionCategory(attraction?.tags);
  if (byTags !== 'attraction') {
    return byTags;
  }
  const label = String(attraction?.label || '').toLowerCase();
  if (label.includes('museum') || label.includes('gallery') || label.includes('fort') || label.includes('palace')) {
    return 'museum';
  }
  if (label.includes('viewpoint') || label.includes('lookout') || label.includes('sunset point')) {
    return 'viewpoint';
  }
  return 'attraction';
}

function simpleHash(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return hash;
}

function clampMinutes(value, min = 25, max = 120) {
  return Math.max(min, Math.min(max, value));
}

function estimateVisitMinutes(attraction) {
  const category = inferCategoryFromAttraction(attraction);
  const base = CATEGORY_VISIT_MINUTES[category] || CATEGORY_VISIT_MINUTES.default;
  const label = String(attraction?.label || '').toLowerCase();
  let modifier = 0;

  if (label.includes('museum') || label.includes('fort') || label.includes('palace')) {
    modifier += 15;
  } else if (label.includes('park') || label.includes('garden')) {
    modifier -= 10;
  } else if (label.includes('market') || label.includes('bazaar') || label.includes('street')) {
    modifier -= 6;
  } else if (label.includes('viewpoint') || label.includes('lookout')) {
    modifier -= 12;
  }

  const variabilitySeed = `${attraction?.id || ''}-${attraction?.label || ''}`;
  const deterministicSpread = (simpleHash(variabilitySeed) % 21) - 8; // -8 to +12 minutes
  const minutes = clampMinutes(base + modifier + deterministicSpread);
  return Math.round(minutes / 5) * 5;
}

function allocateStopsByDayCapacity(totalStops, dayCapacities) {
  if (!dayCapacities.length) {
    return [];
  }
  const safeCapacities = dayCapacities.map((value) => Math.max(0, Number(value) || 0));
  const capacitySum = safeCapacities.reduce((sum, value) => sum + value, 0);
  if (capacitySum <= 0) {
    return Array.from({ length: safeCapacities.length }, (_v, index) =>
      index === safeCapacities.length - 1 ? totalStops : 0
    );
  }

  const rawTargets = safeCapacities.map((capacity) => (totalStops * capacity) / capacitySum);
  const baseTargets = rawTargets.map((value) => Math.floor(value));
  let assigned = baseTargets.reduce((sum, value) => sum + value, 0);
  let remaining = totalStops - assigned;

  while (remaining > 0) {
    let bestIndex = 0;
    let bestRemainder = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < rawTargets.length; i += 1) {
      const remainder = rawTargets[i] - baseTargets[i];
      if (remainder > bestRemainder) {
        bestRemainder = remainder;
        bestIndex = i;
      }
    }
    baseTargets[bestIndex] += 1;
    rawTargets[bestIndex] = 0;
    assigned += 1;
    remaining = totalStops - assigned;
  }

  return baseTargets;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildBalancedStopTargets(totalStops, dayCapacities) {
  const idealTargets = allocateStopsByDayCapacity(totalStops, dayCapacities);
  const dayCount = idealTargets.length;
  if (!dayCount) {
    return [];
  }

  const targets = Array.from({ length: dayCount }, () => 0);
  let assigned = 0;

  for (let dayIdx = 0; dayIdx < dayCount; dayIdx += 1) {
    const remainingDays = dayCount - dayIdx;
    const remainingStops = totalStops - assigned;
    if (remainingDays === 1) {
      targets[dayIdx] = Math.max(0, remainingStops);
      assigned += targets[dayIdx];
      continue;
    }

    const minForCurrentDay = remainingStops >= remainingDays ? 1 : 0;
    const minForFutureDays = remainingStops >= remainingDays ? remainingDays - 1 : remainingStops;
    const maxForCurrentDay = Math.max(0, remainingStops - minForFutureDays);
    const desired = idealTargets[dayIdx] || 0;
    targets[dayIdx] = clampNumber(desired, minForCurrentDay, maxForCurrentDay);
    assigned += targets[dayIdx];
  }

  return targets;
}

function buildDayTimeLimits(startDate, durationDays, standardDailyTravelMinutes = 8 * 60) {
  const todayIso = toIsoDate(new Date());
  const startsToday = startDate === todayIso;
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const firstDayAvailableMinutesFromNow = Math.max(0, Math.floor((endOfToday.getTime() - now.getTime()) / 60000));
  return Array.from({ length: durationDays }, (_value, index) => {
    if (index === 0 && startsToday) {
      return Math.min(standardDailyTravelMinutes, firstDayAvailableMinutesFromNow);
    }
    return standardDailyTravelMinutes;
  });
}

function rebalanceDaysByCapacity(trip) {
  const durationDays = Math.max(1, Number(trip?.durationDays) || (trip?.days || []).length || 1);
  const startDate = trip?.startDate || toIsoDate(new Date());
  const flattenedStops = (trip?.days || []).flatMap((dayItem) => dayItem.stops || []);

  if (!flattenedStops.length) {
    return {
      ...trip,
      durationDays,
      days: Array.from({ length: durationDays }, (_value, index) => {
        const dayDate = new Date(parseDateOnly(startDate).getTime() + index * 24 * 60 * 60 * 1000);
        return {
          day: index + 1,
          date: toIsoDate(dayDate),
          stops: [],
          totalMinutes: 0,
          totalDistanceKm: 0,
        };
      }),
    };
  }

  const dayTimeLimits = buildDayTimeLimits(startDate, durationDays);
  const targets = buildBalancedStopTargets(flattenedStops.length, dayTimeLimits);
  let cursor = 0;

  const rebuiltDays = Array.from({ length: durationDays }, (_value, index) => {
    const dayDate = new Date(parseDateOnly(startDate).getTime() + index * 24 * 60 * 60 * 1000);
    const targetCount = targets[index] || 0;
    const originalSlice = flattenedStops.slice(cursor, cursor + targetCount);
    cursor += targetCount;
    const dayStops = originalSlice.map((stop, stopIdx) => ({
      ...stop,
      sequence: stopIdx + 1,
    }));
    const totalMinutes = dayStops.reduce(
      (sum, stop) => sum + (stop.travelMinutesFromPrevious || 0) + (stop.visitMinutes || 0),
      0
    );
    const totalDistanceKm = Number(
      dayStops.reduce((sum, stop) => sum + (stop.travelDistanceKmFromPrevious || 0), 0).toFixed(1)
    );
    return {
      day: index + 1,
      date: toIsoDate(dayDate),
      stops: dayStops,
      totalMinutes,
      totalDistanceKm,
    };
  });

  return {
    ...trip,
    durationDays,
    days: rebuiltDays,
    stats: {
      ...(trip.stats || {}),
      totalStops: rebuiltDays.reduce((sum, day) => sum + day.stops.length, 0),
      totalDistanceKm: Number(rebuiltDays.reduce((sum, day) => sum + day.totalDistanceKm, 0).toFixed(1)),
    },
  };
}

function nearestNeighborOrder(matrixDurations) {
  const total = matrixDurations.length;
  const visited = new Set([0]);
  const order = [0];
  let current = 0;

  while (order.length < total) {
    let nextIndex = null;
    let nextDuration = Number.POSITIVE_INFINITY;
    for (let candidate = 1; candidate < total; candidate += 1) {
      if (visited.has(candidate)) {
        continue;
      }
      if (matrixDurations[current][candidate] < nextDuration) {
        nextDuration = matrixDurations[current][candidate];
        nextIndex = candidate;
      }
    }

    if (nextIndex === null) {
      break;
    }
    visited.add(nextIndex);
    order.push(nextIndex);
    current = nextIndex;
  }

  return order;
}

function routeDuration(order, matrixDurations) {
  let sum = 0;
  for (let index = 0; index < order.length - 1; index += 1) {
    sum += matrixDurations[order[index]][order[index + 1]];
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
        const candidate = [...bestOrder.slice(0, i), ...bestOrder.slice(i, k + 1).reverse(), ...bestOrder.slice(k + 1)];
        const candidateDuration = routeDuration(candidate, matrixDurations);
        if (candidateDuration < bestDuration) {
          bestOrder = candidate;
          bestDuration = candidateDuration;
          improved = true;
        }
      }
    }
    if (!improved) {
      break;
    }
  }

  return bestOrder;
}

function derivePriceLevel(tags) {
  const value = Number(tags?.['price:level']);
  if (!Number.isNaN(value)) {
    return value;
  }
  const cuisine = (tags?.cuisine || '').toLowerCase();
  if (cuisine.includes('fine') || cuisine.includes('steak')) {
    return 3;
  }
  if (cuisine.includes('fast_food') || cuisine.includes('street_food')) {
    return 1;
  }
  return 2;
}

function isMealTime(totalMinutes) {
  const hour = 8 + Math.floor(totalMinutes / 60);
  return (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
}

function looksCommercialOrTransit(stopLabel = '') {
  const text = stopLabel.toLowerCase();
  return ['market', 'mall', 'station', 'terminal', 'bazaar', 'downtown', 'center'].some((word) => text.includes(word));
}

async function getDistanceMatrix(points) {
  try {
    return await getOsrmDistanceMatrix(points);
  } catch (_error) {
    return buildFallbackMatrix(points);
  }
}

function fallbackAttractions(targetLocation, count) {
  const seed = [
    { label: `${targetLocation.label} Museum`, latitude: targetLocation.latitude + 0.015, longitude: targetLocation.longitude + 0.006 },
    { label: `${targetLocation.label} Heritage Walk`, latitude: targetLocation.latitude - 0.008, longitude: targetLocation.longitude + 0.012 },
    { label: `${targetLocation.label} Market`, latitude: targetLocation.latitude + 0.01, longitude: targetLocation.longitude - 0.009 },
    { label: `${targetLocation.label} Park`, latitude: targetLocation.latitude - 0.013, longitude: targetLocation.longitude - 0.007 },
    { label: `${targetLocation.label} Art Gallery`, latitude: targetLocation.latitude + 0.004, longitude: targetLocation.longitude + 0.015 },
    { label: `${targetLocation.label} Viewpoint`, latitude: targetLocation.latitude - 0.014, longitude: targetLocation.longitude + 0.004 },
  ];

  return seed.slice(0, count).map((point, index) => ({
    id: `fallback-${index + 1}`,
    ...point,
    imageUrl: '',
    category: index % 3 === 0 ? 'museum' : 'attraction',
    tags: {},
  }));
}

async function resolveLocationInput(input, role) {
  // Explicitly selected place (autocomplete pick or live location button)
  if (input?.mode === 'selected' || input?.mode === 'autocomplete') {
    if (Number.isFinite(input.selected?.latitude)) {
      return {
        label: input.selected.label || input.text || 'Selected place',
        latitude: input.selected.latitude,
        longitude: input.selected.longitude,
        source: 'autocomplete',
      };
    }
  }

  // Live GPS mode
  if (input?.mode === 'live') {
    const current = await requestLiveLocation();
    const areaName = await reverseGeocodeWithPhoton(current.latitude, current.longitude).catch(() => 'Current Location');
    return { ...current, label: areaName || 'Current Location' };
  }

  // Already resolved coords passed directly (e.g. from live location button in HomeScreen)
  if (input?.selected && Number.isFinite(input.selected.latitude) && Number.isFinite(input.selected.longitude)) {
    return {
      label: input.selected.label || input.text || 'Selected place',
      latitude: input.selected.latitude,
      longitude: input.selected.longitude,
      source: input.selected.source || 'autocomplete',
    };
  }

  // Text query — geocode it
  if (input?.text?.trim()) {
    return geocodeWithPhoton(input.text.trim());
  }

  // Final fallback: use live location
  if (role === 'from') {
    const current = await requestLiveLocation();
    const areaName = await reverseGeocodeWithPhoton(current.latitude, current.longitude).catch(() => 'Current Location');
    return { ...current, label: areaName || 'Current Location' };
  }

  return null;
}

async function fetchSmartRecommendation(amenity, stop, radiusMeters, fallbackLabel) {
  try {
    const candidates = await Promise.race([
      getNearbyAmenities({
        amenity,
        latitude: stop.latitude,
        longitude: stop.longitude,
        radiusMeters,
        limit: 3,
      }),
      new Promise((resolve) => setTimeout(() => resolve([]), AMENITY_LOOKUP_TIMEOUT_MS)),
    ]);

    if (candidates[0]) {
      return candidates[0];
    }
    return {
      id: `fallback-${amenity}-${stop.id}`,
      label: `${fallbackLabel} near ${stop.label}`,
      latitude: stop.latitude + 0.002,
      longitude: stop.longitude + 0.002,
      imageUrl: '',
      tags: {},
    };
  } catch (_error) {
    return {
      id: `fallback-${amenity}-${stop.id}`,
      label: `${fallbackLabel} near ${stop.label}`,
      latitude: stop.latitude + 0.002,
      longitude: stop.longitude + 0.002,
      imageUrl: '',
      tags: {},
    };
  }
}

function buildTripSections(trip) {
  const today = new Date();
  const start = parseDateOnly(trip.startDate);
  const end = parseDateOnly(trip.endDate);

  if (trip.status === 'completed' || end < today) {
    return 'completed';
  }
  if (start > today) {
    return 'upcoming';
  }
  return 'ongoing';
}

export function categorizeTrips(trips) {
  return trips.reduce(
    (acc, trip) => {
      acc.all.push(trip);
      const bucket = buildTripSections(trip);
      acc[bucket].push(trip);
      return acc;
    },
    { all: [], ongoing: [], upcoming: [], completed: [] }
  );
}

export async function listTrips() {
  try {
    const trips = await listTripsApi();
    return trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  } catch (_error) {
    const raw = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    const trips = raw ? JSON.parse(raw) : [];
    return trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }
}

export async function saveTrip(trip) {
  try {
    const payload = {
      ...trip,
      createdAtIso: trip.createdAtIso || trip.createdAt || new Date().toISOString(),
    };
    return await createTripApi(payload);
  } catch (_error) {
    const raw = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    const trips = raw ? JSON.parse(raw) : [];
    const nextTrips = [trip, ...trips];
    await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(nextTrips));
    return trip;
  }
}

export async function updateTripStatus(tripId, status) {
  try {
    return await updateTripStatusApi(tripId, status);
  } catch (_error) {
    const raw = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    const trips = raw ? JSON.parse(raw) : [];
    const nextTrips = trips.map((trip) => (trip.id === tripId ? { ...trip, status } : trip));
    await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(nextTrips));
    return nextTrips.find((trip) => trip.id === tripId) || null;
  }
}

export async function deleteTrip(tripId) {
  try {
    await deleteTripApi(tripId);
    return true;
  } catch (_error) {
    const raw = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    const trips = raw ? JSON.parse(raw) : [];
    const nextTrips = trips.filter((trip) => trip.id !== tripId);
    await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(nextTrips));
    return true;
  }
}

export async function updateTripLike(tripId, like) {
  try {
    return await updateTripLikeApi(tripId, like);
  } catch (_error) {
    const raw = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    const trips = raw ? JSON.parse(raw) : [];
    const nextTrips = trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            isLiked: like,
            likesCount: like ? 1 : 0,
          }
        : trip
    );
    await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(nextTrips));
    return nextTrips.find((trip) => trip.id === tripId) || null;
  }
}

function normalizeExploreFilters(filters = {}) {
  const params = {};
  if (filters.search?.trim()) {
    params.search = filters.search.trim();
  }
  if (['$', '$$', '$$$'].includes(filters.budget)) {
    params.budget = filters.budget;
  }
  if (['newest', 'popular', 'durationAsc', 'durationDesc'].includes(filters.sort)) {
    params.sort = filters.sort;
  }

  const parseDurationBoundary = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' && !value.trim()) {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(1, Math.floor(parsed));
  };

  const durationMin = parseDurationBoundary(filters.durationMin);
  const durationMax = parseDurationBoundary(filters.durationMax);

  if (durationMin !== null) {
    params.durationMin = durationMin;
  }
  if (durationMax !== null) {
    params.durationMax = durationMax;
  }
  return params;
}

async function loadSavedTripIdsLocal() {
  const raw = await AsyncStorage.getItem(SAVED_TRIP_IDS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveSavedTripIdsLocal(ids) {
  await AsyncStorage.setItem(SAVED_TRIP_IDS_STORAGE_KEY, JSON.stringify(ids));
}

export async function listExploreTrips(filters = {}) {
  const params = normalizeExploreFilters(filters);
  try {
    const trips = await listExploreTripsApi(params);
    return trips.filter((trip) => trip?.status === 'completed' && !trip?.isSaved);
  } catch (_error) {
    const allTrips = await listTrips();
    const savedIds = new Set(await loadSavedTripIdsLocal());
    const search = String(params.search || '').toLowerCase();
    return allTrips
      .filter((trip) => {
        if (buildTripSections(trip) !== 'completed') {
          return false;
        }
        if (search) {
          const title = String(trip.title || '').toLowerCase();
          const place = String(trip.from?.label || '').toLowerCase();
          if (!title.includes(search) && !place.includes(search)) {
            return false;
          }
        }
        if (params.budget && trip.budget !== params.budget) {
          return false;
        }
        if (params.durationMin && Number(trip.durationDays) < Number(params.durationMin)) {
          return false;
        }
        if (params.durationMax && Number(trip.durationDays) > Number(params.durationMax)) {
          return false;
        }
        return true;
      })
      .map((trip) => ({
        ...trip,
        isSaved: savedIds.has(trip.id),
        owner: trip.owner || { id: '', username: 'traveler', fullName: 'Traveler', profileImageUrl: '' },
      }))
      .filter((trip) => !trip.isSaved);
  }
}

export async function listSavedTrips() {
  try {
    return await listSavedTripsApi();
  } catch (_error) {
    const allTrips = await listTrips();
    const savedIds = new Set(await loadSavedTripIdsLocal());
    return allTrips.filter((trip) => savedIds.has(trip.id)).map((trip) => ({ ...trip, isSaved: true }));
  }
}

export async function saveTripForUser(tripId) {
  try {
    return await saveTripForUserApi(tripId);
  } catch (_error) {
    const ids = await loadSavedTripIdsLocal();
    const next = Array.from(new Set([...ids, tripId]));
    await saveSavedTripIdsLocal(next);
    return null;
  }
}

export async function removeSavedTripForUser(tripId) {
  try {
    await removeSavedTripForUserApi(tripId);
    return true;
  } catch (_error) {
    const ids = await loadSavedTripIdsLocal();
    const next = ids.filter((id) => id !== tripId);
    await saveSavedTripIdsLocal(next);
    return true;
  }
}

export async function generateSmartItinerary(payload) {
  try {
    const draft = await generateTripDraftApi(payload);
    if (draft) {
      return rebalanceDaysByCapacity({
        ...draft,
        id: draft.id || `trip-${Date.now()}`,
      });
    }
  } catch (_error) {
    // Fall back to local generation if backend is unavailable.
  }

  const fromInput = await resolveLocationInput(payload.fromLocation, 'from');
  const areaName = await reverseGeocodeWithPhoton(fromInput.latitude, fromInput.longitude).catch(() => 'Local Area');
  const userEnteredFromLabel =
    payload?.fromLocation?.text?.trim() ||
    payload?.fromLocation?.selected?.label?.trim() ||
    fromInput.label?.trim() ||
    '';
  const canonicalFromLabel = userEnteredFromLabel || areaName || fromInput.label || 'Local Area';
  const from = {
    ...fromInput,
    label: canonicalFromLabel,
  };
  const center = {
    ...from,
    label: from.label,
    source: from.source || 'live',
  };

  const startDate = payload.startDate || toIsoDate(new Date());
  const endDate = payload.endDate || startDate;
  const durationDays = getDaysInclusive(startDate, endDate);
  const maxTotalStopsForTrip = Math.max(1, durationDays * MAX_STOPS_PER_DAY);
  // Fetch real attractions using max supported nearby radius before using fallback.
  let attractions = [];
  try {
    const nearby = await getNearbyAttractions({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMeters: MAX_ATTRACTION_RADIUS_METERS,
      limit: Math.min(MAX_ATTRACTIONS_TO_FETCH, maxTotalStopsForTrip),
    });
    attractions = nearby.map((item) => ({
      ...item,
      category: inferCategoryFromAttraction(item),
    }));
  } catch (_error) {
    attractions = [];
  }

  if (!attractions.length) {
    attractions = fallbackAttractions(center, Math.min(24, maxTotalStopsForTrip));
  }

  const routeNodes = [{ id: 'origin', label: from.label, latitude: from.latitude, longitude: from.longitude }, ...attractions];
  const matrix = await getDistanceMatrix(routeNodes);
  const nearestPath = nearestNeighborOrder(matrix.durations);
  const optimizedPath = twoOptImprove(nearestPath, matrix.durations);
  const orderedAttractions = optimizedPath
    .slice(1)
    .map((nodeIndex) => routeNodes[nodeIndex])
    .slice(0, maxTotalStopsForTrip);

  const targetStopsPerDay = buildBalancedStopTargets(
    orderedAttractions.length,
    Array.from({ length: durationDays }, () => 1)
  );

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
  const finalizeCurrentDay = () => {
    const dayDate = new Date(parseDateOnly(startDate).getTime() + currentDayIndex * 24 * 60 * 60 * 1000);
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
  };

  for (let stopIndex = 0; stopIndex < orderedAttractions.length; stopIndex += 1) {
    while (currentDayIndex < durationDays - 1 && (targetStopsPerDay[currentDayIndex] || 0) === 0 && dayStops.length === 0) {
      finalizeCurrentDay();
    }

    const stop = orderedAttractions[stopIndex];
    const matrixNodeIndex = routeNodes.findIndex((node) => node.id === stop.id);
    const travelMinutes = Math.round((matrix.durations[previousNodeIndex][matrixNodeIndex] || 0) / 60);
    const travelDistanceMeters = Math.round(matrix.distances[previousNodeIndex][matrixNodeIndex] || 0);
    const visitMinutes = estimateVisitMinutes(stop);
    const stopRuntimeMinutes = dayMinutes + travelMinutes + visitMinutes;
    const recommendations = [];
    const shouldEnrichStop = stopIndex < MAX_RECOMMENDATION_ENRICHED_STOPS;
    const dayStopPosition = dayStops.length + 1;
    const restaurantGap = dayStopPosition - lastRestaurantRecommendationAt;
    const atmGap = dayStopPosition - lastAtmRecommendationAt;
    const washroomGap = dayStopPosition - lastWashroomRecommendationAt;

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
        getNearbyAmenities({
          amenity: 'restaurant',
          latitude: stop.latitude,
          longitude: stop.longitude,
          radiusMeters: 1200,
          limit: 5,
        }).catch(() => []),
        new Promise((resolve) => setTimeout(() => resolve([]), AMENITY_LOOKUP_TIMEOUT_MS)),
      ]);
      const budgetRange = BUDGET_RANGES[payload.budget] || BUDGET_RANGES.$;
      const filteredByBudget = restaurants.filter((item) => {
        const level = derivePriceLevel(item.tags);
        return level >= budgetRange.min && level <= budgetRange.max;
      });
      const topRestaurant = filteredByBudget[0] || restaurants[0];
      const withFallback = topRestaurant || {
        id: `fallback-restaurant-${stop.id}`,
        label: `Restaurant near ${stop.label}`,
        latitude: stop.latitude + 0.0015,
        longitude: stop.longitude + 0.0015,
        tags: {},
      };
      if (withFallback) {
        recommendations.push({
          type: 'restaurant',
          reason: 'Meal time or logical sightseeing break',
          place: withFallback,
        });
        lastRestaurantRecommendationAt = dayStopPosition;
        restaurantsRecommendedToday += 1;
      }
    }

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
        recommendations.push({
          type: 'atm',
          reason: 'Commercial corridor or long travel stretch',
          place: atm,
        });
        lastAtmRecommendationAt = dayStopPosition;
        atmsRecommendedToday += 1;
      }
    }

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
        recommendations.push({
          type: 'washroom',
          reason: 'Tourist/transit hotspot or comfort break window',
          place: washroom,
        });
        lastWashroomRecommendationAt = dayStopPosition;
        washroomsRecommendedToday += 1;
      }
    }

    dayStops.push({
      sequence: stopIndex + 1,
      id: stop.id,
      label: stop.label,
      category: stop.category || 'attraction',
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

    const isLastAttraction = stopIndex === orderedAttractions.length - 1;
    const dayTarget = targetStopsPerDay[currentDayIndex] || 0;
    const hasReachedBalancedTarget = dayStops.length >= dayTarget && dayTarget > 0;
    if (!isLastAttraction && hasReachedBalancedTarget && currentDayIndex < durationDays - 1) {
      finalizeCurrentDay();
    }
  }

  if (dayStops.length > 0 || days.length === 0) {
    const dayDate = new Date(parseDateOnly(startDate).getTime() + currentDayIndex * 24 * 60 * 60 * 1000);
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

  return rebalanceDaysByCapacity({
    id: `trip-${Date.now()}`,
    title: canonicalFromLabel,
    coverImageUrl,
    createdAt: new Date().toISOString(),
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
    stats: {
      totalStops,
      totalDistanceKm,
    },
    days,
  });
}


