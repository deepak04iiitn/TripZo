import { apiClient } from '../api/client';

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

export async function generateTripDraftApi(payload) {
  try {
    const response = await apiClient.post('/api/trips/generate', payload);
    return response.data?.trip;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to generate itinerary.'));
  }
}

export async function createTripApi(payload) {
  try {
    const response = await apiClient.post('/api/trips', payload);
    return response.data?.trip;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to save trip.'));
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


