import type { FastifyInstance } from 'fastify';
import type { AppConfig, ProviderConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

export function registerProviderRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/providers', async (_request, reply) => {
    reply.send(config.providers);
  });

  app.post('/api/providers', async (request, reply) => {
    const { key, ...providerData } = request.body as { key: string } & ProviderConfig;
    if (!key) {
      return reply.status(400).send({ error: { message: 'Provider key is required' } });
    }
    if (config.providers[key]) {
      return reply.status(409).send({ error: { message: `Provider "${key}" already exists` } });
    }
    config.providers[key] = providerData;
    writeConfig(CONFIG_PATH, config);
    return reply.status(201).send({ ok: true, key });
  });

  app.put('/api/providers/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    if (!config.providers[key]) {
      return reply.status(404).send({ error: { message: `Provider "${key}" not found` } });
    }
    config.providers[key] = request.body as ProviderConfig;
    writeConfig(CONFIG_PATH, config);
    return reply.send({ ok: true });
  });

  app.delete('/api/providers/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    if (!config.providers[key]) {
      return reply.status(404).send({ error: { message: `Provider "${key}" not found` } });
    }
    delete config.providers[key];
    writeConfig(CONFIG_PATH, config);
    return reply.send({ ok: true });
  });
}
