---
name: write-android-test
description: Add or change an Appium/WebdriverIO test for the Shortical Android app. Use for changes in mobile/specs, mobile/screens or mobile/helpers.
---

# Write an Android test

## 1. Plan

Same as the web skill: risk row, the outcome, what breakage turns it red, the
positive control for any negative check. Note which parts need a device.

## 2. Locators come from the device, not from guesses

- If the screen is new, ask the human to run
  `npm run inspect:android <label>` on it and share `artifacts/inspect/*.xml`.
- Add the locator to `mobile/screens/selectors.ts` only (rule
  `selectors-in-one-file`). Order: content-desc / testTag -> resource-id ->
  text. Use a screen object in `mobile/screens/` to expose it.

## 3. Write

- Open episodes with `openEpisodeByLink`; lifecycle with `coldStart`,
  `sendToBackgroundFor`, `swipeUp` from `mobile/helpers/app.ts`.
- Playback: `expectVideoPlaying` / `expectVideoNotPlaying`. Both refuse black
  frames (FLAG_SECURE), so a blocked screenshot can't pass as "not playing".
- `browser.waitUntil` on a condition, never `browser.pause` in specs.
- Read-only: no `setValue`, no taps on gate, VIP, coins or purchase.

## 4. Prove it

- `npm run verify` (offline: types, ESLint, rules, WDIO config).
- With a device: `npm run test:android -- --spec mobile/specs/<file>.spec.ts`.
- Mutation, by hand: change the expectation that encodes the behaviour (e.g.
  `LAST_FREE + 1` -> `LAST_FREE`), run, confirm it fails on that assertion,
  revert. Report the output.
- Without a device: state "not run on a device". The test is drafted, not done.

## 5. Review

`test-reviewer` with the risk row and changed files.
