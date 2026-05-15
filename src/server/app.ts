import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { existsSync } from 'fs';

declare const __dirname: string;
import type { FastifyError, FastifyInstance } from 'fastify';
import type { AppConfig } from '../types.js';
import { registerProxyRoutes } from './routes/proxy.js';
import { registerModelsRoutes } from './routes/models.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerProviderRoutes } from './routes/providers.js';
import { registerHealthRoute } from './routes/health.js';
import { registerLogsRoutes } from './routes/logs.js';
import { registerUpdateRoutes } from './routes/update.js';
import { registerPresetRoutes } from './routes/presets.js';
import { requestLogger, initFileLogging } from './middleware/logger.js';
import { initAuth, authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rate-limit.js';

export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logging.level },
    bodyLimit: 10 * 1024 * 1024,
  });

  if (config.server.cors) {
    console.warn('CORS is configured to accept all origins (origin: true). This is convenient for local use but should be restricted in production.');
    await app.register(fastifyCors, { origin: true });
  }

  // File-based logging
  if (config.logging.dir) {
    initFileLogging(config.logging.dir, config.logging.max_files);
  }

  // Initialize management API authentication
  initAuth();

  // Management API rate limiter: 60 requests per minute
  const mgmtRateLimiter = rateLimiter(60, 60_000);
  // Proxy endpoints rate limiter: 300 requests per minute
  const proxyRateLimiter = rateLimiter(300, 60_000);

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      await authMiddleware(request, reply);
      await mgmtRateLimiter(request, reply);
    } else if (request.url.startsWith('/v1/')) {
      await proxyRateLimiter(request, reply);
    }
  });

  app.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/')) {
      request.log.info({ url: request.url, method: request.method }, 'API request');
    }
  });

  app.addHook('onResponse', requestLogger);

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0');
    reply.header('Referrer-Policy', 'no-referrer');
    return payload;
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error');
    reply.status(error.statusCode || 500).send({
      error: { message: error.message, type: 'server_error' },
    });
  });

  registerProxyRoutes(app, config);
  registerModelsRoutes(app, config);
  registerConfigRoutes(app, config);
  registerProviderRoutes(app, config);
  registerHealthRoute(app, config);
  registerLogsRoutes(app);
  registerUpdateRoutes(app);
  registerPresetRoutes(app, config);

  const uiDistPath = path.resolve(__dirname, '..', 'ui');
  if (existsSync(uiDistPath)) {
    await app.register(fastifyStatic, { root: uiDistPath, prefix: '/', wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/v1/') && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: { message: 'Not found' } });
    });
  }

  return app;
}
