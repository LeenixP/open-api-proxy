import { describe, it, expect, beforeEach } from 'vitest';
import { initAuth, authMiddleware, isAuthEnabled } from '../../src/server/middleware/auth.js';

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

function createMockRequest(headers: Record<string, string> = {}) {
  return { headers } as any;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    initAuth();
  });

  describe('when no API key is configured', () => {
    it('allows requests without Authorization header', async () => {
      const { reply, result } = createMockReply();
      const request = createMockRequest();

      await authMiddleware(request, reply);

      expect(result.status).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('allows requests with any Authorization header', async () => {
      const { reply, result } = createMockReply();
      const request = createMockRequest({ authorization: 'Bearer some-token' });

      await authMiddleware(request, reply);

      expect(result.status).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('reports auth as disabled', () => {
      expect(isAuthEnabled()).toBe(false);
    });
  });

  describe('when an API key is configured', () => {
    beforeEach(() => {
      initAuth('test-api-key-123');
    });

    it('rejects requests without Authorization header', async () => {
      const { reply, result } = createMockReply();
      const request = createMockRequest();

      await authMiddleware(request, reply);

      expect(result.status).toBe(401);
      expect(result.body).toEqual({
        error: { message: 'Management API key required. Set via MANAGEMENT_API_KEY env var.' },
      });
    });

    it('rejects requests with missing Bearer prefix', async () => {
      const { reply, result } = createMockReply();
      const request = createMockRequest({ authorization: 'test-api-key-123' });

      await authMiddleware(request, reply);

      expect(result.status).toBe(401);
    });

    it('rejects requests with wrong Bearer token', async () => {
      const { reply, result } = createMockReply();
      const request = createMockRequest({ authorization: 'Bearer wrong-token' });

      await authMiddleware(request, reply);

      expect(result.status).toBe(403);
      expect(result.body).toEqual({
        error: { message: 'Invalid API key' },
      });
    });

    it('allows requests with correct Bearer token', async () => {
      const { reply, result } = createMockReply();
      const request = createMockRequest({ authorization: 'Bearer test-api-key-123' });

      await authMiddleware(request, reply);

      expect(result.status).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('reports auth as enabled', () => {
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe('with MANAGEMENT_API_KEY from process.env', () => {
    const originalEnv = process.env.MANAGEMENT_API_KEY;

    beforeEach(() => {
      delete process.env.MANAGEMENT_API_KEY;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.MANAGEMENT_API_KEY = originalEnv;
      }
    });

    it('uses env var when no argument is passed to initAuth', async () => {
      process.env.MANAGEMENT_API_KEY = 'env-key-456';
      initAuth();

      expect(isAuthEnabled()).toBe(true);

      const { reply, result } = createMockReply();
      const request = createMockRequest({ authorization: 'Bearer env-key-456' });

      await authMiddleware(request, reply);

      expect(result.status).toBeUndefined();
    });
  });
});
