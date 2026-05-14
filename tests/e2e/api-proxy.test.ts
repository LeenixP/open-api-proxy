import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { createApp } from '../../src/server/app.js';
import { registerAllConverters } from '../../src/converters/index.js';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = join(tmpdir(), 'oap-e2e-' + Date.now());
const configPath = join(tmpDir, 'config.yaml');

let server: any;
let port: number;

beforeAll(async () => {
  mkdirSync(tmpDir, { recursive: true });

  const testYaml = `
server:
  port: 0
  host: "127.0.0.1"
  cors: true
proxy:
  timeout: 30000
  keep_alive: true
  user_agent_override: ""
  preserve_headers:
    - x-request-id
    - x-ratelimit-*
providers:
  test-openai:
    display_name: "Test OpenAI"
    base_url: "http://localhost:19999/v1"
    api_key: "sk-test"
    protocol: openai
    models:
      - gpt-4o
      - gpt-5
  test-anthropic:
    display_name: "Test Anthropic"
    base_url: "http://localhost:19998"
    api_key: "sk-ant-test"
    protocol: anthropic
    models:
      - claude-sonnet-4-20250514
conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true
  openai_to_anthropic_responses: false
  openai_chat_to_responses: true
  responses_to_openai_chat: true
logging:
  level: error
  dir: logs
  max_files: 1
`;
  writeFileSync(configPath, testYaml);

  process.env.CONFIG_PATH = configPath;
  const config = loadConfig(configPath);
  registerAllConverters();
  const app = await createApp(config);
  await app.listen({ port: 0, host: '127.0.0.1' });
  server = app.server;
  port = (server.address() as any).port;
});

afterAll(() => {
  if (server) server.close();
  try { unlinkSync(configPath); } catch {}
  delete process.env.CONFIG_PATH;
});

function api(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { ...headers, ...options?.headers },
    ...options,
  });
}

describe('E2E: API Endpoints', () => {
  it('GET /api/health returns ok', async () => {
    const res = await api('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('GET /api/providers returns configured providers', async () => {
    const res = await api('/api/providers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('test-openai');
    expect(body).toHaveProperty('test-anthropic');
    expect(body['test-openai'].models).toContain('gpt-4o');
  });

  it('GET /v1/models returns all models in list format', async () => {
    const res = await api('/v1/models');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    expect(body.data).toBeInstanceOf(Array);
    const ids = body.data.map((m: any) => m.id);
    expect(ids).toContain('test-openai/gpt-4o');
    expect(ids).toContain('test-anthropic/claude-sonnet-4-20250514');
  });

  it('POST /v1/chat/completions returns error for invalid model format', async () => {
    const res = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'invalid-format', messages: [] }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe('proxy_error');
  });

  it('POST /v1/chat/completions returns 404 for nonexistent provider', async () => {
    const res = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'nonexistent/gpt-4o', messages: [] }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /v1/chat/completions returns 404 for model not in provider list', async () => {
    const res = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'test-openai/nonexistent-model', messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/config returns full config', async () => {
    const res = await api('/api/config');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('_schema_version');
    expect(body.server).toBeDefined();
    expect(body.proxy).toBeDefined();
  });

  it('POST/PUT/DELETE /api/providers full CRUD lifecycle', async () => {
    // Create
    const createRes = await api('/api/providers', {
      method: 'POST',
      body: JSON.stringify({
        key: 'temp-provider',
        display_name: 'Temp',
        base_url: 'https://temp.com',
        api_key: 'sk-temp',
        protocol: 'openai',
        models: ['temp-model'],
      }),
    });
    expect(createRes.status).toBe(201);

    // Verify created
    const getRes = await api('/api/providers');
    const providers = await getRes.json();
    expect(providers).toHaveProperty('temp-provider');
    expect(providers['temp-provider'].models).toEqual(['temp-model']);

    // Update
    const updateRes = await api('/api/providers/temp-provider', {
      method: 'PUT',
      body: JSON.stringify({
        display_name: 'Temp Updated',
        base_url: 'https://temp2.com',
        api_key: 'sk-temp2',
        protocol: 'openai',
        models: ['temp-model', 'temp-model-2'],
      }),
    });
    expect(updateRes.status).toBe(200);

    // Verify updated
    const getResAfterUpdate = await api('/api/providers');
    const providersAfterUpdate = await getResAfterUpdate.json();
    expect(providersAfterUpdate['temp-provider'].display_name).toBe('Temp Updated');
    expect(providersAfterUpdate['temp-provider'].models).toHaveLength(2);

    // Delete
    const deleteRes = await api('/api/providers/temp-provider', { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const getResFinal = await api('/api/providers');
    const providersFinal = await getResFinal.json();
    expect(providersFinal).not.toHaveProperty('temp-provider');
  });

  it('GET /api/logs returns log entries array', async () => {
    const res = await api('/api/logs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/providers returns 400 when key is missing', async () => {
    const res = await api('/api/providers', {
      method: 'POST',
      body: JSON.stringify({ display_name: 'NoKey', base_url: 'https://x.com', api_key: 'sk-x', protocol: 'openai', models: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/providers returns 409 when key already exists', async () => {
    const res = await api('/api/providers', {
      method: 'POST',
      body: JSON.stringify({ key: 'test-openai', display_name: 'Dup', base_url: 'https://x.com', api_key: 'sk-x', protocol: 'openai', models: [] }),
    });
    expect(res.status).toBe(409);
  });

  it('GET /api/update/check returns version info', async () => {
    const res = await api('/api/update/check');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('current');
    expect(body).toHaveProperty('hasUpdate');
  });
});
