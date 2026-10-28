/**
 * npm run summary [report.json]  ->  Markdown on stdout
 *
 * Turns the Playwright JSON report into a short Markdown page for the CI run
 * page ($GITHUB_STEP_SUMMARY). Built to be read in ten seconds:
 *
 *   1. one line: verdict and counts;
 *   2. "Needs attention": only failed and flaky tests, each with its error;
 *   3. known bugs still reproducing, one line each;
 *   4. the full results table, collapsed, one row per test with a column per project.
 */
import { existsSync, readFileSync } from 'node:fs';
import { judge } from './earned';

type Result = { status: string; duration: number; retry: number; error?: { message?: string } };
type Test = { projectName: string; expectedStatus: string; status: string; results: Result[] };
type Spec = { title: string; file: string; line: number; tests: Test[] };
type Suite = { title: string; file?: string; specs?: Spec[]; suites?: Suite[] };
type Row = { file: string; title: string; project: string; status: string; seconds: string; error?: string };

const path = process.argv[2] ?? 'artifacts/web-results.json';
if (!existsSync(path)) {
  console.log(`## Web tests: ⚠️ NOT-EARNED\n\nNo report at \`${path}\`: the tests did not run or crashed before reporting.`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(path, 'utf8'));
const { verdict, executed, stats } = judge(report.stats);


const rows: Row[] = [];
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
        seconds: ((last?.duration ?? 0) / 1000).toFixed(0),
        error: t.status === 'expected' ? undefined : failed?.error?.message,
      });
    }
  }
  for (const s of suite.suites ?? []) walk(s, here);
};
for (const s of report.suites ?? []) walk(s, []);

const icon: Record<string, string> = { expected: '✅', 'known bug': '🐞', flaky: '⚠️', unexpected: '❌', skipped: '⏭️' };
const clean = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').trim();
const projects = [...new Set(rows.map((r) => r.project))];
const byTest = new Map<string, Row[]>();
for (const r of rows) byTest.set(`${r.file}: ${r.title}`, [...(byTest.get(`${r.file}: ${r.title}`) ?? []), r]);

const out: string[] = [];
const head = { PASS: '✅', FAIL: '❌', 'NOT-EARNED': '⚠️' }[verdict];
const count = (st: string) => rows.filter((r) => r.status === st).length;
const parts = [`${count('expected')} passed`];
if (count('known bug')) parts.push(`${count('known bug')} known bugs`);
if (stats.unexpected) parts.push(`${stats.unexpected} failed`);
if (stats.flaky) parts.push(`${stats.flaky} flaky`);
if (stats.skipped) parts.push(`${stats.skipped} skipped`);
if (executed === 0) parts.push('nothing executed');
out.push(`## Web tests: ${head} ${verdict}`);
out.push(`${parts.join(' · ')} · ${((report.stats.duration ?? 0) / 60000).toFixed(1)} min`);

// Same test, same outcome, same first error line on several projects = one entry.
const attention = new Map<string, Row[]>();
for (const r of rows.filter((x) => x.status === 'unexpected' || x.status === 'flaky' || x.status === 'skipped')) {
  const key = [r.title, r.status, clean(r.error ?? '').split('\n')[0]].join('|');
  attention.set(key, [...(attention.get(key) ?? []), r]);
}
if (attention.size) {
  out.push('', '### Needs attention');
  for (const group of attention.values()) {
    const r = group[0]!;
    const what = r.status === 'flaky' ? 'flaky, passed on retry' : r.status === 'skipped' ? 'skipped' : 'failed';
    const where = group.map((g) => `${g.project} ${g.seconds}s`).join(', ');
    out.push('', `${icon[r.status]} **${r.title}**: ${what} (${where})`);
    if (r.error) out.push('```', clean(r.error).split('\n').slice(0, 8).join('\n'), '```');
  }
}

const bugs = [...byTest.entries()].filter(([, rs]) => rs.some((r) => r.status === 'known bug'));
if (bugs.length) {
  out.push('', `### 🐞 Known bugs still reproduce (${bugs.length})`);
  out.push('Pinned with `test.fail()`, see docs/FINDINGS.md. These turn red when the bug is fixed.');
  for (const [name] of bugs) out.push(`- ${name.split(': ').slice(1).join(': ')}`);
}

out.push('', `<details><summary>All results (${rows.length})</summary>`, '');
out.push(`| Test | ${projects.join(' | ')} |`);
out.push(`|---|${projects.map(() => '---').join('|')}|`);
for (const [name, rs] of byTest) {
  const cells = projects.map((p) => {
    const r = rs.find((x) => x.project === p);
    return r ? `${icon[r.status] ?? r.status} ${r.seconds}s` : '';
  });
  out.push(`| ${name} | ${cells.join(' | ')} |`);
}
out.push('', '</details>', '');
out.push('Traces, screenshots and videos for failures: the `web-report` artifact.');

console.log(out.join('\n'));
