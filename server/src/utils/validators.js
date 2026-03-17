const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function validateSignupPayload(payload) {
  const errors = [];

  const email = payload?.email?.trim()?.toLowerCase();
  const password = payload?.password;

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push('Please provide a valid email address.');
  }

  if (!password || !PASSWORD_REGEX.test(password)) {
    errors.push('Password must be at least 8 characters and include letters and numbers.');
  }

  return { errors, value: { email, password } };
}

export function validateSigninPayload(payload) {
  const errors = [];

  const email = payload?.email?.trim()?.toLowerCase();
  const password = payload?.password;

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push('Please provide a valid email address.');
  }

  if (!password) {
    errors.push('Password is required.');
  }

  return { errors, value: { email, password } };
}

export function validateGoogleAuthPayload(payload) {
  const errors = [];
  const idToken = payload?.idToken?.trim();

  if (!idToken) {
    errors.push('Google id token is required.');
  }

  return { errors, value: { idToken } };
}

export function validateProfileUpdatePayload(payload) {
  const errors = [];

  const hasFullName = Object.prototype.hasOwnProperty.call(payload || {}, 'fullName');
  const fullName = hasFullName ? String(payload?.fullName || '').trim() : undefined;
  const securityQuestion = (payload?.securityQuestion || '').trim();
  const securityAnswer = (payload?.securityAnswer || '').trim();

  if (hasFullName && !fullName) {
    errors.push('Full name cannot be empty.');
  } else if (hasFullName && (fullName.length < 2 || fullName.length > 80)) {
    errors.push('Full name must be between 2 and 80 characters.');
  }

  if (securityQuestion && securityQuestion.length < 6) {
    errors.push('Security question must be at least 6 characters.');
  }

  if (securityAnswer && securityAnswer.length < 2) {
    errors.push('Security answer must be at least 2 characters.');
  }

  return {
    errors,
    value: {
      fullName,
      securityQuestion,
      securityAnswer,
    },
  };
}

export function validateForgotPasswordQuestionPayload(payload) {
  const errors = [];
  const email = payload?.email?.trim()?.toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push('Please provide a valid email address.');
  }

  return { errors, value: { email } };
}

export function validateForgotPasswordResetPayload(payload) {
  const errors = [];
  const email = payload?.email?.trim()?.toLowerCase();
  const securityAnswer = payload?.securityAnswer?.trim();
  const newPassword = payload?.newPassword;

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push('Please provide a valid email address.');
  }

  if (!securityAnswer) {
    errors.push('Security answer is required.');
  }

  if (!newPassword || !PASSWORD_REGEX.test(newPassword)) {
    errors.push('New password must be at least 8 characters and include letters and numbers.');
  }

  return { errors, value: { email, securityAnswer, newPassword } };
}

function validateLocationInput(location, fieldName, errors) {
  const selected = location?.selected;
  const hasSelectedCoordinates =
    Number.isFinite(selected?.latitude) && Number.isFinite(selected?.longitude);
  const hasDirectCoordinates =
    Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  const hasText = Boolean(location?.text?.trim());

  if (!hasSelectedCoordinates && !hasDirectCoordinates && !hasText) {
    errors.push(`${fieldName} location is required.`);
  }
}

export function validateItineraryGenerationPayload(payload) {
  const errors = [];
  const budget = payload?.budget;
  const fromLocation = payload?.fromLocation || {};
  const startDate = payload?.startDate;
  const endDate = payload?.endDate;
  const planMode = payload?.planMode === 'manual' ? 'manual' : 'auto';
  const selectedAttractions = Array.isArray(payload?.selectedAttractions) ? payload.selectedAttractions : [];

  validateLocationInput(fromLocation, 'From', errors);

  if (!['$', '$$', '$$$'].includes(budget)) {
    errors.push('Budget must be one of $, $$, or $$$.');
  }

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    errors.push('Start date is required in YYYY-MM-DD format.');
  }

  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    errors.push('End date is required in YYYY-MM-DD format.');
  }

  if (startDate && endDate && startDate > endDate) {
    errors.push('End date must be on or after start date.');
  }

  if (planMode === 'manual' && !selectedAttractions.length) {
    errors.push('Please select at least one attraction for manual planning.');
  }

  return {
    errors,
    value: {
      fromLocation,
      startDate,
      endDate,
      budget,
      planMode,
      selectedAttractions,
    },
  };
}

export function validateAttractionPreviewPayload(payload) {
  const errors = [];
  const fromLocation = payload?.fromLocation || {};
  const limitRaw = Number(payload?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(50, Math.floor(limitRaw))) : 50;

  validateLocationInput(fromLocation, 'From', errors);

  return {
    errors,
    value: {
      fromLocation,
      limit,
    },
  };
}

export function validateTripCreationPayload(payload) {
  const errors = [];
  const requiredFields = ['title', 'createdAtIso', 'startDate', 'endDate', 'durationDays', 'budget', 'from', 'optimization', 'stats', 'days'];

  requiredFields.forEach((field) => {
    if (payload?.[field] === undefined || payload?.[field] === null) {
      errors.push(`Missing required field: ${field}.`);
    }
  });

  if (payload?.budget && !['$', '$$', '$$$'].includes(payload.budget)) {
    errors.push('Budget must be one of $, $$, or $$$.');
  }

  if (payload?.startDate && payload?.endDate && payload.startDate > payload.endDate) {
    errors.push('End date must be on or after start date.');
  }

  if (!Array.isArray(payload?.days)) {
    errors.push('Days must be an array.');
  }

  return {
    errors,
    value: payload,
  };
}

export function validateTripStatusPayload(payload) {
  const errors = [];
  const status = payload?.status;

  if (!['planned', 'ongoing', 'upcoming', 'completed'].includes(status)) {
    errors.push('Status must be one of planned, ongoing, upcoming, or completed.');
  }

  return {
    errors,
    value: { status },
  };
}

