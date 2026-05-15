import type { FastifyInstance } from 'fastify';
import type { AppConfig, ProviderConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import { validateBaseUrl } from '../../proxy/validate.js';
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
    if (!providerData.base_url) {
      return reply.status(400).send({ error: { message: 'base_url is required' } });
    }
    if (!providerData.protocol) {
      return reply.status(400).send({ error: { message: 'protocol is required' } });
    }
    if (!Array.isArray(providerData.models)) {
      return reply.status(400).send({ error: { message: 'models array is required' } });
    }
    const baseUrlCheck = validateBaseUrl(providerData.base_url);
    if (!baseUrlCheck.valid) {
      return reply.status(400).send({ error: { message: baseUrlCheck.warning || 'Invalid base_url' } });
    }
    if (config.providers[key]) {
      return reply.status(409).send({ error: { message: `Provider "${key}" already exists` } });
    }
    config.providers[key] = providerData;
    await writeConfig(CONFIG_PATH, config);
    return reply.status(201).send({ ok: true, key });
  });

  app.put('/api/providers/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    if (!config.providers[key]) {
      return reply.status(404).send({ error: { message: `Provider "${key}" not found` } });
    }
    const updated = request.body as ProviderConfig;
    if (!updated.base_url) {
      return reply.status(400).send({ error: { message: 'base_url is required' } });
    }
    if (!updated.protocol) {
      return reply.status(400).send({ error: { message: 'protocol is required' } });
    }
    if (!Array.isArray(updated.models)) {
      return reply.status(400).send({ error: { message: 'models array is required' } });
    }
    const baseUrlCheck = validateBaseUrl(updated.base_url);
    if (!baseUrlCheck.valid) {
      return reply.status(400).send({ error: { message: baseUrlCheck.warning || 'Invalid base_url' } });
    }
    // Preserve existing API key if not provided
    if (!updated.api_key && config.providers[key].api_key) {
      updated.api_key = config.providers[key].api_key;
    }
    config.providers[key] = updated;
    await writeConfig(CONFIG_PATH, config);
    return reply.send({ ok: true });
  });

  app.delete('/api/providers/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    if (!config.providers[key]) {
      return reply.status(404).send({ error: { message: `Provider "${key}" not found` } });
    }
    delete config.providers[key];
    await writeConfig(CONFIG_PATH, config);
    return reply.send({ ok: true });
  });
}
