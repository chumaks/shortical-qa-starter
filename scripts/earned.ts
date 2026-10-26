/**
 * Was a green run earned? A run where nothing executed, or where tests were
 * silently skipped, exits 0 just like a real pass. This turns the Playwright
 * JSON report into one of three verdicts:
 *
 *   PASS        tests executed, none failed, none skipped
 *   FAIL        at least one unexpected result
 *   NOT-EARNED  zero tests executed, or some were skipped
 *
 * test.fail() tests that fail as expected count as "expected" (executed, fine).
 */
export type PwStats = { expected: number; unexpected: number; flaky: number; skipped: number };
export type Verdict = { verdict: 'PASS' | 'FAIL' | 'NOT-EARNED'; reasons: string[]; executed: number; stats: PwStats };

export function judge(stats: PwStats): Verdict {
  const executed = stats.expected + stats.unexpected + stats.flaky;
  const reasons: string[] = [];
  if (stats.unexpected > 0) reasons.push(`${stats.unexpected} failed`);
  if (executed === 0) reasons.push('0 tests executed');
  if (stats.skipped > 0) reasons.push(`${stats.skipped} skipped`);
  if (stats.flaky > 0) reasons.push(`${stats.flaky} flaky (passed on retry): investigate`);

  const verdict = stats.unexpected > 0 ? 'FAIL' : executed === 0 || stats.skipped > 0 ? 'NOT-EARNED' : 'PASS';
  return { verdict, reasons, executed, stats };
}
