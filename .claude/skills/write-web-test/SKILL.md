---
name: write-web-test
description: Add or change a Playwright test for the Shortical web client. Use for any new web check or a change to web/tests or web/pages.
---

# Write a web test

## 1. Plan (write it down before code)

- Which risk row in `docs/TEST_STRATEGY.md` this covers.
- The user-visible outcome to assert, and **what product breakage must turn it red**.
- For any "nothing happened" assertion: the positive control that proves the
  measurement works (see step 3).
- Test data: which series (`SHORTICAL_DRAMA`), and which facts must be read
  from the site at run time instead of hard-coded (free range, totals).

## 2. Write

- Locators and navigation go in a page object in `web/pages/` (reuse
  `HomePage`, `DramaPage`, `EpisodePage`, `PlayerPage`; add methods there).
  The spec only calls page objects and asserts.
- Prefer roles and visible text; there are no `data-testid`s on the site yet.
- Wait for conditions (`expect(...)`, `expect.poll`), never for time. A fixed
  observation window for a negative check needs `// lint-allow: <why>`.
- Playback is behaviour: `currentTime` advancing, HLS responses in
  `PlayerPage.media` / `mediaFor()`, not a visible `<video>`.
- Read-only: no `fill`, no clicks on gate/paywall/purchase/sign-in.
- After each file edit the hook runs rules + ESLint on it; fix what it reports.

## 3. Zero is not green

Before asserting absence, prove presence:
- "no media for episode X" -> first assert `mediaFor` of a playing episode is non-empty in the same page;
- "nothing plays" -> first assert `videoElementCount() >= 1`;
- equality of two counts -> assert at least one side is > 0.

## 4. Prove it

```bash
npm run verify
npx playwright test -c web/playwright.config.ts -g "<title>"
npm run mutate -- <file> "<exact text>" "<breaking replacement>" "<title>"
```

Pick a mutation that breaks the behaviour under test (wrong episode, wrong
expected count, inverted condition). `MUTANT KILLED` is required. If the
mutant survives, the assertion is not guarding the behaviour: fix the test,
not the mutation.

## 5. Review

Delegate to `test-reviewer` with: the risk row, the changed files. Then hand
the diff to the human with the outputs from step 4 and the verdict.
