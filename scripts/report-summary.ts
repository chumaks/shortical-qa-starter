/**
 * npm run summary [report.json]  ->  Markdown on stdout
 *
 * Turns the Playwright JSON report into a short Markdown page: verdict, counts,
 * every test per project with status and duration, and the first lines of each
 * failure. In CI it is appended to $GITHUB_STEP_SUMMARY, so the results show on
 * the run page itself, with no artifact to download.
 */
import { existsSync, readFileSync } from 'node:fs';
import { judge } from './earned';

type Result = { status: string; duration: number; retry: number; error?: { message?: string } };
type Test = { projectName: string; expectedStatus: string; status: string; results: Result[] };
type Spec = { title: string; file: string; line: number; tests: Test[] };
type Suite = { title: string; file?: string; specs?: Spec[]; suites?: Suite[] };

const path = process.argv[2] ?? 'artifacts/web-results.json';
if (!existsSync(path)) {
  console.log(`## Web tests\n\n**NOT-EARNED**: no report at \`${path}\`. The tests did not run or crashed before reporting.`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(path, 'utf8'));
const { verdict, executed, stats, reasons } = judge(report.stats);

const rows: { file: string; title: string; project: string; status: string; seconds: string; error?: string }[] = [];
const walk = (suite: Suite, trail: string[]) => {
  const here = suite.title && !suite.file?.endsWith(suite.title) ? [...trail, suite.title] : trail;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      const last = t.results.at(-1);
      const failed = t.results.find((r) => r.error?.message);
      rows.push({
        file: spec.file,
        title: [...here, spec.title].filter(Boolean).join(' › '),
        project: t.projectName,
        status: t.expectedStatus === 'failed' && t.status === 'expected' ? 'known bug' : t.status,
        seconds: ((last?.duration ?? 0) / 1000).toFixed(1),
        error: t.status === 'expected' ? undefined : failed?.error?.message,
      });
    }
  }
  for (const s of suite.suites ?? []) walk(s, here);
};
for (const s of report.suites ?? []) walk(s, []);

const icon: Record<string, string> = { expected: '✅', 'known bug': '🐞', flaky: '⚠️', unexpected: '❌', skipped: '⏭️' };
const label: Record<string, string> = { expected: 'passed', 'known bug': 'known bug, failed as expected', flaky: 'flaky (passed on retry)', unexpected: 'FAILED', skipped: 'skipped' };
const clean = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const out: string[] = [];
out.push(`## Web tests: ${verdict === 'PASS' ? '✅' : verdict === 'FAIL' ? '❌' : '⚠️'} ${verdict}`);
out.push('');
out.push(
  `Executed **${executed}**: passed ${stats.expected}, failed ${stats.unexpected}, flaky ${stats.flaky}, skipped ${stats.skipped}. ` +
    `Duration ${((report.stats.duration ?? 0) / 60000).toFixed(1)} min.`,
);
for (const r of reasons) out.push(`- ${r}`);
out.push('');
out.push('🐞 = a known product bug from docs/FINDINGS.md, pinned with `test.fail()`: it is supposed to fail until fixed.');
out.push('');
out.push('| | Test | Project | Time |');
out.push('|---|---|---|---|');
for (const r of rows) out.push(`| ${icon[r.status] ?? r.status} | ${r.file}: ${r.title} | ${r.project} | ${r.seconds}s |`);

const problems = rows.filter((r) => r.error);
if (problems.length) {
  out.push('');
  out.push('### Failures and retries');
  for (const p of problems) {
    out.push('');
    out.push(`**${p.title}** (${p.project}, ${label[p.status] ?? p.status})`);
    out.push('```');
    out.push(clean(p.error!).split('\n').slice(0, 12).join('\n'));
    out.push('```');
  }
}
out.push('');
out.push('Full report with traces, screenshots and videos: the `web-report` artifact, or GitHub Pages when enabled.');

console.log(out.join('\n'));
