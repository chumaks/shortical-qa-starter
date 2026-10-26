// Runs on `npm install` / `npm ci`. Points git at .githooks/ so the pre-commit
// check applies to everyone, not only to an AI agent. Silent outside a git repo.
import { execSync } from 'node:child_process';

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  // not a git checkout (e.g. a zip download): nothing to configure
}
