# AGENTS.md

Instructions for AI coding agents (and a short version for humans) working in
this repo. Read before changing anything. Details: docs/HOW_TESTS_WORK.md.

## What this repo is

Test automation for Shortical: Playwright for the web client (`web/`),
WebdriverIO + Appium for the Android app (`mobile/`), shared data in `shared/`.
Specs describe user-visible behaviour; page/screen objects know how to find
things; helpers know URLs and device actions.

## Commands

| Command | What | Needs |
|---|---|---|
| `npm run verify` | typecheck, ESLint, project rules, linter selftest, spec compilation, WDIO config | nothing (offline, ~10-30 s) |
| `npx playwright test -c web/playwright.config.ts -g "<title>"` | run one web test | network |
| `npm run test:web` | full web suite | network, branded Chrome |
| `npm run earned` | PASS / FAIL / NOT-EARNED for the last web run | a finished run |
| `npm run mutate -- <file> "<from>" "<to>" "<title>"` | prove a web test fails when behaviour breaks | network |
| `npm run test:android` | Android suite | device with the app, `ANDROID_UDID` |
| `npm run inspect:android <label>` | dump the current app screen | Appium running, device |

## Boundaries

- **Production is read-only.** Never type into inputs, never click gate,
  paywall, purchase or sign-in controls, never sign in. `npm run rules`
  enforces this (`no-prod-writes`); there is no override.
- **Guardrails need a human.** Do not edit `scripts/rules.ts`, `scripts/earned.ts`,
  `scripts/selftest*`, `eslint.config.mjs`, `.githooks/`, `.claude/hooks/`,
  `.claude/settings.json`, `.github/workflows/` to make something pass. If a
  rule looks wrong, say so and stop.
- **Never bypass checks:** no `--no-verify`, no `|| true` after a check, no `;`
  between a check and a commit (use `&&`). The Bash hook blocks these.
- No new dependencies without asking. No `test.skip`, `.only`, or deleted
  assertions to get green.
- Do not push. A human reviews the diff, commits or approves, and pushes.

## Definition of done (new or changed test)

1. `npm run verify` is green. Show the last lines of the actual output, not a summary.
2. The test ran once against the real target and passed. Show the output.
   Android without a device: say so explicitly; it is then not done, only drafted.
3. **It can fail.** Web: `npm run mutate` with a change that breaks the behaviour
   under test reports `MUTANT KILLED`. Android: describe the manual mutation you
   ran and its result.
4. **Zero is not green.** Every "nothing happened" assertion (no requests, no
   playback, no gate) is preceded by a positive control proving the measurement
   works (requests were captured, a player exists, frames are visible). A count
   compared to 0 on both sides is not evidence.
5. The `test-reviewer` subagent returns ACCEPT. On REVISE or REJECT go back to
   the code, then repeat from step 1.

## Where things go

- Locators: web in `web/pages/*.ts`, Android only in `mobile/screens/selectors.ts`.
- Test data and URLs: `shared/test-data.ts`. Read facts (free range, totals)
  from the product at run time instead of hard-coding them.
- A product bug you find: add it to `docs/FINDINGS.md` under "Drafts" with
  steps, expected, actual and evidence. A human confirms and numbers it. A test
  that pins it uses `test.fail(..., 'FINDINGS #<n>: ...')` once it is numbered.

## How to work

- Before writing a test, write in one or two lines which risk from
  `docs/TEST_STRATEGY.md` it covers and what would make it fail.
- If two hypotheses about a failure turned out wrong, stop guessing and measure:
  trace (`npx playwright show-trace`), network log, `inspect:android` dump.
- If sources disagree (strategy vs site vs findings vs instructions), stop and
  ask instead of picking one.
- Report what you ran and what it printed. "Should pass" is not a result.
