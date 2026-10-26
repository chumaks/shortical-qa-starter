// PreToolUse(Edit|Write): the files that define "green" can only change with a
// human's explicit approval. Otherwise the cheapest way to pass a rule is to
// edit the rule.
import { readEvent } from './_input.mjs';

const { tool_input: input = {} } = await readEvent();
const path = String(input.file_path ?? '').replace(/\\/g, '/');

const guarded = [
  /\/scripts\/rules\.ts$/,
  /\/scripts\/earned\.ts$/,
  /\/scripts\/selftest(\.ts|-fixtures\/)/,
  /\/eslint\.config\.mjs$/,
  /\/\.githooks\//,
  /\/\.claude\/(hooks\/|settings\.json$|agents\/test-reviewer\.md$)/,
  /\/\.github\/workflows\//,
];

if (guarded.some((re) => re.test(path))) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `${path} is a guardrail (rules, checks, hooks or CI). Changing it changes what counts as passing; a human must approve.`,
      },
    }),
  );
}
