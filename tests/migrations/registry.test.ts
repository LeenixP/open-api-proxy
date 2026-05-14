import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from '../../src/migrations/registry.js';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = join(tmpdir(), 'oap-migration-' + Date.now());
const configPath = join(tmpDir, 'config.yaml');

beforeEach(() => { mkdirSync(tmpDir, { recursive: true }); });
afterEach(() => { try { unlinkSync(configPath); } catch {} });

describe('runMigrations', () => {
  it('should not modify when schema version is current', () => {
    writeFileSync(configPath, '_schema_version: 1\nserver:\n  port: 8080\n');
    runMigrations(configPath);
    expect(readFileSync(configPath, 'utf8')).toContain('_schema_version: 1');
  });

  it('should migrate v0 to v1', () => {
    writeFileSync(configPath, 'server:\n  port: 8080\n  host: "127.0.0.1"\n  cors: false\nproviders: {}\n');
    runMigrations(configPath);
    expect(readFileSync(configPath, 'utf8')).toContain('_schema_version: 1');
  });

  it('should not throw for missing config file', () => {
    expect(() => runMigrations('/nonexistent/config.yaml')).not.toThrow();
  });
});
