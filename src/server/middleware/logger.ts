import type { FastifyRequest, FastifyReply } from 'fastify';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const logBuffer: LogEntry[] = [];
const MAX_BUFFER = 1000;

export function addLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
}

export async function requestLogger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const start = Date.now();
  reply.then(
    () => {
      const duration = Date.now() - start;
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${request.method} ${request.url} - ${reply.statusCode} (${duration}ms)`,
      });
    },
    (err: Error) => {
      const duration = Date.now() - start;
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `${request.method} ${request.url} failed after ${duration}ms: ${err.message}`,
      });
    },
  );
}
