import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { existsSync } from 'fs';
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
import { requestLogger } from './middleware/logger.js';

export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logging.level },
    bodyLimit: 10 * 1024 * 1024,
  });

  if (config.server.cors) {
    await app.register(fastifyCors, { origin: true });
  }

  app.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/')) {
      request.log.info({ url: request.url, method: request.method }, 'API request');
    }
  });

  app.addHook('onResponse', requestLogger);

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

  const uiDistPath = path.resolve(process.cwd(), 'dist/ui');
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
