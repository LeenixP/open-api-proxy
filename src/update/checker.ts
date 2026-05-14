import { readFileSync } from 'fs';
import path from 'path';

let cachedVersion: string | null = null;

export function getCurrentVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = (pkg.version as string) || '0.0.0';
    return cachedVersion;
  } catch {
    return '0.0.0';
  }
}

export async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/leenixp/open-api-proxy/releases/latest',
      {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'open-api-proxy' },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    const data = JSON.parse(await response.text()) as { tag_name?: string };
    return data.tag_name?.replace(/^v/, '') || null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<string | null> {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();
  if (latest && latest !== current) return latest;
  return null;
}
