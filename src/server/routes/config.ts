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
    const newConfig = request.body as Record<string, unknown>;
    if (!newConfig || typeof newConfig !== 'object') {
      return reply.status(400).send({ error: { message: 'Invalid config body' } });
    }

    // Preserve existing api_key if not provided
    const newProviders = newConfig.providers as Record<string, Record<string, unknown>> | undefined;
    if (newProviders) {
      for (const [key, p] of Object.entries(newProviders)) {
        if (!p.api_key && config.providers[key]?.api_key) {
          p.api_key = config.providers[key].api_key;
        }
      }
    }

    writeConfig(CONFIG_PATH, newConfig as unknown as AppConfig);
    Object.assign(config, newConfig);
    reply.send({ ok: true });
  });
}
