import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import { deepMerge } from '../../lib/utils.js';
import { CONFIG_PATH } from '../../lib/constants.js';

const ALLOWED_TOP_LEVEL_KEYS = new Set(['server', 'proxy', 'providers', 'conversions', 'logging']);

export function registerConfigRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/config', async (_request, reply) => {
    reply.send(config);
  });

  app.put('/api/config', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.status(400).send({ error: { message: 'Invalid config body: must be a JSON object' } });
    }

    // Whitelist allowed top-level keys to prevent config corruption from arbitrary JSON
    const newConfig: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (ALLOWED_TOP_LEVEL_KEYS.has(key)) {
        newConfig[key] = body[key];
      }
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

    const merged = deepMerge(config as unknown as Record<string, unknown>, newConfig) as unknown as AppConfig;
    await writeConfig(CONFIG_PATH, merged);
    Object.assign(config, merged);
    reply.send({ ok: true });
  });
}
