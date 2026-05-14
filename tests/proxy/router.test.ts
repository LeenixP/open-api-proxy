import { describe, it, expect } from 'vitest';
import { resolveRoute } from '../../src/proxy/router.js';
import type { AppConfig } from '../../src/types.js';
import { defaults } from '../../src/config/defaults.js';

const testConfig: AppConfig = {
  ...defaults,
  providers: {
    openai: {
      display_name: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      api_key: 'sk-test',
      protocol: 'openai',
      models: ['gpt-4o', 'gpt-5'],
    },
    anthropic: {
      display_name: 'Anthropic',
      base_url: 'https://api.anthropic.com',
      api_key: 'sk-ant-test',
      protocol: 'anthropic',
      models: ['claude-sonnet-4-20250514'],
    },
    deepseek: {
      display_name: 'DeepSeek',
      base_url: 'https://api.deepseek.com',
      api_key: 'sk-ds-test',
      protocol: 'openai',
      models: ['deepseek-chat'],
    },
  },
};

describe('resolveRoute', () => {
  it('should parse provider/model and resolve config', () => {
    const route = resolveRoute(testConfig, 'openai/gpt-4o', '/v1/chat/completions', true);
    expect(route.providerKey).toBe('openai');
    expect(route.model).toBe('gpt-4o');
    expect(route.sourceProtocol).toBe('openai-chat');
    expect(route.targetProtocol).toBe('openai');
    expect(route.stream).toBe(true);
  });

  it('should detect Anthropic source from /v1/messages', () => {
    const route = resolveRoute(testConfig, 'openai/gpt-4o', '/v1/messages', false);
    expect(route.sourceProtocol).toBe('anthropic');
    expect(route.targetProtocol).toBe('openai');
  });

  it('should detect OpenAI Responses source from /v1/responses', () => {
    const route = resolveRoute(testConfig, 'anthropic/claude-sonnet-4-20250514', '/v1/responses', false);
    expect(route.sourceProtocol).toBe('openai-responses');
    expect(route.targetProtocol).toBe('anthropic');
  });

  it('should throw on invalid model format (no slash)', () => {
    expect(() => resolveRoute(testConfig, 'invalid-format', '/v1/chat/completions', false))
      .toThrow(/Invalid model format/);
  });

  it('should throw when model name is empty after slash', () => {
    expect(() => resolveRoute(testConfig, 'openai/', '/v1/chat/completions', false))
      .toThrow(/Model name required/);
  });

  it('should throw on unknown provider', () => {
    expect(() => resolveRoute(testConfig, 'unknown/gpt-4', '/v1/chat/completions', false))
      .toThrow(/Provider.*not found/);
  });

  it('should throw when model not in provider model list', () => {
    expect(() => resolveRoute(testConfig, 'openai/nonexistent-model', '/v1/chat/completions', false))
      .toThrow(/Model.*not found/i);
  });

  it('should throw on unknown endpoint path', () => {
    expect(() => resolveRoute(testConfig, 'openai/gpt-4o', '/v1/unknown', false))
      .toThrow(/Unknown endpoint path/);
  });
});
