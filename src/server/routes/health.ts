import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { healthChecker } from '../../proxy/health.js';

export function registerHealthRoute(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/health', async (_request, reply) => {
    reply.send({
      status: 'ok',
      uptime: process.uptime(),
      providers: healthChecker.getStatus(),
    });
  });

  app.post('/api/health/probe', async (_request, reply) => {
    const results = await healthChecker.probeAll(config.providers);
    reply.send({
      status: 'ok',
      results,
      providers: healthChecker.getStatus(),
    });
  });
}
