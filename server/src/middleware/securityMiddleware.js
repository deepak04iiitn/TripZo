import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logSecurityEvent } from '../services/securityEventService.js';

const GLOBAL_WINDOW_MS = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 60_000);
const GLOBAL_MAX_REQUESTS = Number(process.env.GLOBAL_RATE_LIMIT_MAX || 180);
const BURST_WINDOW_MS = Number(process.env.BURST_RATE_LIMIT_WINDOW_MS || 10_000);
const BURST_MAX_REQUESTS = Number(process.env.BURST_RATE_LIMIT_MAX || 45);
const AUTH_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60_000);
const AUTH_MAX_REQUESTS = Number(process.env.AUTH_RATE_LIMIT_MAX || 25);
const ITINERARY_WINDOW_MS = Number(process.env.ITINERARY_RATE_LIMIT_WINDOW_MS || 10 * 60_000);
const ITINERARY_MAX_REQUESTS = Number(process.env.ITINERARY_RATE_LIMIT_MAX || 12);

function getRequestIdentity(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown-ip';
  const userId = req.auth?.userId;
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${ip}`;
}

function computeRetryAfterSeconds(req, windowMs) {
  const resetAt = req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime).getTime() : null;
  if (!resetAt) {
    return Math.ceil(windowMs / 1000);
  }
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

function buildLimiter({ windowMs, max, message, scope, keyGenerator = null }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.ip || req.socket?.remoteAddress || 'unknown-ip'),
    handler: async (req, res) => {
      const requestKey = req.rateLimit?.key || '';
      const retryAfterSeconds = computeRetryAfterSeconds(req, windowMs);
      await logSecurityEvent({
        eventType: 'rate_limit_block',
        scope,
        requestKey,
        req,
        metadata: {
          limit: req.rateLimit?.limit || max,
          used: req.rateLimit?.used || null,
          remaining: req.rateLimit?.remaining || 0,
          retryAfterSeconds,
        },
      });

      return res.status(429).json({
        message,
        code: 'RATE_LIMITED',
        scope,
        retryAfterSeconds,
      });
    },
  });
}

export const securityHeadersMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
});

export const globalRateLimiter = buildLimiter({
  windowMs: GLOBAL_WINDOW_MS,
  max: GLOBAL_MAX_REQUESTS,
  message: 'Too many requests. Please try again shortly.',
  scope: 'global',
});

export const burstRateLimiter = buildLimiter({
  windowMs: BURST_WINDOW_MS,
  max: BURST_MAX_REQUESTS,
  message: 'Request burst detected. Please slow down.',
  scope: 'burst',
});

export const authFloodLimiter = buildLimiter({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_REQUESTS,
  message: 'Too many authentication attempts. Please wait and try again.',
  scope: 'auth',
});

export const itineraryGenerateLimiter = buildLimiter({
  windowMs: ITINERARY_WINDOW_MS,
  max: ITINERARY_MAX_REQUESTS,
  message: 'Too many itinerary generation requests. Please try again later.',
  scope: 'itinerary_generate',
  keyGenerator: getRequestIdentity,
});


