import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import path from 'path';

function deepMerge<T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown>): T {
  const result = { ...base };
  for (const [key, val] of Object.entries(overlay)) {
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        (result as Record<string, unknown>)[key] = deepMerge(
          (result as Record<string, unknown>)[key] as Record<string, unknown>,
          val as Record<string, unknown>,
        );
      } else {
        (result as Record<string, unknown>)[key] = val;
      }
    }
  }
  return result;
}

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

    const merged = deepMerge(config as unknown as Record<string, unknown>, newConfig) as unknown as AppConfig;
    await writeConfig(CONFIG_PATH, merged);
    Object.assign(config, merged);
    reply.send({ ok: true });
  });
}
