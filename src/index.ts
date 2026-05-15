import { loadConfig } from './config/loader.js';
import { createApp } from './server/app.js';
import { registerAllConverters } from './converters/index.js';
import { runMigrations, syncConfigKeys } from './migrations/registry.js';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import path from 'path';
import { CONFIG_PATH } from './lib/constants.js';

declare const __dirname: string;

function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    return (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function tryTakeover(port: number): Promise<boolean> {
  try {
    // Check if existing process is open-api-proxy via health endpoint
    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!healthRes.ok) return false;

    const health = (await healthRes.json()) as { status?: string };
    if (health.status !== 'ok') return false;

    // It's an open-api-proxy instance - shut it down
    console.log('Found existing open-api-proxy instance. Shutting it down...');
    const shutdownRes = await fetch(`http://127.0.0.1:${port}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    // If old version doesn't have shutdown endpoint, 404 is returned - treat as success
    // because the old process will be killed by other means or the port will be freed
    if (shutdownRes.ok || shutdownRes.status === 404) {
      console.log('Shutdown request sent.');
      return true;
    }
    console.log('Shutdown request failed with status:', shutdownRes.status);
    return false;
  } catch {
    return false;
  }
}

async function listenWithConflictResolution(
  app: FastifyInstance,
  port: number,
  host: string,
): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await app.listen({ port, host });
      return; // Success
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EADDRINUSE' && attempt < maxRetries - 1) {
        console.log(`Port ${port} is in use. Checking if existing process is open-api-proxy...`);
        const takenOver = await tryTakeover(port);
        if (takenOver) {
          console.log('Previous instance shut down. Retrying...');
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue; // Retry
        }
        console.error(`Port ${port} is in use by another application.`);
      }
      throw err;
    }
  }
}

async function main(): Promise<void> {
  console.log(`open-api-proxy v${getVersion()} starting...`);
  await runMigrations(CONFIG_PATH);
  let config = loadConfig(CONFIG_PATH);
  const syncResult = await syncConfigKeys(config, CONFIG_PATH);
  config = syncResult.config;
  console.log(`Loaded ${Object.keys(config.providers).length} providers`);

  // Security warnings
  if (config.server.host === '0.0.0.0') {
    console.warn('WARNING: Binding to 0.0.0.0 - management API is accessible from network. Set host to 127.0.0.1 for local-only access.');
  }
  const managementApiKey = process.env.MANAGEMENT_API_KEY;
  if (!managementApiKey) {
    const isLoopback = config.server.host === '127.0.0.1' || config.server.host === 'localhost' || config.server.host === '::1';
    if (!isLoopback) {
      console.warn('WARNING: No MANAGEMENT_API_KEY set. Management API is open and accessible from network. Set MANAGEMENT_API_KEY env var to enable authentication.');
    } else {
      console.warn('WARNING: No MANAGEMENT_API_KEY set. Management API is open (local-only mode). Set MANAGEMENT_API_KEY env var to enable authentication.');
    }
  }
  registerAllConverters();
  console.log('Protocol converters registered');
  const app = await createApp(config);
  const { port, host } = config.server;
  await listenWithConflictResolution(app, port, host);
  console.log(`open-api-proxy running at http://${host}:${port}`);

  // Graceful shutdown
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      // Second signal received - force exit
      console.log(`\nReceived second ${signal}, forcing exit...`);
      process.exit(1);
    }
    isShuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down gracefully... (Ctrl+C again to force)`);

    // Force exit after 5 seconds if graceful shutdown hangs
    const forceTimer = setTimeout(() => {
      console.log('Graceful shutdown timed out, forcing exit...');
      process.exit(1);
    }, 5000);
    forceTimer.unref();

    try {
      await app.close();
      clearTimeout(forceTimer);
      console.log('Server closed');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceTimer);
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  // Remove any existing handlers to avoid duplicates
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
