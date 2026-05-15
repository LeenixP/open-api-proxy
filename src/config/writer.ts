import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig } from '../types.js';

export async function writeConfig(configPath: string, config: AppConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });

  const toWrite = structuredClone(config) as unknown as Record<string, unknown>;

  const yamlStr = yaml.dump(toWrite, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
  });

  await writeFile(configPath, yamlStr, 'utf8');
}
