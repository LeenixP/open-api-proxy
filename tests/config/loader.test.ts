import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { writeConfig } from '../../src/config/writer.js';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = join(tmpdir(), 'open-api-proxy-test-' + Date.now());
const configPath = join(tmpDir, 'config.yaml');

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try { unlinkSync(configPath); } catch {}
});

describe('loadConfig', () => {
  it('should load a valid config file', () => {
    const yaml = `
server:
  port: 8080
  host: "127.0.0.1"
  cors: false
proxy:
  timeout: 30000
  keep_alive: false
  user_agent_override: ""
  preserve_headers: []
providers:
  openai:
    display_name: "OpenAI"
    base_url: "https://api.openai.com/v1"
    api_key: "sk-test123"
    protocol: openai
    models:
      - gpt-4o
conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true
  openai_to_anthropic_responses: false
  openai_chat_to_responses: true
  responses_to_openai_chat: true
logging:
  level: debug
  dir: logs
  max_files: 5
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);

    expect(config.server.port).toBe(8080);
    expect(config.providers.openai.api_key).toBe('sk-test123');
    expect(config.providers.openai.models).toEqual(['gpt-4o']);
    expect(config.logging.level).toBe('debug');
  });

  it('should expand environment variable references', () => {
    process.env.TEST_API_KEY = 'env-sk-12345';
    const yaml = `
providers:
  test:
    display_name: Test
    base_url: https://api.test.com
    api_key: "\${TEST_API_KEY}"
    protocol: openai
    models: []
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);
    expect(config.providers.test.api_key).toBe('env-sk-12345');
    delete process.env.TEST_API_KEY;
  });

  it('should fill defaults for missing fields', () => {
    const yaml = `
providers: {}
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);
    expect(config.server.port).toBe(6312);
    expect(config.server.host).toBe('127.0.0.1');
    expect(config._schema_version).toBe(1);
  });

  it('should throw on malformed YAML', () => {
    writeFileSync(configPath, ':: bad :: yaml ::::');
    expect(() => loadConfig(configPath)).toThrow();
  });

  it('should return defaults when config file does not exist', () => {
    const config = loadConfig('/nonexistent/path/config.yaml');
    expect(config.server.port).toBe(6312);
    expect(config._schema_version).toBe(1);
  });
});

describe('writeConfig', () => {
  it('should write config and read it back', async () => {
    const yaml = `
providers:
  test:
    display_name: Test
    base_url: https://api.test.com
    api_key: sk-write-test
    protocol: openai
    models: [m1]
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);
    config.providers.test.models.push('m2');
    await writeConfig(configPath, config);

    const reloaded = loadConfig(configPath);
    expect(reloaded.providers.test.models).toEqual(['m1', 'm2']);
  });
});
