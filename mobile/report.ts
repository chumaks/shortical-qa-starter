/**
 * Android run report: artifacts/android-report.md, written after every
 * `npm run test:android` by the WDIO onComplete hook.
 *
 * Results come from the afterTest hook (one JSON line per test), metrics from
 * metric() calls in the specs, and pending tests (declared without a body, i.e. blocked)
 * are read from the spec files, because WDIO hooks don't see them.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ANDROID_RESULTS = './artifacts/android-results.jsonl';
export const ANDROID_METRICS = './artifacts/android-metrics.jsonl';
export const ANDROID_REPORT = './artifacts/android-report.md';

type Result = { suite: string; title: string; passed: boolean; seconds: number; error?: string };
type Metric = { name: string; ms: number };

export function resetAndroidReport() {
  mkdirSync('./artifacts', { recursive: true });
  for (const f of [ANDROID_RESULTS, ANDROID_METRICS, ANDROID_REPORT]) rmSync(f, { force: true });
}

export function recordResult(r: Result) {
  appendFileSync(ANDROID_RESULTS, `${JSON.stringify(r)}\n`);
}

/** Logs a timing and keeps it for the report. */
export function metric(name: string, ms: number) {
  console.log(`[metric] ${name}: ${ms} ms`);
  mkdirSync('./artifacts', { recursive: true });
  appendFileSync(ANDROID_METRICS, `${JSON.stringify({ name, ms } satisfies Metric)}\n`);
}

const readLines = <T>(file: string): T[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : [];

function pendingTests(specsDir: string): string[] {
  return readdirSync(specsDir)
    .filter((f) => f.endsWith('.spec.ts'))
    .flatMap((f) => [...readFileSync(join(specsDir, f), 'utf8').matchAll(/\bit\(\s*'([^']+)'\s*\)\s*;/g)].map((m) => m[1]!));
}

export function writeAndroidReport(specsDir: string): string {
  const results = readLines<Result>(ANDROID_RESULTS);
  const metrics = readLines<Metric>(ANDROID_METRICS);
  const pending = pendingTests(specsDir);
  const failed = results.filter((r) => !r.passed);
  const verdict = results.length === 0 ? '⚠️ NOT-EARNED (nothing ran)' : failed.length ? '❌ FAIL' : '✅ PASS';

  const out = [
    `## Android tests: ${verdict}`,
    `${results.length - failed.length} passed · ${failed.length} failed · ${pending.length} pending (blocked) · ${new Date().toISOString()}`,
    '',
    '| | Test | Time |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.passed ? '✅' : '❌'} | ${r.suite} › ${r.title} | ${r.seconds.toFixed(1)}s |`),
    ...pending.map((t) => `| ⏸️ | ${t} | |`),
  ];
  if (metrics.length) out.push('', '### Metrics', '', ...metrics.map((m) => `- ${m.name}: ${m.ms} ms`));
  if (failed.length) {
    out.push('', '### Failures', '');
    for (const f of failed) {
      out.push(`**${f.title}**`, '```', (f.error ?? '').split('\n').slice(0, 6).join('\n'), '```');
      out.push(`View hierarchy at failure: \`artifacts/android-fail-${f.title.replace(/[^\w-]+/g, '_')}.xml\``, '');
    }
  }
  writeFileSync(ANDROID_REPORT, `${out.join('\n')}\n`);
  return ANDROID_REPORT;
}
