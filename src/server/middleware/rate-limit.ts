import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

export function resetRateLimitStore(): void {
  store.clear();
}

export function rateLimiter(maxRequests: number, windowMs: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.ip || 'unknown';
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      reply.status(429).send({
        error: { message: 'Too many requests', type: 'rate_limit_error' },
      });
    }
  };
}
