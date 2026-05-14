import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import path from 'path';

async function checkLatestVersion(): Promise<{ current: string; latest: string | null; hasUpdate: boolean }> {
  let currentVersion = '0.1.0';
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    currentVersion = pkg.version;
  } catch {
    // ignore
  }
  let latest: string | null = null;
  try {
    const res = await fetch('https://api.github.com/repos/leenixp/open-api-proxy/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'open-api-proxy' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = JSON.parse(await res.text()) as { tag_name?: string };
      latest = data.tag_name?.replace(/^v/, '') || null;
    }
  } catch {
    // ignore
  }
  return { current: currentVersion, latest, hasUpdate: latest !== null && latest !== currentVersion };
}

export function registerUpdateRoutes(app: FastifyInstance): void {
  app.get('/api/update/check', async (_request, reply) => {
    try {
      const info = await checkLatestVersion();
      reply.send(info);
    } catch (err) {
      reply.status(500).send({ error: { message: (err as Error).message } });
    }
  });

  app.post('/api/update/execute', async (_request, reply) => {
    reply.send({
      ok: true,
      message: 'Please run: npm update -g open-api-proxy',
      hint: 'Automatic update is disabled for security. Use your package manager to upgrade.',
    });
  });
}
