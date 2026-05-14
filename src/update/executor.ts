import { execSync } from 'child_process';

export async function execUpdate(): Promise<void> {
  try {
    console.log('Fetching latest release...');
    execSync('git fetch --tags', { cwd: process.cwd(), stdio: 'inherit' });

    const tags = execSync('git tag --sort=-v:refname', { cwd: process.cwd() })
      .toString().trim().split('\n').filter(Boolean);
    const latestTag = tags[0];
    if (!latestTag) {
      console.error('No tags found');
      return;
    }

    console.log(`Checking out ${latestTag}...`);
    execSync(`git checkout ${latestTag}`, { cwd: process.cwd(), stdio: 'inherit' });

    try {
      execSync('git diff HEAD~1 --name-only | grep package.json', { cwd: process.cwd(), stdio: 'pipe' });
      console.log('Installing dependencies...');
      execSync('npm install --production', { cwd: process.cwd(), stdio: 'inherit' });
    } catch {}
    console.log('Update complete. Restarting...');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', (err as Error).message);
    process.exit(1);
  }
}
