/**
 * Project rules that ESLint can't express, checked as code instead of being
 * left as advice in a markdown file. Each rule has an id, a scope (which files
 * it applies to) and a line-level check.
 *
 * Escape hatch: a `lint-allow: <reason>` comment on the same line silences a
 * rule, but only rules marked `allowable`, and only with a reason. The prod
 * write rule has no escape hatch.
 */
import { readFileSync } from 'node:fs';

export type Violation = { rule: string; file: string; line: number; text: string; message: string };

type Rule = {
  id: string;
  message: string;
  allowable: boolean;
  scope: (rel: string) => boolean;
  test: (line: string, ctx: { rel: string; findings: Set<number> }) => boolean;
};

const isSpec = (rel: string) => /^(web\/tests|mobile\/specs)\/.+\.spec\.ts$/.test(rel);
const isWebSpec = (rel: string) => /^web\/tests\/.+\.spec\.ts$/.test(rel);
const isMobileSpec = (rel: string) => /^mobile\/specs\/.+\.spec\.ts$/.test(rel);
const isTestCode = (rel: string) =>
  /^(web\/(tests|pages)|mobile\/(specs|screens|helpers))\/.+\.ts$/.test(rel);
const isMobileCode = (rel: string) => /^mobile\/.+\.ts$/.test(rel) && rel !== 'mobile/screens/selectors.ts';

/** Strip trailing line comments so commented-out code doesn't count, but keep the comment for lint-allow. */
const code = (line: string) => (/^\s*(\*|\/\*)/.test(line) ? '' : line.replace(/\/\/.*$/, ''));
const MAX_WAIT_MS = 30_000;

export const RULES: Rule[] = [
  {
    id: 'no-fixed-wait',
    message: 'Fixed waits make tests slow and flaky. Wait for a condition; if a fixed observation window is really needed, add `// lint-allow: <why>`.',
    allowable: true,
    scope: isTestCode,
    test: (l) => /\b(waitForTimeout|pause)\s*\(/.test(code(l)),
  },
  {
    id: 'wait-cap',
    message: `A single wait longer than ${MAX_WAIT_MS / 1000}s hides problems. Fix the cause or justify with lint-allow.`,
    allowable: true,
    scope: isTestCode,
    test: (l) => {
      const m = code(l).match(/\btimeout\s*[:=]\s*([\d_]+)/);
      return !!m && Number(m[1]!.replace(/_/g, '')) > MAX_WAIT_MS;
    },
  },
  {
    id: 'no-raw-locators-in-specs',
    message: 'Specs describe behaviour; locators belong in page objects (web/pages) or selectors.ts (mobile).',
    allowable: false,
    scope: isSpec,
    test: (l, { rel }) =>
      isWebSpec(rel)
        ? /\bpage\s*\.\s*(locator|getBy\w+|\$\$?)\s*\(/.test(code(l))
        : isMobileSpec(rel) && /(^|[^\w.])\$\$?\s*\(/.test(code(l)),
  },
  {
    id: 'selectors-in-one-file',
    message: 'Android locators live only in mobile/screens/selectors.ts, so switching to test tags is a one-file change.',
    allowable: false,
    scope: isMobileCode,
    test: (l) => /android\s*=|UiSelector|['"`]~[\w-]|resourceId\s*\(/.test(code(l)),
  },
  {
    id: 'no-only',
    message: '.only() silently skips the rest of the suite.',
    allowable: false,
    scope: isSpec,
    test: (l) => /\b(test|it|describe)\s*\.\s*only\s*\(/.test(code(l)),
  },
  {
    id: 'known-bug-needs-finding',
    message: 'test.fail() must reference an existing entry: "FINDINGS #<n>", with "## <n>." in docs/FINDINGS.md.',
    allowable: false,
    scope: isWebSpec,
    test: (l, { findings }) => {
      if (!/\btest\s*\.\s*fail\s*\(/.test(code(l))) return false;
      const n = l.match(/FINDINGS #(\d+)/)?.[1];
      return !n || !findings.has(Number(n));
    },
  },
  {
    id: 'no-prod-writes',
    message: 'The suites run on production read-only: no typing into inputs, no clicks on gate, paywall or purchase controls. No lint-allow for this rule.',
    allowable: false,
    scope: isTestCode,
    test: (l) => {
      const c = code(l);
      return (
        /\.\s*(fill|type|pressSequentially|setValue|addValue|setInputFiles|selectOption)\s*\(/.test(c) ||
        /\b(gate|paywall|purchase|subscri|checkout|buy|coin|vip)\w*[\w().\]['"\s]*\.\s*(click|tap|dblclick|press|check)\s*\(/i.test(c)
      );
    },
  },
];

export function readFindings(findingsMd: string): Set<number> {
  return new Set([...findingsMd.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1])));
}

export function checkSource(rel: string, source: string, findings: Set<number>): Violation[] {
  const out: Violation[] = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((text, i) => {
    for (const rule of RULES) {
      if (!rule.scope(rel) || !rule.test(text, { rel, findings })) continue;
      const allow = text.match(/lint-allow:\s*(\S.*)$/);
      if (rule.allowable && allow) continue;
      out.push({ rule: rule.id, file: rel, line: i + 1, text: text.trim(), message: rule.message });
    }
  });
  return out;
}

export function checkFile(root: string, rel: string, findings: Set<number>): Violation[] {
  return checkSource(rel, readFileSync(`${root}/${rel}`, 'utf8'), findings);
}
