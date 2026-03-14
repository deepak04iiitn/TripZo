import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { getUploadsStaticDir } from './utils/uploadPaths.js';
import {
  burstRateLimiter,
  globalRateLimiter,
  securityHeadersMiddleware,
} from './middleware/securityMiddleware.js';

const app = express();

app.set('trust proxy', 1);
app.use(securityHeadersMiddleware);
app.use(cors());
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '200kb' }));
app.use(globalRateLimiter);
app.use(burstRateLimiter);
app.use('/uploads', express.static(getUploadsStaticDir()));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'tripzo-server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
