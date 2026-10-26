@AGENTS.md

## Claude Code specifics

- Hooks (`.claude/settings.json`) run automatically:
  - after every edit of a `.ts`/`.mjs` file: project rules + ESLint on that file;
    failures come back to you, fix them before moving on;
  - before Bash: blocks check bypasses (`--no-verify`, `|| true`, `;` before a
    commit, force push);
  - before editing a guardrail file: asks the human.
- Skills: `write-web-test`, `write-android-test`, `triage-failure`
  (`.claude/skills/`). Use the matching one for those tasks.
- Review: when the definition of done reaches step 5, delegate to the
  `test-reviewer` subagent with the risk being covered and the list of changed
  files. Do not pass it your own reasoning about why the test is correct.
