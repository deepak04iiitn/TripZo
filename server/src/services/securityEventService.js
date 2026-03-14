import SecurityEvent from '../models/SecurityEvent.js';

function resolveIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
}

export async function logSecurityEvent({
  eventType,
  scope = '',
  requestKey = '',
  req = null,
  metadata = {},
}) {
  if (!eventType) {
    return;
  }

  const ip = req ? resolveIp(req) : '';
  const userId = req?.auth?.userId || '';
  const method = req?.method || '';
  const path = req?.originalUrl || req?.url || '';
  const userAgent = req?.get?.('user-agent') || '';

  try {
    await SecurityEvent.create({
      eventType,
      scope,
      requestKey,
      ip: String(ip || ''),
      userId: String(userId || ''),
      method,
      path,
      userAgent,
      metadata,
    });
  } catch (error) {
    console.error('Failed to write security event:', error.message);
  }
}


