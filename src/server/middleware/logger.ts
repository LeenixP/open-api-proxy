import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { EventEmitter } from 'events';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const logBuffer: LogEntry[] = [];
export const logEmitter = new EventEmitter();
const MAX_BUFFER = 1000;

let logDir: string | null = null;
let maxFiles = 10;
let lastRotateCheck = 0;
const ROTATE_INTERVAL_MS = 3600_000; // 1 hour

export function initFileLogging(dir: string, max: number): void {
  logDir = path.resolve(dir);
  maxFiles = max;
  mkdirSync(logDir, { recursive: true });
}

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return path.join(logDir!, `proxy-${date}.log`);
}

function rotateLogs(): void {
  if (!logDir) return;
  try {
    const files = readdirSync(logDir)
      .filter((f: string) => f.startsWith('proxy-') && f.endsWith('.log'))
      .map((f: string) => ({ name: f, path: path.join(logDir!, f), mtime: statSync(path.join(logDir!, f)).mtime }))
      .sort((a: { mtime: Date }, b: { mtime: Date }) => a.mtime.getTime() - b.mtime.getTime());
    while (files.length > maxFiles) {
      const oldest = files.shift();
      if (oldest) {
        try { unlinkSync(oldest.path); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

export function addLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
  logEmitter.emit('entry', entry);

  // Write to file if configured
  if (logDir) {
    try {
      const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
      appendFileSync(getLogFilePath(), line);

      // Debounce rotation: only check once per hour
      const now = Date.now();
      if (now - lastRotateCheck > ROTATE_INTERVAL_MS) {
        lastRotateCheck = now;
        rotateLogs();
      }
    } catch { /* best-effort logging */ }
  }
}

export function registerLoggerHooks(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as unknown as Record<string, unknown>).startTime = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as unknown as Record<string, unknown>).startTime as number | undefined;
    const duration = startTime ? Date.now() - startTime : 0;
    addLog({
      timestamp: new Date().toISOString(),
      level: reply.statusCode >= 500 ? 'error' : 'info',
      message: `${request.method} ${request.url} - ${reply.statusCode} (${duration}ms)`,
    });
  });
}

/** @deprecated Use registerLoggerHooks instead */
export async function requestLogger(_request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // Kept for backward compatibility; prefer registerLoggerHooks
}
