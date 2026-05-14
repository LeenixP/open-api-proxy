import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig } from '../types.js';

export function writeConfig(configPath: string, config: AppConfig): void {
  mkdirSync(dirname(configPath), { recursive: true });

  const toWrite = structuredClone(config) as unknown as Record<string, unknown>;

  const yamlStr = yaml.dump(toWrite, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
  });

  writeFileSync(configPath, yamlStr, 'utf8');
}
