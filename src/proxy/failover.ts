import type { AppConfig, ProviderConfig, ProviderProtocol } from '../types.js';
import { healthChecker } from './health.js';

interface FailoverResult {
  providerKey: string;
  provider: ProviderConfig;
  model: string;
}

export function findFailover(
  config: AppConfig,
  originalProviderKey: string,
  model: string,
  targetProtocol: ProviderProtocol,
): FailoverResult | null {
  for (const [key, provider] of Object.entries(config.providers)) {
    if (key === originalProviderKey) continue;
    if (healthChecker.isInCooldown(key)) continue;
    if (provider.protocol !== targetProtocol) continue;
    if (provider.models.includes(model)) {
      return { providerKey: key, provider, model };
    }
  }
  return null;
}
