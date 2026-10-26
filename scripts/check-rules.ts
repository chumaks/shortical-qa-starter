/**
 * npm run rules                 check every file in scope
 * npm run rules -- <file>...    check given files (used by the edit hook)
 *
 * Exit 0: clean. Exit 1: violations, printed as file:line [rule] message.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { checkFile, readFindings, type Violation } from './rules';

const root = resolve(process.env.RULES_ROOT ?? '.');
const toRel = (p: string) => relative(root, resolve(p)).split(sep).join('/');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

const args = process.argv.slice(2);
const files = (args.length ? args : ['web', 'mobile', 'shared'].flatMap((d) => walk(join(root, d))))
  .map(toRel)
  .filter((rel) => rel.endsWith('.ts') && !rel.startsWith('..'));

const findingsPath = join(root, 'docs/FINDINGS.md');
const findings = readFindings(existsSync(findingsPath) ? readFileSync(findingsPath, 'utf8') : '');

const violations: Violation[] = files.flatMap((rel) => checkFile(root, rel, findings));

if (violations.length === 0) {
  console.log(`rules: ${files.length} files, 0 violations`);
} else {
  for (const v of violations) console.error(`${v.file}:${v.line} [${v.rule}] ${v.message}\n    ${v.text}`);
  console.error(`\nrules: ${violations.length} violation(s) in ${files.length} files`);
  process.exit(1);
}
