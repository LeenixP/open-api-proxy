import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

const ALLOWED_CONFIG_KEYS = new Set([
  '_schema_version', 'server', 'proxy', 'providers', 'conversions', 'logging',
]);

function stripApiKeys(config: AppConfig): Record<string, unknown> {
  const safe = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const providers = safe.providers as Record<string, Record<string, unknown>>;
  if (providers) {
    for (const p of Object.values(providers)) {
      if (p.api_key) {
        p.api_key = p.api_key ? '***' : '';
      }
    }
  }
  return safe;
}

function sanitizeConfig(input: Record<string, unknown>): Partial<AppConfig> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (ALLOWED_CONFIG_KEYS.has(key)) {
      sanitized[key] = input[key];
    }
  }
  return sanitized as Partial<AppConfig>;
}

export function registerConfigRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/config', async (_request, reply) => {
    reply.send(stripApiKeys(config));
  });

  app.put('/api/config', async (request, reply) => {
    const rawBody = request.body as Record<string, unknown>;
    if (!rawBody || typeof rawBody !== 'object') {
      return reply.status(400).send({ error: { message: 'Invalid config body' } });
    }

    const newConfig = sanitizeConfig(rawBody);

    // Preserve existing api_key if not provided or still masked (***)
    const newProviders = newConfig.providers as Record<string, Record<string, unknown>> | undefined;
    if (newProviders) {
      for (const [key, p] of Object.entries(newProviders)) {
        const existingKey = config.providers[key]?.api_key;
        if (!p.api_key || p.api_key === '***') {
          if (existingKey) {
            p.api_key = existingKey;
          }
        }
      }
    }

    writeConfig(CONFIG_PATH, newConfig as unknown as AppConfig);
    // Only merge the sanitized keys into runtime config
    for (const key of Object.keys(newConfig)) {
      (config as unknown as Record<string, unknown>)[key] = (newConfig as Record<string, unknown>)[key];
    }
    reply.send({ ok: true });
  });
}
