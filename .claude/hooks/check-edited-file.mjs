// PostToolUse(Edit|Write): checks the file that was just changed, immediately,
// with the same tools as `npm run verify` (project rules + ESLint). Problems go
// back to the agent at once instead of piling up until the end of the task.
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { block, readEvent } from './_input.mjs';

const { tool_input: input = {} } = await readEvent();
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = String(input.file_path ?? '');
const rel = relative(root, resolve(root, file)).replace(/\\/g, '/');

const inScope = /\.(ts|mjs)$/.test(rel) && !rel.startsWith('..') && !/^(node_modules|artifacts|scripts\/selftest-fixtures)\//.test(rel);
if (!inScope) process.exit(0);

// On Windows npx needs a shell, and the shell splits unquoted arguments (paths with spaces).
const isWin = process.platform === 'win32';
const arg = (a) => (isWin && /\s/.test(a) ? `"${a}"` : a);
const run = (args) => spawnSync('npx', args.map(arg), { cwd: root, encoding: 'utf8', shell: isWin });

const problems = [];
if (rel.endsWith('.ts')) {
  const rules = run(['tsx', 'scripts/check-rules.ts', rel]);
  if (rules.status !== 0) problems.push(rules.stderr || rules.stdout);
}
const lint = run(['eslint', rel]);
if (lint.status !== 0) problems.push(lint.stdout || lint.stderr);

if (problems.length) block(`Checks failed for ${rel}. Fix before continuing:\n\n${problems.join('\n')}`);
