/**
 * npm run selftest
 *
 * The checks that guard the tests need checking too: a linter that reports
 * "0 violations" because it matches nothing looks exactly like a clean repo.
 *
 * 1. Rules linter: scripts/selftest-fixtures/ holds files with planted defects.
 *    Every line marked `expect: <rule>` must be flagged with exactly those
 *    rules, and no other line may be flagged.
 * 2. NOT-EARNED verdicts: synthetic Playwright stats with known answers.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { judge, type PwStats } from './earned';
import { RULES, checkFile, readFindings } from './rules';

const root = 'scripts/selftest-fixtures';
const ruleIds = new Set(RULES.map((r) => r.id));
const failures: string[] = [];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : f.endsWith('.ts') ? [f] : [];
  });

// 1. Rules linter
const findings = readFindings(readFileSync(join(root, 'docs/FINDINGS.md'), 'utf8'));
let planted = 0;
for (const full of walk(root)) {
  const rel = relative(root, full).split(sep).join('/');
  const lines = readFileSync(full, 'utf8').split(/\r?\n/);
  const actual = new Map<number, Set<string>>();
  for (const v of checkFile(root, rel, findings)) {
    if (!actual.has(v.line)) actual.set(v.line, new Set());
    actual.get(v.line)!.add(v.rule);
  }
  lines.forEach((text, i) => {
    const line = i + 1;
    const marker = text.match(/expect:\s*(.*)$/)?.[1] ?? '';
    const expected = new Set(marker.split(/\s+/).filter((t) => ruleIds.has(t)));
    planted += expected.size;
    const got = actual.get(line) ?? new Set<string>();
    const missing = [...expected].filter((r) => !got.has(r));
    const extra = [...got].filter((r) => !expected.has(r));
    if (missing.length) failures.push(`${rel}:${line} not flagged: ${missing.join(', ')}`);
    if (extra.length) failures.push(`${rel}:${line} unexpectedly flagged: ${extra.join(', ')}`);
  });
}
const covered = new Set(
  walk(root).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/expect:\s*(.*)$/gm)].flatMap((m) => m[1]!.split(/\s+/))),
);
for (const id of ruleIds) if (!covered.has(id)) failures.push(`rule ${id} has no planted defect`);
if (planted === 0) failures.push('no planted defects found: the selftest itself checks nothing');

// 2. Earned verdicts
const s = (p: Partial<PwStats>): PwStats => ({ expected: 0, unexpected: 0, flaky: 0, skipped: 0, ...p });
const cases: [string, PwStats, string][] = [
  ['all passed', s({ expected: 20 }), 'PASS'],
  ['nothing ran', s({}), 'NOT-EARNED'],
  ['some skipped', s({ expected: 18, skipped: 2 }), 'NOT-EARNED'],
  ['all skipped', s({ skipped: 20 }), 'NOT-EARNED'],
  ['a failure', s({ expected: 19, unexpected: 1 }), 'FAIL'],
  ['failure wins over skip', s({ expected: 1, unexpected: 1, skipped: 3 }), 'FAIL'],
  ['flaky but passed', s({ expected: 19, flaky: 1 }), 'PASS'],
];
for (const [name, stats, want] of cases) {
  const got = judge(stats).verdict;
  if (got !== want) failures.push(`earned "${name}": expected ${want}, got ${got}`);
}

if (failures.length) {
  for (const f of failures) console.error(`selftest: ${f}`);
  process.exit(1);
}
console.log(`selftest: ${planted} planted defects caught across ${ruleIds.size} rules, ${cases.length} verdict cases correct`);
