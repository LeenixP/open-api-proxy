import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimiter } from '../../src/server/middleware/rate-limit.js';

function createMockReply() {
  const result: { status?: number; body?: any } = {};
  const reply: any = {
    status(code: number) {
      result.status = code;
      return reply;
    },
    send(body: any) {
      result.body = body;
      return reply;
    },
  };
  return { reply: reply as any, result };
}

function createMockRequest(ip: string) {
  return { ip } as any;
}

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('allows requests within limit', () => {
    it('allows the first request', async () => {
      const limiter = rateLimiter(5, 60_000);
      const { reply, result } = createMockReply();

      await limiter(createMockRequest('10.0.0.1'), reply);

      expect(result.status).toBeUndefined();
    });

    it('allows requests up to maxRequests', async () => {
      const maxRequests = 3;
      const limiter = rateLimiter(maxRequests, 60_000);

      for (let i = 0; i < maxRequests; i++) {
        const { reply, result } = createMockReply();
        await limiter(createMockRequest('10.0.0.2'), reply);
        expect(result.status).toBeUndefined();
      }
    });

    it('tracks different IPs independently', async () => {
      const limiter = rateLimiter(2, 60_000);

      // IP 1: 2 requests (at limit)
      for (let i = 0; i < 2; i++) {
        const { reply, result } = createMockReply();
        await limiter(createMockRequest('10.0.0.1'), reply);
        expect(result.status).toBeUndefined();
      }

      // IP 2: first request (still within limit)
      const { reply, result } = createMockReply();
      await limiter(createMockRequest('10.0.0.2'), reply);
      expect(result.status).toBeUndefined();
    });
  });

  describe('blocks requests exceeding limit with 429', () => {
    it('returns 429 when count exceeds maxRequests', async () => {
      const maxRequests = 2;
      const limiter = rateLimiter(maxRequests, 60_000);

      // Exhaust the limit
      for (let i = 0; i < maxRequests; i++) {
        const { reply } = createMockReply();
        await limiter(createMockRequest('10.0.0.3'), reply);
      }

      // Next request should be blocked
      const { reply, result } = createMockReply();
      await limiter(createMockRequest('10.0.0.3'), reply);

      expect(result.status).toBe(429);
      expect(result.body).toEqual({
        error: { message: 'Too many requests', type: 'rate_limit_error' },
      });
    });

    it('continues blocking subsequent requests after threshold', async () => {
      const maxRequests = 1;
      const limiter = rateLimiter(maxRequests, 60_000);

      // First request
      let res = createMockReply();
      await limiter(createMockRequest('10.0.0.4'), res.reply);
      expect(res.result.status).toBeUndefined();

      // Second request (blocked)
      res = createMockReply();
      await limiter(createMockRequest('10.0.0.4'), res.reply);
      expect(res.result.status).toBe(429);

      // Third request (still blocked)
      res = createMockReply();
      await limiter(createMockRequest('10.0.0.4'), res.reply);
      expect(res.result.status).toBe(429);
    });
  });

  describe('resets after window expires', () => {
    it('allows requests again after window expires', async () => {
      const maxRequests = 2;
      const windowMs = 5000;
      const limiter = rateLimiter(maxRequests, windowMs);

      // Exhaust the limit
      for (let i = 0; i < maxRequests; i++) {
        const { reply } = createMockReply();
        await limiter(createMockRequest('10.0.0.5'), reply);
      }

      // Verify blocked
      let res = createMockReply();
      await limiter(createMockRequest('10.0.0.5'), res.reply);
      expect(res.result.status).toBe(429);

      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 100);

      // Should be allowed again
      res = createMockReply();
      await limiter(createMockRequest('10.0.0.5'), res.reply);
      expect(res.result.status).toBeUndefined();
    });

    it('resets count after window expires', async () => {
      const maxRequests = 2;
      const windowMs = 5000;
      const limiter = rateLimiter(maxRequests, windowMs);

      // Use one request
      let res = createMockReply();
      await limiter(createMockRequest('10.0.0.6'), res.reply);
      expect(res.result.status).toBeUndefined();

      // Advance past window
      vi.advanceTimersByTime(windowMs + 100);

      // Should get a full new window of requests
      for (let i = 0; i < maxRequests; i++) {
        res = createMockReply();
        await limiter(createMockRequest('10.0.0.6'), res.reply);
        expect(res.result.status).toBeUndefined();
      }

      // And block after reaching limit in new window
      res = createMockReply();
      await limiter(createMockRequest('10.0.0.6'), res.reply);
      expect(res.result.status).toBe(429);
    });
  });

  describe('uses "unknown" for requests without ip', () => {
    it('uses default key for requests missing ip', async () => {
      const limiter = rateLimiter(1, 60_000);

      let res = createMockReply();
      await limiter({ ip: undefined } as any, res.reply);
      expect(res.result.status).toBeUndefined();

      res = createMockReply();
      await limiter({ ip: undefined } as any, res.reply);
      expect(res.result.status).toBe(429);
    });
  });
});
