import { apiClient } from '../api/client';

function getApiError(error, fallback) {
  const message = error?.response?.data?.message || fallback;
  const status = error?.response?.status;
  const err = new Error(message);
  if (status) {
    err.status = status;
  }
  return err;
}

export async function generateTripDraftApi(payload) {
  try {
    const response = await apiClient.post('/api/trips/generate', payload);
    return response.data?.trip;
  } catch (error) {
    throw getApiError(error, 'Failed to generate itinerary.');
  }
}

export async function fetchAttractionsPreviewApi(payload) {
  try {
    const response = await apiClient.post('/api/trips/attractions-preview', payload);
    return {
      city: response.data?.city || '',
      from: response.data?.from || null,
      attractions: response.data?.attractions || [],
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to fetch attractions.'));
  }
}

export async function createTripApi(payload) {
  try {
    const response = await apiClient.post('/api/trips', payload);
    return response.data?.trip;
  } catch (error) {
    throw getApiError(error, 'Failed to save trip.');
  }
}

export async function listTripsApi() {
  try {
    const response = await apiClient.get('/api/trips');
    return response.data?.trips || [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load trips.'));
  }
}

export async function listRecentTripsApi() {
  try {
    const response = await apiClient.get('/api/trips/recent');
    return {
      trips: response.data?.trips || [],
      userTripCount: Number(response.data?.userTripCount ?? 0),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load recent trips.'));
  }
}


export async function updateTripStatusApi(tripId, status) {
  try {
    const response = await apiClient.patch(`/api/trips/${tripId}/status`, { status });
    return response.data?.trip;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to update trip status.'));
  }
}

export async function deleteTripApi(tripId) {
  try {
    await apiClient.delete(`/api/trips/${tripId}`);
    return true;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete trip.'));
  }
}

export async function updateTripLikeApi(tripId, like) {
  try {
    const response = await apiClient.patch(`/api/trips/${tripId}/like`, { like });
    return response.data?.trip;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to update trip like.'));
  }
}

export async function listExploreTripsApi(params = {}) {
  try {
    const response = await apiClient.get('/api/trips/explore', { params });
    return response.data?.trips || [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load explore itineraries.'));
  }
}

export async function listLatestTripsApi(params = {}) {
  try {
    const response = await apiClient.get('/api/trips/latest', { params });
    return response.data?.trips || [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load latest itineraries.'));
  }
}

export async function listTrendingAttractionsApi(params = {}) {
  try {
    const response = await apiClient.get('/api/trips/trending-attractions', { params });
    return response.data?.attractions || [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load trending attractions.'));
  }
}

export async function listSavedTripsApi() {
  try {
    const response = await apiClient.get('/api/trips/saved');
    return response.data?.trips || [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load saved itineraries.'));
  }
}

export async function saveTripForUserApi(tripId) {
  try {
    const response = await apiClient.post(`/api/trips/${tripId}/save`);
    return response.data?.trip || null;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to save itinerary.'));
  }
}

export async function removeSavedTripForUserApi(tripId) {
  try {
    await apiClient.delete(`/api/trips/${tripId}/save`);
    return true;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to remove saved itinerary.'));
  }
}


