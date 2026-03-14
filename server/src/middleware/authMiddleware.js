import { verifyAuthToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { touchUserActivity } from '../services/engagementService.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAuthToken(token);
    req.auth = { userId: decoded.sub };
    touchUserActivity(decoded.sub).catch(() => {});
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(...allowedRoles) {
  return async function roleGuard(req, res, next) {
    try {
      const user = await User.findById(req.auth.userId).select('role');

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'Forbidden. You do not have access to this resource.' });
      }

      req.auth.role = user.role;
      return next();
    } catch (_error) {
      return res.status(500).json({ message: 'Unable to verify user role.' });
    }
  };
}

export function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

