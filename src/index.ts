import { loadConfig } from './config/loader.js';
import { createApp } from './server/app.js';
import { registerAllConverters } from './converters/index.js';
import { runMigrations } from './migrations/registry.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

async function main(): Promise<void> {
  console.log('open-api-proxy v0.1.0 starting...');
  await runMigrations(CONFIG_PATH);
  const config = loadConfig(CONFIG_PATH);
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
  await app.listen({ port, host });
  console.log(`open-api-proxy running at http://${host}:${port}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      console.log('Server closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
