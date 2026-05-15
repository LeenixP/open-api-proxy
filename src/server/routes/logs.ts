import type { FastifyInstance } from 'fastify';
import { logBuffer, logEmitter } from '../middleware/logger.js';
import type { LogEntry } from '../middleware/logger.js';

export function registerLogsRoutes(app: FastifyInstance): void {
  app.get('/api/logs', async (_request, reply) => {
    reply.send(logBuffer.slice(-200));
  });

  app.get('/api/logs/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    for (const entry of logBuffer.slice(-50)) {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    const onEntry = (entry: LogEntry) => {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    };
    logEmitter.on('entry', onEntry);

    const interval = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 30000);

    request.raw.on('close', () => {
      logEmitter.off('entry', onEntry);
      clearInterval(interval);
      reply.raw.end();
    });
  });
}
