import express from 'express';
import cors from 'cors';
import { router } from './routes/index.js';
import { errorHandler } from './middlewares/error.js';
import { NotFound } from './utils/errors.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check — no auth.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'emr-api' });
  });

  // API v1 routes
  app.use('/api/v1', router);

  // 404 handler for unmatched routes.
  app.use((req, _res, next) => {
    next(NotFound(`Route not found: ${req.method} ${req.path}`));
  });

  // Centralized error handler — must be last.
  app.use(errorHandler);

  return app;
}
