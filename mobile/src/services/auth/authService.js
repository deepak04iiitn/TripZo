import { apiClient } from '../api/client';

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

export async function signup(payload) {
  try {
    const response = await apiClient.post('/api/auth/signup', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Signup failed. Please try again.'));
  }
}

export async function signin(payload) {
  try {
    const response = await apiClient.post('/api/auth/signin', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Signin failed. Please try again.'));
  }
}

export async function googleAuth(idToken) {
  try {
    const response = await apiClient.post('/api/auth/google', { idToken });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Google authentication failed. Please try again.'));
  }
}

export async function getMe() {
  try {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to load user session.'));
  }
}

export async function updateProfile(payload) {
  try {
    const response = await apiClient.put('/api/auth/profile', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to update profile.'));
  }
}

export async function uploadProfileImage(fileUri) {
  try {
    const fileName = fileUri.split('/').pop() || `profile-${Date.now()}.jpg`;
    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

    const formData = new FormData();
    formData.append('image', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    });

    const response = await apiClient.post('/api/auth/profile/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to upload profile image.'));
  }
}

export async function deleteAccount() {
  try {
    const response = await apiClient.delete('/api/auth/account');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete account.'));
  }
}

export async function getForgotPasswordQuestion(email) {
  try {
    const response = await apiClient.post('/api/auth/forgot-password/question', { email });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to fetch security question.'));
  }
}

export async function resetPasswordWithSecurityAnswer(payload) {
  try {
    const response = await apiClient.post('/api/auth/forgot-password/reset', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to reset password.'));
  }
}

export async function startUserSession() {
  try {
    const response = await apiClient.post('/api/auth/session/start');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to start user session.'));
  }
}

export async function endUserSession(sessionId, durationSeconds) {
  try {
    const response = await apiClient.post('/api/auth/session/end', {
      sessionId,
      durationSeconds,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to end user session.'));
  }
}

export async function getAdminDashboardMetrics(rangeDays = 30) {
  try {
    const response = await apiClient.get('/api/auth/admin/metrics', {
      params: { rangeDays },
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to load admin dashboard metrics.'));
  }
}

