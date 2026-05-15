import type { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
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

  app.post('/api/update/execute', async (request, reply) => {
    try {
      // Require MANAGEMENT_API_KEY authentication if configured
      const mgmtKey = process.env.MANAGEMENT_API_KEY;
      if (mgmtKey) {
        const auth = request.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== mgmtKey) {
          return reply.status(401).send({ error: { message: 'Authentication required for update. Provide MANAGEMENT_API_KEY as Bearer token.' } });
        }
      }

      reply.send({ ok: true, message: 'Update started. Server will restart shortly.' });

      // Run update asynchronously after response is sent
      setTimeout(() => {
        try {
          // Check if running from git clone (source install)
          const isGitRepo = existsSync(path.join(process.cwd(), '.git'));
          if (isGitRepo) {
            console.log('Detected git repository. Updating via git pull...');
            execSync('git pull origin main', { cwd: process.cwd(), stdio: 'inherit', timeout: 60_000 });
            console.log('Installing dependencies...');
            execSync('npm install', { cwd: process.cwd(), stdio: 'inherit', timeout: 120_000 });
          } else {
            console.log('Updating via npm install -g open-api-proxy@latest...');
            execSync('npm install -g open-api-proxy@latest', {
              stdio: 'inherit',
              timeout: 120_000,
            });
          }
          console.log('Update complete. Restarting...');
        } catch (err) {
          console.error('Update failed:', (err as Error).message);
        }
        process.exit(0);
      }, 1000);
    } catch (err) {
      reply.status(500).send({ error: { message: (err as Error).message } });
    }
  });
}
