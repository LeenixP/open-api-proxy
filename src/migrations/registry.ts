import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import { v0ToV1 } from './v0_to_v1.js';
import { defaults } from '../config/defaults.js';
import { writeConfig } from '../config/writer.js';
import type { AppConfig } from '../types.js';

interface Migration {
  from: number;
  to: number;
  migrate: (config: Record<string, unknown>) => Record<string, unknown>;
}

const MIGRATIONS: Migration[] = [
  { from: 0, to: 1, migrate: v0ToV1 },
];

const CURRENT_SCHEMA_VERSION = 1;

export async function runMigrations(configPath: string): Promise<void> {
  if (!existsSync(configPath)) return;

  const raw = readFileSync(configPath, 'utf8');
  let config = yaml.load(raw) as Record<string, unknown> || {};
  const currentVersion = (config._schema_version as number) || 0;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

  console.log(`Running config migrations: v${currentVersion} → v${CURRENT_SCHEMA_VERSION}`);

  let version = currentVersion;
  for (const migration of MIGRATIONS) {
    if (migration.from === version) {
      config = migration.migrate(config);
      config._schema_version = migration.to;
      version = migration.to;
    }
  }

  writeFileSync(configPath, yaml.dump(config, { indent: 2, lineWidth: 120 }), 'utf8');
  console.log(`Config migration complete. Schema version: ${config._schema_version}`);
}

/**
 * Sync user config against defaults: add missing keys, remove deprecated keys.
 * Returns the synced config and a boolean indicating whether any changes were made.
 */
export async function syncConfigKeys(config: AppConfig, configPath?: string): Promise<{ config: AppConfig; changed: boolean }> {
  let changed = false;

  function syncObject(user: Record<string, unknown>, def: Record<string, unknown>, path: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Add keys from defaults
    for (const key of Object.keys(def)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (key in user) {
        const userVal = user[key];
        const defVal = def[key];
        if (
          typeof defVal === 'object' && defVal !== null && !Array.isArray(defVal) &&
          typeof userVal === 'object' && userVal !== null && !Array.isArray(userVal)
        ) {
          result[key] = syncObject(userVal as Record<string, unknown>, defVal as Record<string, unknown>, keyPath);
        } else {
          result[key] = userVal;
        }
      } else {
        // New key from defaults - add it
        console.log(`Config: added new key "${keyPath}"`);
        result[key] = def[key];
        changed = true;
      }
    }

    // Report removed keys (deprecated)
    for (const key of Object.keys(user)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (!(key in def)) {
        console.log(`Config: removed deprecated key "${keyPath}"`);
        changed = true;
      }
    }

    return result;
  }

  const synced = syncObject(
    config as unknown as Record<string, unknown>,
    defaults as unknown as Record<string, unknown>,
    ''
  ) as unknown as AppConfig;

  // Preserve _schema_version from original config
  synced._schema_version = config._schema_version;

  if (configPath && changed) {
    await writeConfig(configPath, synced);
    console.log('Config synced with defaults.');
  }

  return { config: synced, changed };
}
