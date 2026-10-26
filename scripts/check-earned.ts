/**
 * npm run earned [report.json]   (default: artifacts/web-results.json)
 *
 * Prints PASS / FAIL / NOT-EARNED for a finished Playwright run and exits
 * non-zero unless PASS. A missing report is NOT-EARNED too: no evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { judge } from './earned';

const path = process.argv[2] ?? 'artifacts/web-results.json';

if (!existsSync(path)) {
  console.error(`NOT-EARNED: report ${path} not found (did the tests run?)`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(path, 'utf8'));
const { verdict, reasons, executed, stats } = judge(report.stats);

console.log(
  `${verdict}: executed ${executed} (expected ${stats.expected}, failed ${stats.unexpected}, flaky ${stats.flaky}), skipped ${stats.skipped}`,
);
for (const r of reasons) console.log(`  - ${r}`);
process.exit(verdict === 'PASS' ? 0 : 1);
