import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/api/health', async (_request, reply) => {
    reply.send({ status: 'ok', uptime: process.uptime() });
  });
}
