import type { FastifyRequest, FastifyReply } from 'fastify';
import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const logBuffer: LogEntry[] = [];
const MAX_BUFFER = 1000;

let logDir: string | null = null;
let maxFiles = 10;

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

  // Write to file if configured
  if (logDir) {
    try {
      const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
      appendFileSync(getLogFilePath(), line);
      rotateLogs();
    } catch { /* best-effort logging */ }
  }
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
