/**
 * Proves a test can fail. Runs one web test twice and reads the JSON report
 * each time (exit codes alone can't tell "assertion failed" from "browser
 * didn't start"):
 *
 *   1. baseline, unchanged: the test must execute and pass;
 *   2. with one temporary change applied: the same test must execute and fail.
 *
 * The file is restored in every case.
 *
 *   npm run mutate -- <file> "<exact text>" "<replacement>" "<test title>"
 *
 * Example: the paywall test must fail if it looks one episode too early.
 *   npm run mutate -- web/tests/paywall.spec.ts \
 *     "const firstLocked = lastFree + 1;" "const firstLocked = lastFree;" \
 *     "first locked episode shows the gate"
 *
 * Exit 0  MUTANT KILLED: passes as is, fails when the behaviour is broken.
 * Exit 1  MUTANT SURVIVED, baseline not green, nothing executed, or the
 *         mutation could not be applied: no verdict, fix that first.
 *
 * Not for tests marked test.fail() (their pass/fail meaning is inverted).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [file, from, to, title] = process.argv.slice(2);
if (!file || from === undefined || to === undefined || !title) {
  console.error('usage: npm run mutate -- <file> "<exact text>" "<replacement>" "<test title>"');
  process.exit(2);
}

const testTitle: string = title;
const original = readFileSync(file, 'utf8');
const occurrences = original.split(from).length - 1;
if (occurrences !== 1) {
  console.error(`mutation text must occur exactly once in ${file}, found ${occurrences}`);
  process.exit(1);
}

mkdirSync('artifacts', { recursive: true });
// Absolute: Playwright resolves a relative output name against the config folder.
const reportPath = resolve('artifacts', 'mutation-report.json');

type Stats = { expected: number; unexpected: number; flaky: number; skipped: number };

// On Windows npx needs a shell, and the shell splits unquoted arguments.
const isWin = process.platform === 'win32';
const arg = (a: string) => (isWin && /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

function runOnce(label: string): Stats {
  rmSync(reportPath, { force: true });
  console.log(`\n[${label}] ${testTitle}`);
  spawnSync(
    'npx',
    ['playwright', 'test', '-c', 'web/playwright.config.ts', '-g', testTitle, '--project', 'desktop-chrome', '--retries', '0', '--reporter', 'line,json'].map(arg),
    { stdio: 'inherit', shell: isWin, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath } },
  );
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8')).stats as Stats;
  } catch {
    return { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  }
}

const executed = (s: Stats) => s.expected + s.unexpected + s.flaky;

const baseline = runOnce('baseline');
if (executed(baseline) === 0) {
  console.error('\nNO VERDICT: no test matched or nothing executed. Check the title.');
  process.exit(1);
}
if (baseline.unexpected > 0 || baseline.flaky > 0) {
  console.error('\nNO VERDICT: the test does not pass unchanged, so a failure under mutation would prove nothing.');
  process.exit(1);
}

let mutant: Stats;
writeFileSync(file, original.replace(from, to));
try {
  console.log(`\nmutated ${file}: "${from}" -> "${to}"`);
  mutant = runOnce('mutant');
} finally {
  writeFileSync(file, original);
  console.log(`restored ${file}`);
}

if (executed(mutant) === 0) {
  console.error('\nNO VERDICT: the mutated test did not execute (syntax error or title changed by the mutation?).');
  process.exit(1);
}
if (mutant.unexpected === 0) {
  console.error('\nMUTANT SURVIVED: the test still passes with the behaviour broken. Strengthen the assertion.');
  process.exit(1);
}
console.log(`\nMUTANT KILLED: ${baseline.expected} passed unchanged, ${mutant.unexpected} failed under mutation.`);
