import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { appendFile, mkdir, readdir, stat, unlink } from 'fs/promises';
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

export async function initFileLogging(dir: string, max: number): Promise<void> {
  logDir = path.resolve(dir);
  maxFiles = max;
  await mkdir(logDir, { recursive: true });
}

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return path.join(logDir!, `proxy-${date}.log`);
}

async function rotateLogs(): Promise<void> {
  if (!logDir) return;
  try {
    const files = await readdir(logDir);
    const filtered = files
      .filter((f: string) => f.startsWith('proxy-') && f.endsWith('.log'))
      .map(async (f: string) => {
        const stats = await stat(path.join(logDir!, f));
        return { name: f, path: path.join(logDir!, f), mtime: stats.mtime };
      });
    const filesWithStats = (await Promise.all(filtered))
      .sort((a: { mtime: Date }, b: { mtime: Date }) => a.mtime.getTime() - b.mtime.getTime());
    while (filesWithStats.length > maxFiles) {
      const oldest = filesWithStats.shift();
      if (oldest) {
        try { await unlink(oldest.path); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

export async function addLog(entry: LogEntry): Promise<void> {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
  logEmitter.emit('entry', entry);

  // Write to file if configured
  if (logDir) {
    try {
      const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
      await appendFile(getLogFilePath(), line);

      // Debounce rotation: only check once per hour
      const now = Date.now();
      if (now - lastRotateCheck > ROTATE_INTERVAL_MS) {
        lastRotateCheck = now;
        await rotateLogs();
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
    await addLog({
      timestamp: new Date().toISOString(),
      level: reply.statusCode >= 500 ? 'error' : 'info',
      message: `${request.method} ${request.url} - ${reply.statusCode} (${duration}ms)`,
    });
  });
}
