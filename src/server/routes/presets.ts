import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { presets } from '../../config/presets.js';
import { writeConfig } from '../../config/writer.js';
import { CONFIG_PATH } from '../../lib/constants.js';

export function registerPresetRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/presets', async (_request, reply) => {
    reply.send(presets);
  });

  app.post('/api/presets/:key/import', async (request, reply) => {
    const { key } = request.params as { key: string };
    const preset = presets[key];
    if (!preset) {
      return reply.status(404).send({ error: { message: `Preset "${key}" not found` } });
    }
    const providerKey = request.body && typeof request.body === 'object'
      ? (request.body as Record<string, string>).providerKey || key
      : key;
    if (config.providers[providerKey]) {
      return reply.status(409).send({ error: { message: `Provider "${providerKey}" already exists` } });
    }
    config.providers[providerKey] = {
      display_name: preset.display_name,
      base_url: preset.base_url,
      api_key: preset.api_key,
      protocol: preset.protocol,
      models: [...preset.models],
    };
    await writeConfig(CONFIG_PATH, config);
    reply.status(201).send({ ok: true, key: providerKey, provider: config.providers[providerKey] });
  });
}
