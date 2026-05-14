import { describe, it, expect } from 'vitest';
import { buildUpstreamRequest, preserveResponseHeaders } from '../../src/proxy/forwarder.js';
import type { AppConfig, RouteInfo } from '../../src/types.js';

const testConfig: AppConfig = {
  _schema_version: 1,
  server: { port: 6312, host: '0.0.0.0', cors: true },
  proxy: {
    timeout: 120000,
    keep_alive: true,
    user_agent_override: 'TestAgent/1.0',
    preserve_headers: ['x-request-id', 'x-ratelimit-*'],
  },
  providers: {},
  conversions: {} as any,
  logging: { level: 'info', dir: 'logs', max_files: 10 },
};

const testRoute: RouteInfo = {
  providerKey: 'openai',
  provider: {
    display_name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    api_key: 'sk-test-123',
    protocol: 'openai',
    models: ['gpt-4o'],
  },
  model: 'gpt-4o',
  sourceProtocol: 'openai-chat',
  targetProtocol: 'openai',
  stream: false,
};

describe('buildUpstreamRequest', () => {
  it('should build correct URL for OpenAI Chat', () => {
    const req = buildUpstreamRequest(testRoute, { model: 'gpt-4o', messages: [] }, {}, testConfig);
    expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(req.method).toBe('POST');
    expect(req.headers['Authorization']).toBe('Bearer sk-test-123');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('should build URL for Anthropic provider', () => {
    const anthropicRoute: RouteInfo = {
      ...testRoute,
      providerKey: 'anthropic',
      provider: {
        ...testRoute.provider,
        base_url: 'https://api.anthropic.com',
        api_key: 'sk-ant-123',
        protocol: 'anthropic',
      },
      sourceProtocol: 'anthropic',
      targetProtocol: 'anthropic',
    };
    const req = buildUpstreamRequest(anthropicRoute, { model: 'claude-3', messages: [] }, {}, testConfig);
    expect(req.url).toBe('https://api.anthropic.com/messages');
    expect(req.headers['x-api-key']).toBe('sk-ant-123');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('should build URL for OpenAI Responses', () => {
    const respRoute: RouteInfo = {
      ...testRoute,
      targetProtocol: 'openai-responses',
    };
    const req = buildUpstreamRequest(respRoute, { model: 'gpt-4o', input: [] }, {}, testConfig);
    expect(req.url).toBe('https://api.openai.com/v1/responses');
  });

  it('should use configured user agent override', () => {
    const req = buildUpstreamRequest(testRoute, { model: 'gpt-4o' }, {}, testConfig);
    expect(req.headers['User-Agent']).toBe('TestAgent/1.0');
  });

  it('should pass through client user agent when no override', () => {
    const cfgNoUA = { ...testConfig, proxy: { ...testConfig.proxy, user_agent_override: '' } };
    const req = buildUpstreamRequest(testRoute, { model: 'gpt-4o' }, { 'user-agent': 'curl/8.0' }, cfgNoUA);
    expect(req.headers['User-Agent']).toBe('curl/8.0');
  });
});

describe('preserveResponseHeaders', () => {
  it('should preserve exact match headers', () => {
    const headers = { 'x-request-id': 'abc123', 'content-type': 'application/json', 'x-custom': 'foo' };
    const result = preserveResponseHeaders(headers, testConfig);
    expect(result).toEqual({ 'x-request-id': 'abc123' });
  });

  it('should preserve wildcard match headers', () => {
    const headers = { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '50', 'x-custom': 'bar' };
    const result = preserveResponseHeaders(headers, testConfig);
    expect(result).toEqual({ 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '50' });
  });
});
