import path from 'path';

export const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');
