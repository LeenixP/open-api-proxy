import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

export function registerConfigRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/config', async (_request, reply) => {
    reply.send(config);
  });

  app.put('/api/config', async (request, reply) => {
    const newConfig = request.body as AppConfig;
    writeConfig(CONFIG_PATH, newConfig);
    Object.assign(config, newConfig);
    reply.send({ ok: true });
  });
}
