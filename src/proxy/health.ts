import type { ProviderConfig } from '../types.js';

interface HealthRecord {
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  cooldownUntil: number;
}

class ProviderHealthChecker {
  private records = new Map<string, HealthRecord>();
  private maxFailures = 3;
  private cooldownMs = 60_000; // 1 minute
  private healthCheckTimeout = 10_000;

  // Called when a provider request succeeds
  recordSuccess(providerKey: string): void {
    const record = this.getOrCreate(providerKey);
    record.failures = 0;
    record.lastSuccess = Date.now();
    record.cooldownUntil = 0;
  }

  // Called when a provider request fails
  recordFailure(providerKey: string): void {
    const record = this.getOrCreate(providerKey);
    record.failures++;
    record.lastFailure = Date.now();
    if (record.failures >= this.maxFailures) {
      record.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  // Check if provider is in cooldown
  isInCooldown(providerKey: string): boolean {
    const record = this.records.get(providerKey);
    if (!record) return false;
    return Date.now() < record.cooldownUntil;
  }

  // Get all health statuses
  getStatus(): Record<string, { healthy: boolean; failures: number; inCooldown: boolean }> {
    const status: Record<string, { healthy: boolean; failures: number; inCooldown: boolean }> = {};
    for (const [key, record] of this.records) {
      const inCooldown = Date.now() < record.cooldownUntil;
      status[key] = {
        healthy: !inCooldown && record.failures < this.maxFailures,
        failures: record.failures,
        inCooldown,
      };
    }
    return status;
  }

  // Reset all health records (for testing)
  reset(): void {
    this.records.clear();
  }

  // Probe a provider's base URL to check connectivity.
  // First tries without auth to avoid leaking keys. Only sends credentials if the
  // unauthenticated request returns 401/403, confirming the server requires auth.
  async probeProvider(key: string, provider: ProviderConfig): Promise<boolean> {
    const baseUrl = provider.base_url.replace(/\/+$/, '');
    const primaryUrl = baseUrl + '/models';

    try {
      // First attempt: no credentials
      const res = await fetch(primaryUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.healthCheckTimeout),
      });

      if (res.ok) {
        this.recordSuccess(key);
        return true;
      }

      // Server requires auth — safe to send credentials since it responded
      if (res.status === 401 || res.status === 403) {
        const authRes = await fetch(primaryUrl, {
          method: 'GET',
          headers: provider.protocol === 'anthropic'
            ? { 'x-api-key': provider.api_key, 'anthropic-version': '2023-06-01' }
            : { 'Authorization': `Bearer ${provider.api_key}` },
          signal: AbortSignal.timeout(this.healthCheckTimeout),
        });
        if (authRes.ok || authRes.status === 401 || authRes.status === 403) {
          this.recordSuccess(key);
          return true;
        }
        this.recordFailure(key);
        return false;
      }

      // If /models returns 404/405, the protocol may not support this endpoint.
      // Fall back to checking base URL connectivity.
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        return await this.probeBaseUrl(key, baseUrl);
      }

      this.recordFailure(key);
      return false;
    } catch {
      // Network error on /models — try base URL as fallback
      return await this.probeBaseUrl(key, baseUrl);
    }
  }

  // Best-effort connectivity check against base URL
  private async probeBaseUrl(key: string, baseUrl: string): Promise<boolean> {
    try {
      const res = await fetch(baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.healthCheckTimeout),
      });
      // Any response (even an error page) means the host is reachable
      this.recordSuccess(key);
      return true;
    } catch {
      this.recordFailure(key);
      return false;
    }
  }

  // Probe all providers
  async probeAll(providers: Record<string, ProviderConfig>): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const entries = Object.entries(providers);
    const probes = entries.map(async ([key, provider]) => {
      results[key] = await this.probeProvider(key, provider);
    });
    await Promise.allSettled(probes);
    return results;
  }

  private getOrCreate(key: string): HealthRecord {
    if (!this.records.has(key)) {
      this.records.set(key, { failures: 0, lastFailure: 0, lastSuccess: 0, cooldownUntil: 0 });
    }
    return this.records.get(key)!;
  }
}

// Singleton
export const healthChecker = new ProviderHealthChecker();
