import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import { signAuthToken } from '../utils/jwt.js';
import { getFirebaseAdminAuth } from '../config/firebaseAdmin.js';
import {
  validateForgotPasswordQuestionPayload,
  validateForgotPasswordResetPayload,
  validateGoogleAuthPayload,
  validateProfileUpdatePayload,
  validateSigninPayload,
  validateSignupPayload,
} from '../utils/validators.js';
import fs from 'fs/promises';
import path from 'path';
import { touchUserActivity } from '../services/engagementService.js';
import { resolveStoredUploadAbsolutePath } from '../utils/uploadPaths.js';

function generateUsernameFromEmail(email) {
  const localPart = (email.split('@')[0] || 'traveler')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 18);
  const suffix = Math.random().toString(36).slice(2, 7);
  const base = localPart.length >= 2 ? localPart : 'traveler';

  return `${base}${suffix}`.slice(0, 32);
}

function publicUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    username: userDoc.username,
    email: userDoc.email,
    fullName: userDoc.fullName || '',
    profileImageUrl: userDoc.profileImageUrl || '',
    securityQuestion: userDoc.securityQuestion || '',
    hasSecurityQuestion: Boolean(userDoc.securityQuestion && userDoc.securityAnswerHash),
    role: userDoc.role || 'user',
    createdAt: userDoc.createdAt,
  };
}

function normalizeRelativePath(filePath = '') {
  return filePath.replaceAll('\\', '/');
}

function profileImagePublicUrl(req, relativePath) {
  const safePath = normalizeRelativePath(relativePath);
  return `${req.protocol}://${req.get('host')}/${safePath}`;
}

async function deleteFileIfExists(filePath = '') {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (_error) {
    // Ignore if file does not exist or cannot be removed.
  }
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function resolveRoleForEmail(email, currentRole = 'user') {
  if (currentRole === 'admin') {
    return 'admin';
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.includes(email.toLowerCase())) {
    return 'admin';
  }

  return 'user';
}

export async function signup(req, res, next) {
  try {
    const { errors, value } = validateSignupPayload(req.body);

    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const generatedUsername = generateUsernameFromEmail(value.email);
    const user = await User.create({
      ...value,
      username: generatedUsername,
      authProvider: 'local',
      role: resolveRoleForEmail(value.email),
    });
    await touchUserActivity(user._id);
    const token = signAuthToken(user._id.toString());

    return res.status(201).json({
      message: 'Signup successful.',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function signin(req, res, next) {
  try {
    const { errors, value } = validateSigninPayload(req.body);

    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await User.findOne({ email: value.email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.authProvider === 'google') {
      return res.status(400).json({
        message: 'This account uses Google sign-in. Please continue with Google.',
      });
    }

    const isValidPassword = await user.comparePassword(value.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const desiredRole = resolveRoleForEmail(user.email, user.role || 'user');
    if (user.role !== desiredRole) {
      user.role = desiredRole;
      await user.save();
    }

    const token = signAuthToken(user._id.toString());
    await touchUserActivity(user._id);

    return res.json({
      message: 'Signin successful.',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function googleAuth(req, res, next) {
  try {
    const { errors, value } = validateGoogleAuthPayload(req.body);

    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const firebaseAuth = getFirebaseAdminAuth();
    const decodedToken = await firebaseAuth.verifyIdToken(value.idToken);
    const email = decodedToken?.email?.trim().toLowerCase();
    const firebaseUid = decodedToken?.uid;

    if (!email) {
      return res.status(400).json({ message: 'Google account does not include an email.' });
    }

    if (!firebaseUid) {
      return res.status(400).json({ message: 'Invalid Google token payload.' });
    }

    let user = await User.findOne({
      $or: [{ firebaseUid }, { email }],
    }).select('+password');

    if (!user) {
      const generatedUsername = generateUsernameFromEmail(email);
      user = await User.create({
        email,
        username: generatedUsername,
        authProvider: 'google',
        firebaseUid,
        role: resolveRoleForEmail(email),
      });
    } else {
      let needsSave = false;

      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        needsSave = true;
      }

      if (user.authProvider !== 'google') {
        user.authProvider = 'google';
        needsSave = true;
      }

      const desiredRole = resolveRoleForEmail(email, user.role);
      if (user.role !== desiredRole) {
        user.role = desiredRole;
        needsSave = true;
      }

      if (needsSave) {
        await user.save();
      }
    }

    const token = signAuthToken(user._id.toString());
    await touchUserActivity(user._id);

    return res.json({
      message: 'Google authentication successful.',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return res.status(401).json({ message: 'Google token is invalid or expired.' });
    }
    return next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId).select('+securityAnswerHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function logout(_req, res) {
  return res.json({
    message: 'Logged out successfully on client. Remove stored token to end session.',
  });
}

export async function startSession(req, res, next) {
  try {
    const session = await UserSession.create({
      userId: req.auth.userId,
      startedAt: new Date(),
      isActive: true,
    });

    return res.status(201).json({
      message: 'Session started.',
      sessionId: session._id.toString(),
    });
  } catch (error) {
    return next(error);
  }
}

function resolveSessionDurationSeconds(sessionDoc, providedDuration) {
  if (Number.isFinite(providedDuration) && providedDuration >= 0) {
    return Math.floor(providedDuration);
  }

  const startedAtMs = new Date(sessionDoc.startedAt).getTime();
  const nowMs = Date.now();
  const diffSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  return diffSeconds;
}

export async function endSession(req, res, next) {
  try {
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
    const providedDuration = Number(req.body?.durationSeconds);

    const query = {
      userId: req.auth.userId,
      isActive: true,
    };

    if (sessionId) {
      query._id = sessionId;
    }

    const session = await UserSession.findOne(query).sort({ startedAt: -1 });
    if (!session) {
      return res.status(404).json({ message: 'Active session not found.' });
    }

    session.endedAt = new Date();
    session.isActive = false;
    session.durationSeconds = resolveSessionDurationSeconds(session, providedDuration);
    await session.save();

    return res.json({
      message: 'Session ended.',
      sessionId: session._id.toString(),
      durationSeconds: session.durationSeconds,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { errors, value } = validateProfileUpdatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await User.findById(req.auth.userId).select('+securityAnswerHash +profileImagePath');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const normalizedQuestion = value.securityQuestion || '';
    const questionChanged = (user.securityQuestion || '') !== normalizedQuestion;

    if (normalizedQuestion && questionChanged && !value.securityAnswer) {
      return res.status(400).json({
        message: 'Security answer is required when changing the security question.',
      });
    }

    if (value.fullName !== undefined) {
      user.fullName = value.fullName;
    }
    user.securityQuestion = normalizedQuestion;

    if (!normalizedQuestion) {
      user.securityAnswerHash = '';
    } else if (value.securityAnswer) {
      await user.setSecurityAnswer(value.securityAnswer);
    }

    await user.save();

    return res.json({
      message: 'Profile updated successfully.',
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function uploadProfileImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Profile image file is required.' });
    }

    const user = await User.findById(req.auth.userId).select('+profileImagePath +securityAnswerHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.profileImagePath) {
      const absolutePath = resolveStoredUploadAbsolutePath(user.profileImagePath);
      await deleteFileIfExists(absolutePath);
    }

    const relativePath = normalizeRelativePath(path.join('uploads', 'profiles', req.file.filename));
    user.profileImagePath = relativePath;
    user.profileImageUrl = profileImagePublicUrl(req, relativePath);
    await user.save();

    return res.json({
      message: 'Profile image updated successfully.',
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId).select('+profileImagePath');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.profileImagePath) {
      const absolutePath = resolveStoredUploadAbsolutePath(user.profileImagePath);
      await deleteFileIfExists(absolutePath);
    }

    await User.deleteOne({ _id: user._id });

    return res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function getForgotPasswordQuestion(req, res, next) {
  try {
    const { errors, value } = validateForgotPasswordQuestionPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await User.findOne({ email: value.email }).select('securityQuestion');
    if (!user || !user.securityQuestion) {
      return res.status(404).json({ message: 'No recovery question found for this email.' });
    }

    return res.json({ securityQuestion: user.securityQuestion });
  } catch (error) {
    return next(error);
  }
}

export async function resetPasswordWithSecurityAnswer(req, res, next) {
  try {
    const { errors, value } = validateForgotPasswordResetPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await User.findOne({ email: value.email }).select('+password +securityAnswerHash');
    if (!user || !user.securityQuestion || !user.securityAnswerHash) {
      return res.status(404).json({ message: 'Recovery setup not found for this account.' });
    }

    const isAnswerValid = await user.compareSecurityAnswer(value.securityAnswer);
    if (!isAnswerValid) {
      return res.status(401).json({ message: 'Incorrect security answer.' });
    }

    user.password = value.newPassword;
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return next(error);
  }
}

