import { describe, it, expect, beforeEach } from 'vitest';
import { findFailover } from '../../src/proxy/failover.js';
import { healthChecker } from '../../src/proxy/health.js';
import type { AppConfig } from '../../src/types.js';
import { defaults } from '../../src/config/defaults.js';

const testConfig: AppConfig = {
  ...defaults,
  providers: {
    primary: {
      display_name: 'Primary',
      base_url: 'https://primary.example.com/v1',
      api_key: 'sk-primary',
      protocol: 'openai',
      models: ['gpt-4o', 'shared-model'],
    },
    secondary: {
      display_name: 'Secondary',
      base_url: 'https://secondary.example.com/v1',
      api_key: 'sk-secondary',
      protocol: 'openai',
      models: ['gpt-4o', 'shared-model'],
    },
    anthropicProvider: {
      display_name: 'Anthropic',
      base_url: 'https://api.anthropic.com',
      api_key: 'sk-ant-test',
      protocol: 'anthropic',
      models: ['gpt-4o', 'shared-model'],
    },
    missingModel: {
      display_name: 'Missing Model',
      base_url: 'https://missing.example.com/v1',
      api_key: 'sk-missing',
      protocol: 'openai',
      models: ['other-model'],
    },
  },
};

describe('findFailover', () => {
  beforeEach(() => {
    healthChecker.reset();
  });

  it('finds failover with matching model and protocol', () => {
    const result = findFailover(testConfig, 'primary', 'gpt-4o', 'openai');
    expect(result).not.toBeNull();
    expect(result!.providerKey).toBe('secondary');
    expect(result!.model).toBe('gpt-4o');
  });

  it('skips the original provider', () => {
    const result = findFailover(testConfig, 'primary', 'gpt-4o', 'openai');
    expect(result).not.toBeNull();
    expect(result!.providerKey).not.toBe('primary');
  });

  it('skips providers in cooldown', () => {
    // Put secondary in cooldown
    healthChecker.recordFailure('secondary');
    healthChecker.recordFailure('secondary');
    healthChecker.recordFailure('secondary');

    const result = findFailover(testConfig, 'primary', 'gpt-4o', 'openai');
    // secondary is in cooldown, missingModel doesn't have gpt-4o
    expect(result).toBeNull();
  });

  it('skips providers with different protocol', () => {
    const result = findFailover(testConfig, 'primary', 'gpt-4o', 'openai');
    expect(result).not.toBeNull();
    // anthropicProvider has gpt-4o but protocol is 'anthropic', not 'openai'
    expect(result!.providerKey).toBe('secondary');
  });

  it('returns null when no failover available', () => {
    const result = findFailover(testConfig, 'primary', 'nonexistent', 'openai');
    expect(result).toBeNull();
  });

  it('skips providers that do not have the model', () => {
    const result = findFailover(testConfig, 'primary', 'gpt-4o', 'openai');
    expect(result).not.toBeNull();
    // missingModel provider has protocol 'openai' but doesn't have 'gpt-4o'
    expect(result!.providerKey).toBe('secondary');
  });
});
