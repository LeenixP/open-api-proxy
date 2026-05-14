import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import { v0ToV1 } from './v0_to_v1.js';

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
