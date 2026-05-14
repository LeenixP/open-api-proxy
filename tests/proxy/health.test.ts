import { describe, it, expect, beforeEach } from 'vitest';
import { healthChecker } from '../../src/proxy/health.js';

describe('ProviderHealthChecker', () => {
  beforeEach(() => {
    healthChecker.reset();
  });

  describe('recordSuccess', () => {
    it('resets failure count and cooldown', () => {
      // Simulate failures to build up state
      healthChecker.recordFailure('test-provider');
      healthChecker.recordFailure('test-provider');

      // Record a success
      healthChecker.recordSuccess('test-provider');

      const status = healthChecker.getStatus();
      expect(status['test-provider'].failures).toBe(0);
      expect(status['test-provider'].inCooldown).toBe(false);
      expect(status['test-provider'].healthy).toBe(true);
    });
  });

  describe('recordFailure', () => {
    it('increments failure count', () => {
      healthChecker.recordFailure('test-provider');
      const status = healthChecker.getStatus();
      expect(status['test-provider'].failures).toBe(1);
    });

    it('accumulates failures across multiple calls', () => {
      healthChecker.recordFailure('test-provider');
      healthChecker.recordFailure('test-provider');
      const status = healthChecker.getStatus();
      expect(status['test-provider'].failures).toBe(2);
    });
  });

  describe('cooldown behavior', () => {
    it('enters cooldown after maxFailures (3) consecutive failures', () => {
      healthChecker.recordFailure('test-provider');
      healthChecker.recordFailure('test-provider');
      healthChecker.recordFailure('test-provider');

      expect(healthChecker.isInCooldown('test-provider')).toBe(true);
      const status = healthChecker.getStatus();
      expect(status['test-provider'].inCooldown).toBe(true);
      expect(status['test-provider'].healthy).toBe(false);
    });

    it('does not enter cooldown before maxFailures', () => {
      healthChecker.recordFailure('test-provider');
      healthChecker.recordFailure('test-provider');

      expect(healthChecker.isInCooldown('test-provider')).toBe(false);
    });
  });

  describe('isInCooldown', () => {
    it('returns false for unknown provider', () => {
      expect(healthChecker.isInCooldown('unknown')).toBe(false);
    });

    it('returns false for healthy provider', () => {
      healthChecker.recordSuccess('test-provider');
      expect(healthChecker.isInCooldown('test-provider')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns correct status for all providers', () => {
      healthChecker.recordSuccess('healthy-provider');
      healthChecker.recordFailure('failing-provider');
      healthChecker.recordFailure('failing-provider');

      const status = healthChecker.getStatus();

      expect(status['healthy-provider']).toEqual({
        healthy: true,
        failures: 0,
        inCooldown: false,
      });

      expect(status['failing-provider'].failures).toBe(2);
      expect(status['failing-provider'].inCooldown).toBe(false);
      expect(status['failing-provider'].healthy).toBe(true);
    });

    it('returns empty object when no records exist', () => {
      const status = healthChecker.getStatus();
      expect(status).toEqual({});
    });
  });

  describe('reset', () => {
    it('clears all health records', () => {
      healthChecker.recordFailure('test-provider');
      healthChecker.recordSuccess('another-provider');

      healthChecker.reset();

      const status = healthChecker.getStatus();
      expect(status).toEqual({});
      expect(healthChecker.isInCooldown('test-provider')).toBe(false);
    });
  });
});
