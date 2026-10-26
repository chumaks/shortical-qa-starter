// PreToolUse(Bash): refuses commands that would turn a red check green without
// fixing anything. Each pattern is a shortcut an agent under pressure to "make
// it pass" can take; none of them is needed for legitimate work here.
import { block, readEvent } from './_input.mjs';

const { tool_input: input = {} } = await readEvent();
const cmd = String(input.command ?? '');

const guards = [
  [/\bgit\s+commit\b[^\n]*\s(--no-verify|-n)\b/, 'Skipping the pre-commit check is not allowed. Run `npm run verify`, fix what fails, then commit.'],
  [/\bcore\.hooksPath\b/, 'Changing the git hooks path disables the pre-commit check.'],
  [/;\s*git\s+(commit|push)\b/, 'Chain checks and commits with `&&`, not `;`: with `;` the commit runs even when the check failed.'],
  [/\bnpm\s+run\s+(verify|lint|rules|selftest|typecheck|test:\w+|earned)\b[^\n]*\|\|\s*(true|:|exit 0)\b/, 'Masking a failed check with `|| true` makes the result meaningless.'],
  [/\bgit\s+push\b[^\n]*\s(--force(-with-lease)?|-f)\b/, 'Force push rewrites shared history. Ask the human.'],
];

for (const [re, reason] of guards) if (re.test(cmd)) block(`Blocked by .claude/hooks/guard-bash.mjs: ${reason}`);
