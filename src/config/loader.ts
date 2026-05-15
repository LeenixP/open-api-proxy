import { readFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import { defaults } from './defaults.js';
import { deepMerge } from '../lib/utils.js';
import type { AppConfig } from '../types.js';

function expandEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
    const envVal = process.env[name];
    if (envVal === undefined) {
      throw new Error(`Environment variable \${${name}} not set`);
    }
    return envVal;
  });
}

function expandEnvInObject(obj: unknown): void {
  if (typeof obj === 'string') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string' && (obj[i] as string).includes('${')) {
        obj[i] = expandEnvVars(obj[i] as string);
      } else if (typeof obj[i] === 'object' && obj[i] !== null) {
        expandEnvInObject(obj[i]);
      }
    }
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'string' && value.includes('${')) {
        (obj as Record<string, unknown>)[key] = expandEnvVars(value);
      } else if (typeof value === 'object' && value !== null) {
        expandEnvInObject(value);
      }
    }
  }
}

export function loadConfig(configPath: string): AppConfig {
  if (!existsSync(configPath)) {
    return structuredClone(defaults);
  }

  const raw = readFileSync(configPath, 'utf8');
  const parsed = yaml.load(raw) as Record<string, unknown> | null;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid config.yaml: not a valid YAML object');
  }

  const { _schema_version, ...userData } = parsed;
  expandEnvInObject(userData);

  const config = deepMerge(structuredClone(defaults) as unknown as Record<string, unknown>, userData) as unknown as AppConfig;
  config._schema_version = (parsed._schema_version as number) || defaults._schema_version;

  for (const provider of Object.values(config.providers)) {
    if (!Array.isArray(provider.models)) {
      provider.models = [];
    }
  }

  return config;
}
