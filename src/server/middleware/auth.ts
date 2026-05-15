import type { FastifyRequest, FastifyReply } from 'fastify';

let apiKey: string | null = null;

export function initAuth(key?: string): void {
  apiKey = key || process.env.MANAGEMENT_API_KEY || null;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // If no API key is configured, allow all (local-only mode)
  if (!apiKey) return;

  // Allow localhost without auth for health checks and shutdown takeover
  const ip = request.ip;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return;

  // Check Authorization header
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.status(401).send({ error: { message: 'Management API key required. Set via MANAGEMENT_API_KEY env var.' } });
    return;
  }

  const token = auth.slice(7);
  if (token !== apiKey) {
    reply.status(403).send({ error: { message: 'Invalid API key' } });
    return;
  }
}

export function isAuthEnabled(): boolean {
  return apiKey !== null;
}
