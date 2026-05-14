import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';

export function registerModelsRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/models', async (_request, reply) => {
    const data: Array<{ id: string; object: string; owned_by: string }> = [];
    for (const [key, provider] of Object.entries(config.providers)) {
      for (const model of provider.models) {
        data.push({ id: `${key}/${model}`, object: 'model', owned_by: key });
      }
    }
    reply.send({ object: 'list', data });
  });
}
